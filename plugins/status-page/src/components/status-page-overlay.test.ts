// @vitest-environment jsdom

import { createMockPluginAPI } from "@radarboard/plugin-sdk/testing";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StatusSource } from "../types";
import { useStatusPage } from "../use-status-page";
import { StatusPageOverlay } from "./status-page-overlay";

const CI_FLAKE_TIMEOUT_MS = 15000;

vi.mock("../use-status-page", () => ({
  useStatusPage: vi.fn(),
}));

afterEach(() => {
  cleanup();
});

function buildSource(overrides: Partial<StatusSource>): StatusSource {
  return {
    id: "source",
    kind: "standalone",
    name: "Source",
    url: "https://source.example.com",
    statusPageUrl: "https://status.source.example.com",
    status: "operational",
    lastCheckedAt: "2026-03-20T12:00:00.000Z",
    addedAt: "2026-03-20T10:00:00.000Z",
    alertsEnabled: true,
    remoteUpdatedAt: null,
    projectSlug: null,
    projectName: null,
    platformId: null,
    platformName: null,
    integrationKey: null,
    linkedTargetCount: null,
    linkedTargetSummary: null,
    muted: false,
    disabled: false,
    ...overrides,
  };
}

describe("StatusPageOverlay", () => {
  const addSource = vi.fn();
  const removeSource = vi.fn();
  const toggleSourceMuted = vi.fn();
  const toggleSourceDisabled = vi.fn();
  const openSpy = vi.fn();

  function mockStatusPageSources(sources: StatusSource[]) {
    vi.mocked(useStatusPage).mockReturnValue({
      sources,
      loaded: true,
      addSource,
      removeSource,
      toggleSourceMuted,
      toggleSourceDisabled,
      operationalCount: sources.filter(
        (source) => !source.disabled && source.status === "operational"
      ).length,
      totalCount: sources.filter((source) => !source.disabled).length,
    });
  }

  beforeEach(() => {
    addSource.mockReset();
    removeSource.mockReset();
    toggleSourceMuted.mockReset();
    toggleSourceDisabled.mockReset();
    openSpy.mockReset();
    vi.stubGlobal("open", openSpy);

    mockStatusPageSources([
      buildSource({
        id: "cursor",
        name: "Cursor",
        status: "outage",
        url: "https://cursor.com",
        statusPageUrl: "https://status.cursor.com",
      }),
    ]);
  });

  it(
    "defaults to the monitor tab and groups visible issues by severity",
    async () => {
      mockStatusPageSources([
        buildSource({
          id: "cursor",
          name: "Cursor",
          status: "outage",
          url: "https://cursor.com",
          statusPageUrl: "https://status.cursor.com",
        }),
        buildSource({
          id: "github",
          kind: "integration",
          name: "GitHub",
          status: "degraded",
          url: "https://www.githubstatus.com",
          statusPageUrl: "https://www.githubstatus.com",
          linkedTargetSummary: "radarboard",
        }),
        buildSource({
          id: "npm",
          name: "NPM",
          status: "unknown",
          url: "https://status.npmjs.org",
          statusPageUrl: "https://status.npmjs.org",
        }),
        buildSource({
          id: "claude",
          name: "Claude",
          status: "operational",
          url: "https://claude.ai",
          statusPageUrl: "https://status.anthropic.com",
        }),
        buildSource({
          id: "site",
          kind: "project",
          name: "thedaviddias.com",
          status: "outage",
          url: "https://thedaviddias.com",
          statusPageUrl: "https://thedaviddias.com",
          disabled: true,
        }),
      ]);

      render(createElement(StatusPageOverlay, { api: createMockPluginAPI() }));
      const monitorPanel = await screen.findByRole("tabpanel");

      expect(screen.getByRole("tab", { name: /Monitor/i }).getAttribute("aria-selected")).toBe(
        "true"
      );
      expect(within(monitorPanel).getByRole("button", { name: /^Cursor/i })).toBeTruthy();
      expect(within(monitorPanel).getByRole("button", { name: /^GitHub/i })).toBeTruthy();
      expect(within(monitorPanel).getByRole("button", { name: /^NPM/i })).toBeTruthy();
      expect(within(monitorPanel).queryByRole("button", { name: /^Claude/i })).toBeNull();
      expect(
        within(monitorPanel).queryByRole("button", { name: /^thedaviddias\.com/i })
      ).toBeNull();
      expect(within(monitorPanel).getByText("Collapsed Healthy Services")).toBeTruthy();
      expect(within(monitorPanel).getByText("Disabled sources")).toBeTruthy();

      const content = monitorPanel.textContent ?? "";
      expect(content.indexOf("Outages")).toBeLessThan(content.indexOf("Degraded"));
      expect(content.indexOf("Degraded")).toBeLessThan(content.indexOf("Unknown"));
    },
    CI_FLAKE_TIMEOUT_MS
  );

  it("shows all systems operational when only healthy active services remain", () => {
    mockStatusPageSources([
      buildSource({
        id: "claude",
        name: "Claude",
        status: "operational",
        url: "https://claude.ai",
        statusPageUrl: "https://status.anthropic.com",
      }),
      buildSource({
        id: "github",
        kind: "integration",
        name: "GitHub",
        status: "operational",
        url: "https://www.githubstatus.com",
        statusPageUrl: "https://www.githubstatus.com",
        linkedTargetSummary: "radarboard",
      }),
      buildSource({
        id: "site",
        kind: "project",
        name: "thedaviddias.com",
        status: "outage",
        url: "https://thedaviddias.com",
        statusPageUrl: "https://thedaviddias.com",
        disabled: true,
      }),
    ]);

    render(createElement(StatusPageOverlay, { api: createMockPluginAPI() }));
    const monitorPanel = screen.getByRole("tabpanel");

    expect(screen.getByText("2/2")).toBeTruthy();
    expect(within(monitorPanel).getByText("All systems operational")).toBeTruthy();
    expect(within(monitorPanel).queryByRole("button", { name: /^Claude/i })).toBeNull();
    expect(within(monitorPanel).queryByRole("button", { name: /^GitHub/i })).toBeNull();
    expect(within(monitorPanel).getByText("Collapsed Healthy Services")).toBeTruthy();
    expect(within(monitorPanel).getByText("Disabled sources")).toBeTruthy();
  });

  it(
    "shows the grouped inventory and add source action in the sources tab",
    async () => {
      const user = userEvent.setup();

      mockStatusPageSources([
        buildSource({
          id: "site",
          kind: "project",
          name: "thedaviddias.com",
          status: "outage",
          url: "https://thedaviddias.com",
          statusPageUrl: "https://thedaviddias.com",
        }),
        buildSource({
          id: "cursor",
          name: "Cursor",
          status: "outage",
          url: "https://cursor.com",
          statusPageUrl: "https://status.cursor.com",
        }),
        buildSource({
          id: "github",
          kind: "integration",
          name: "GitHub",
          status: "operational",
          url: "https://www.githubstatus.com",
          statusPageUrl: "https://www.githubstatus.com",
          linkedTargetSummary: "radarboard",
        }),
        buildSource({
          id: "site-disabled",
          kind: "project",
          name: "old-project",
          status: "unknown",
          url: "https://old-project.example.com",
          statusPageUrl: "https://status.old-project.example.com",
          disabled: true,
        }),
      ]);

      render(createElement(StatusPageOverlay, { api: createMockPluginAPI() }));

      expect(screen.queryByRole("button", { name: "Add Source" })).toBeNull();

      await user.click(screen.getByRole("tab", { name: /Sources/i }));
      await waitFor(() =>
        expect(screen.getByRole("tab", { name: /Sources/i }).getAttribute("aria-selected")).toBe(
          "true"
        )
      );
      const sourcesPanel = await screen.findByRole("tabpanel");

      expect(await screen.findByPlaceholderText("Search sources...")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Add Source" })).toBeTruthy();
      expect(within(sourcesPanel).getByText("Project Health")).toBeTruthy();
      expect(within(sourcesPanel).getByText("Manual Sources")).toBeTruthy();
      expect(within(sourcesPanel).getByText("Linked Integrations")).toBeTruthy();
      expect(within(sourcesPanel).getByText("Disabled")).toBeTruthy();
      expect(within(sourcesPanel).getByRole("button", { name: /^Cursor/i })).toBeTruthy();
      expect(within(sourcesPanel).getByRole("button", { name: /^GitHub/i })).toBeTruthy();
      expect(
        within(sourcesPanel).getByRole("button", { name: /^thedaviddias\.com/i })
      ).toBeTruthy();
      expect(within(sourcesPanel).getByRole("button", { name: /^old-project/i })).toBeTruthy();
    },
    CI_FLAKE_TIMEOUT_MS
  );

  it(
    "keeps management actions in the sources tab only",
    async () => {
      const user = userEvent.setup();

      render(createElement(StatusPageOverlay, { api: createMockPluginAPI() }));

      expect(screen.queryByRole("button", { name: /Open actions for Cursor/i })).toBeNull();

      await user.click(screen.getByRole("tab", { name: /Sources/i }));
      await waitFor(() =>
        expect(screen.getByRole("tab", { name: /Sources/i }).getAttribute("aria-selected")).toBe(
          "true"
        )
      );
      const sourcesPanel = await screen.findByRole("tabpanel");

      await user.click(
        within(sourcesPanel).getByRole("button", { name: /Open actions for Cursor/i })
      );
      await user.click(screen.getByRole("button", { name: "Mute alerts" }));
      expect(toggleSourceMuted).toHaveBeenCalledWith("cursor");

      await user.click(
        within(sourcesPanel).getByRole("button", { name: /Open actions for Cursor/i })
      );
      await user.click(screen.getByRole("button", { name: "Disable source" }));
      expect(toggleSourceDisabled).toHaveBeenCalledWith("cursor");

      await user.click(
        within(sourcesPanel).getByRole("button", { name: /Open actions for Cursor/i })
      );
      await user.click(screen.getByRole("button", { name: "Remove" }));
      expect(removeSource).toHaveBeenCalledWith("cursor");
    },
    CI_FLAKE_TIMEOUT_MS
  );

  it("opens the status page from rows in both tabs", async () => {
    const user = userEvent.setup();

    render(createElement(StatusPageOverlay, { api: createMockPluginAPI() }));
    const monitorPanel = screen.getByRole("tabpanel");

    await user.click(within(monitorPanel).getByRole("button", { name: /^Cursor/i }));
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenLastCalledWith(
      "https://status.cursor.com",
      "_blank",
      "noopener,noreferrer"
    );

    await user.click(screen.getByRole("tab", { name: /Sources/i }));
    const sourcesPanel = screen.getByRole("tabpanel");
    await user.click(within(sourcesPanel).getByRole("button", { name: /^Cursor/i }));

    expect(openSpy).toHaveBeenCalledTimes(2);
    expect(openSpy).toHaveBeenLastCalledWith(
      "https://status.cursor.com",
      "_blank",
      "noopener,noreferrer"
    );
  });

  it("filters the sources inventory with search", async () => {
    const user = userEvent.setup();

    mockStatusPageSources([
      buildSource({
        id: "cursor",
        name: "Cursor",
        status: "outage",
        url: "https://cursor.com",
        statusPageUrl: "https://status.cursor.com",
      }),
      buildSource({
        id: "github",
        kind: "integration",
        name: "GitHub",
        status: "operational",
        url: "https://www.githubstatus.com",
        statusPageUrl: "https://www.githubstatus.com",
        linkedTargetSummary: "radarboard",
      }),
    ]);

    render(createElement(StatusPageOverlay, { api: createMockPluginAPI() }));

    await user.click(screen.getByRole("tab", { name: /Sources/i }));
    await user.type(screen.getByPlaceholderText("Search sources..."), "git");
    const sourcesPanel = screen.getByRole("tabpanel");

    expect(within(sourcesPanel).getByRole("button", { name: /^GitHub/i })).toBeTruthy();
    expect(within(sourcesPanel).queryByRole("button", { name: /^Cursor/i })).toBeNull();
    expect(screen.getByText("1 of 2 services")).toBeTruthy();
  });
});
