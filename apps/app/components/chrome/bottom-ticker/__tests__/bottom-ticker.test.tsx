// @vitest-environment jsdom
import { useDashboard } from "@radarboard/hooks/use-dashboard";
import { useRoutingConfig } from "@radarboard/hooks/use-routing-config";
import { getPluginToken } from "@radarboard/plugin-sdk/host";
import type { Project } from "@radarboard/types/project";
import { useHealth } from "@radarboard/widget-observability";
import { useShipping } from "@radarboard/widget-shipping";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BottomTicker } from "../";

vi.mock("@radarboard/hooks/use-dashboard", async () => {
  const React = await import("react");
  return {
    useDashboard: vi.fn(),
    DashboardContext: React.createContext(null),
  };
});

vi.mock("@radarboard/widget-observability", () => ({
  useHealth: vi.fn(),
}));

vi.mock("@radarboard/hooks/use-routing-config", () => ({
  useRoutingConfig: vi.fn(),
}));

vi.mock("@radarboard/widget-shipping", () => ({
  useShipping: vi.fn(),
}));

vi.mock("@radarboard/plugin-sdk/host", () => ({
  getPluginToken: vi.fn(async () => "test-token"),
}));

const PROJECTS: Project[] = [
  {
    id: "cursor",
    name: "Cursor",
    slug: "cursor",
    color: "#f97316",
    description: "",
    platforms: [],
  },
];

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function createFetchMock(
  config: Record<string, unknown>,
  sources: unknown[],
  rssItems: unknown[] = [],
  rssFeeds: unknown[] = []
): typeof fetch {
  return vi.fn(async (input) => {
    const url = String(input);
    if (url.includes("key=_config")) {
      return jsonResponse({ value: JSON.stringify(config) });
    }
    if (url.includes("key=status%3Acache") || url.includes("key=status:cache")) {
      return jsonResponse({ value: JSON.stringify(sources) });
    }
    if (url.includes("key=rss%3Aitems") || url.includes("key=rss:items")) {
      return jsonResponse({ value: JSON.stringify(rssItems) });
    }
    if (url.includes("key=rss%3Afeeds") || url.includes("key=rss:feeds")) {
      return jsonResponse({ value: JSON.stringify(rssFeeds) });
    }
    throw new Error(`Unexpected fetch request: ${url}`);
  }) as typeof fetch;
}

function renderTicker(projectSlug: string | null = null) {
  return render(
    createElement(
      SWRConfig,
      { value: { provider: () => new Map(), dedupingInterval: 0 } },
      createElement(BottomTicker, { projectSlug })
    )
  );
}

