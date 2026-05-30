// @vitest-environment jsdom
import { getPluginToken } from "@radarboard/plugin-sdk/host";
import {
  buildStatusPageTransitionNotifications,
  mergeStatusPageSources,
  refreshStatusSources,
  resolveStatusPageRefreshIntervalMs,
} from "@radarboard/plugin-status-page/statuspage";
import { render, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StatusPageBackgroundPoller } from "../background-poller";

vi.mock("@radarboard/plugin-sdk/host", () => ({
  getPluginToken: vi.fn(async () => "test-token"),
}));

vi.mock("@radarboard/plugin-status-page/statuspage", async () => {
  const actual = await vi.importActual("@radarboard/plugin-status-page/statuspage");
  return {
    ...actual,
    buildStatusPageTransitionNotifications: vi.fn(),
    mergeStatusPageSources: vi.fn(),
    refreshStatusSources: vi.fn(),
    resolveStatusPageRefreshIntervalMs: vi.fn(),
  };
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function responseForPluginData(
  url: string,
  standaloneSources: unknown[],
  cachedSources: unknown[],
  config: Record<string, unknown>
): Response | null {
  if (!url.startsWith("/api/plugins/data?")) return null;

  const parsed = new URL(url, "http://localhost");
  const pluginId = parsed.searchParams.get("pluginId");
  const key = parsed.searchParams.get("key");
  if (pluginId === "_system" && key === "integration-status-pages") {
    return jsonResponse({ value: JSON.stringify({ github: "https://www.githubstatus.com" }) });
  }
  if (key === "status:sources") {
    return jsonResponse({ value: JSON.stringify(standaloneSources) });
  }
  if (key === "status:cache") {
    return jsonResponse({ value: JSON.stringify(cachedSources) });
  }
  if (key === "status:preferences") {
    return jsonResponse({ value: JSON.stringify({}) });
  }
  if (key === "_config") {
    return jsonResponse({ value: JSON.stringify(config) });
  }

  return null;
}

function createFetchMock(
  standaloneSources: unknown[],
  cachedSources: unknown[],
  config: Record<string, unknown>
): ReturnType<typeof vi.fn<typeof fetch>> {
  return vi.fn(async (input, init) => {
    const url = String(input);
    const pluginDataResponse = responseForPluginData(url, standaloneSources, cachedSources, config);
    if (pluginDataResponse) return pluginDataResponse;

    if (url === "/api/plugins/data" && init?.method === "PUT") {
      return jsonResponse({ ok: true });
    }

    if (url === "/api/notifications/emit" && init?.method === "POST") {
      return jsonResponse({ received: true });
    }

    if (url.startsWith("/api/status-page/project-health?")) {
      return jsonResponse({
        ok: true,
        checkedAt: "2026-03-20T12:00:00.000Z",
        responseTimeMs: 25,
      });
    }

    throw new Error(`Unexpected fetch call: ${url}`);
  });
}

describe("StatusPageBackgroundPoller", () => {
  const fetchMock = vi.fn<typeof fetch>();

  const storedSources = [
    {
      id: "cursor",
      kind: "standalone" as const,
      name: "Cursor",
      url: "https://cursor.com",
      statusPageUrl: "https://status.cursor.com",
      status: "operational" as const,
      lastCheckedAt: "2026-03-20T11:00:00.000Z",
      addedAt: "2026-03-20T10:00:00.000Z",
      alertsEnabled: true,
      remoteUpdatedAt: "2026-03-20T11:59:00.000Z",
    },
  ];

  const refreshedSources = [
    {
      ...storedSources[0]!,
      status: "outage" as const,
      lastCheckedAt: "2026-03-20T12:00:00.000Z",
      remoteUpdatedAt: "2026-03-20T12:00:00.000Z",
    },
  ];

  const projectIntegrations = {
    "goshuin-atlas": {
      "goshuin-com": {
        "github._statusPage.url": "https://www.githubstatus.com",
      },
    },
  };

  beforeEach(() => {
    vi.mocked(getPluginToken).mockResolvedValue("test-token");
    fetchMock.mockReset();
    vi.mocked(resolveStatusPageRefreshIntervalMs).mockReturnValue(120_000);
    vi.mocked(mergeStatusPageSources).mockReturnValue(storedSources);
    vi.mocked(refreshStatusSources).mockResolvedValue(refreshedSources);
    vi.mocked(buildStatusPageTransitionNotifications).mockReturnValue([
      {
        source: "github",
        sourceEventId: "status-page:cursor:outage:2026-03-20T12:00:00.000Z",
        type: "status.outage",
        severity: "critical",
        title: "Cursor is down",
        body: "Changed from operational to down.",
        metadata: { sourceId: "cursor" },
      },
    ]);

    fetchMock.mockImplementation(
      createFetchMock(storedSources, storedSources, {
        settings: { "refresh-interval": 120 },
      })
    );

    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function renderPoller(overrides: Partial<Parameters<typeof StatusPageBackgroundPoller>[0]> = {}) {
    return render(
      createElement(StatusPageBackgroundPoller, {
        isDisabled: false,
        isLoading: false,
        projectIntegrations,
        fetchIntegrationStatusPageOverrides: async () => ({
          github: "https://www.githubstatus.com",
        }),
        deriveProjectHealthSources: () => storedSources,
        deriveLinkedStatusSources: () => [],
        ...overrides,
      })
    );
  }

  it("persists refreshed sources, emits notifications, and uses the configured interval", async () => {
    const setTimeoutSpy = vi.spyOn(window, "setTimeout");

    renderPoller();

    await waitFor(() => {
      expect(refreshStatusSources).toHaveBeenCalledWith(storedSources);
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/plugins/data",
        expect.objectContaining({ method: "PUT" })
      );
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/notifications/emit",
        expect.objectContaining({ method: "POST" })
      );
    });

    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 120_000);
  });

  it("does nothing when the plugin is disabled", () => {
    renderPoller({ isDisabled: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skips notification emission when plugin notifications are disabled", async () => {
    fetchMock.mockImplementation(
      createFetchMock(storedSources, storedSources, {
        settings: { "refresh-interval": 120 },
        notificationIntegrationEnabled: false,
      })
    );

    renderPoller();

    await waitFor(() => {
      expect(refreshStatusSources).toHaveBeenCalledWith(storedSources);
    });

    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/notifications/emit",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("includes derived project health sources in the refresh cycle", async () => {
    vi.mocked(mergeStatusPageSources).mockImplementation((_standalone, cached) => cached);

    renderPoller({
      deriveProjectHealthSources: () => [
        {
          id: "project:goshuin-atlas:goshuin-com",
          kind: "project",
          name: "goshuin.com",
          url: "https://goshuin.com",
          statusPageUrl: "https://goshuin.com",
          status: "unknown",
          lastCheckedAt: "2026-03-20T11:00:00.000Z",
          addedAt: "2026-03-20T10:00:00.000Z",
          remoteUpdatedAt: null,
          projectSlug: "goshuin-atlas",
          projectName: "Goshuin Atlas",
          platformId: "goshuin-com",
          platformName: "goshuin.com",
          integrationKey: "healthCheck",
        },
      ],
    });

    await waitFor(() => {
      expect(mergeStatusPageSources).toHaveBeenCalledWith(
        storedSources,
        expect.arrayContaining([
          expect.objectContaining({
            kind: "project",
            integrationKey: "healthCheck",
          }),
        ]),
        {}
      );
    });
  });
});