describe("BottomTicker", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.mocked(getPluginToken).mockResolvedValue("test-token");
    vi.mocked(useDashboard).mockReturnValue({
      projects: PROJECTS,
      appearance: {
        ticker: {
          speed: "normal",
          showHealthAlerts: true,
          sources: {
            github: true,
            linear: true,
            vercel: true,
            manual: true,
          },
        },
      },
      timeRange: "today",
    } as ReturnType<typeof useDashboard>);

    vi.mocked(useHealth).mockReturnValue({
      checks: [],
    } as ReturnType<typeof useHealth>);

    vi.mocked(useShipping).mockReturnValue({
      items: [],
    } as ReturnType<typeof useShipping>);

    vi.mocked(useRoutingConfig).mockReturnValue({
      routingConfig: {
        rules: [],
      },
      loading: false,
      error: null,
      saveRoutingConfig: vi.fn(),
      refetch: vi.fn(),
    } as ReturnType<typeof useRoutingConfig>);

    vi.stubGlobal(
      "fetch",
      createFetchMock(
        {
          tickerIntegrationEnabled: true,
        },
        [
          {
            id: "cursor-api",
            kind: "integration",
            name: "Cursor API",
            status: "outage",
          },
        ]
      )
    );
  });

  it("renders status-page outage alerts in the ticker", async () => {
    renderTicker();

    await waitFor(() => {
      expect(screen.getByText("OUTAGE: Cursor API")).toBeTruthy();
    });
  });

  it("respects the health-alert visibility setting", async () => {
    vi.mocked(useDashboard).mockReturnValue({
      projects: PROJECTS,
      appearance: {
        ticker: {
          speed: "normal",
          showHealthAlerts: false,
          sources: {
            github: true,
            linear: true,
            vercel: true,
            manual: true,
          },
        },
      },
      timeRange: "today",
    } as ReturnType<typeof useDashboard>);

    renderTicker();

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled();
    });

    expect(screen.queryByText("OUTAGE: Cursor API")).toBeNull();
  });

  it("filters RSS items by the active time range", async () => {
    vi.mocked(useDashboard).mockReturnValue({
      projects: PROJECTS,
      appearance: {
        ticker: {
          speed: "normal",
          showHealthAlerts: true,
          sources: {
            github: true,
            linear: true,
            vercel: true,
            manual: true,
          },
        },
      },
      timeRange: "7d",
    } as ReturnType<typeof useDashboard>);

    vi.stubGlobal(
      "fetch",
      createFetchMock(
        {
          tickerIntegrationEnabled: true,
        },
        [],
        [
          {
            id: "rss-recent",
            feedId: "feed-1",
            title: "Range-aware feed item",
            link: "https://example.com/recent",
            publishedAt: new Date().toISOString(),
            read: false,
          },
          {
            id: "rss-old",
            feedId: "feed-1",
            title: "Too old for the current range",
            link: "https://example.com/old",
            publishedAt: new Date(0).toISOString(),
            read: false,
          },
        ],
        [{ id: "feed-1", name: "Example Feed" }]
      )
    );

    renderTicker();

    expect((await screen.findAllByText("Range-aware feed item")).length).toBeGreaterThan(2);
    await waitFor(() => {
      expect(screen.queryByText("Too old for the current range")).toBeNull();
    });
  });

  it("hides status-page alerts when ticker integration is disabled", async () => {
    vi.stubGlobal(
      "fetch",
      createFetchMock(
        {
          tickerIntegrationEnabled: false,
        },
        [
          {
            id: "cursor-api",
            kind: "integration",
            name: "Cursor API",
            status: "outage",
          },
        ]
      )
    );

    renderTicker();

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled();
    });

    expect(screen.queryByText("OUTAGE: Cursor API")).toBeNull();
  });

  it("hides disabled status-page alerts from the ticker", async () => {
    vi.stubGlobal(
      "fetch",
      createFetchMock(
        {
          tickerIntegrationEnabled: true,
        },
        [
          {
            id: "cursor-api",
            kind: "integration",
            name: "Cursor API",
            status: "outage",
            disabled: true,
          },
        ]
      )
    );

    renderTicker();

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled();
    });

    expect(screen.queryByText("OUTAGE: Cursor API")).toBeNull();
  });

  it("allows a ticker item when routing explicitly overrides a disabled source", async () => {
    vi.mocked(useDashboard).mockReturnValue({
      projects: PROJECTS,
      appearance: {
        ticker: {
          speed: "normal",
          showHealthAlerts: true,
          sources: {
            github: false,
            linear: true,
            vercel: true,
            manual: true,
          },
        },
      },
      timeRange: "today",
    } as ReturnType<typeof useDashboard>);

    vi.mocked(useShipping).mockReturnValue({
      items: [
        {
          id: "gh-1",
          title: "Ship routing rules",
          projectName: "Cursor",
          projectColor: "#f97316",
          source: "github",
          url: "https://github.com/example/pull/1",
          createdAt: "2026-03-20T12:00:00.000Z",
          timeAgo: "1h",
        },
      ],
    } as ReturnType<typeof useShipping>);

    vi.mocked(useRoutingConfig).mockReturnValue({
      routingConfig: {
        rules: [
          {
            id: "allow-github",
            name: "Allow GitHub in ticker",
            enabled: true,
            source: "github",
            eventType: "pr.merged",
            severity: null,
            projectSlug: null,
            condition: null,
            notifications: "inherit",
            ticker: "allow",
            createdAt: 1,
            updatedAt: 1,
          },
        ],
      },
      loading: false,
      error: null,
      saveRoutingConfig: vi.fn(),
      refetch: vi.fn(),
    } as ReturnType<typeof useRoutingConfig>);

    renderTicker();

    expect((await screen.findAllByText("Ship routing rules")).length).toBeGreaterThan(2);
  });

  it("hides a ticker item when routing denies an otherwise enabled source", async () => {
    vi.mocked(useShipping).mockReturnValue({
      items: [
        {
          id: "gh-2",
          title: "Suppress routine merge",
          projectName: "Cursor",
          projectColor: "#f97316",
          source: "github",
          url: "https://github.com/example/pull/2",
          createdAt: "2026-03-20T12:00:00.000Z",
          timeAgo: "1h",
        },
      ],
    } as ReturnType<typeof useShipping>);

    vi.mocked(useRoutingConfig).mockReturnValue({
      routingConfig: {
        rules: [
          {
            id: "deny-github",
            name: "Hide GitHub merges",
            enabled: true,
            source: "github",
            eventType: "pr.merged",
            severity: null,
            projectSlug: null,
            condition: null,
            notifications: "inherit",
            ticker: "deny",
            createdAt: 1,
            updatedAt: 1,
          },
        ],
      },
      loading: false,
      error: null,
      saveRoutingConfig: vi.fn(),
      refetch: vi.fn(),
    } as ReturnType<typeof useRoutingConfig>);

    renderTicker();

    await waitFor(() => {
      expect(screen.queryByText("Suppress routine merge")).toBeNull();
    });
    expect(screen.getAllByText("No recent activity")).toHaveLength(1);
  });
});
