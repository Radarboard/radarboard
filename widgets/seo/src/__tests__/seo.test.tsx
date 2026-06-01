// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../data-resolver";
import { seoDescriptor } from "..";
import { SEO_TEMPLATE_CONFIG } from "../components/seo-compact";

const mockUseSeo = vi.fn();
const mockUseDemoMode = vi.fn(() => ({ isDemoMode: false }));

vi.mock("../hooks/use-seo", () => ({
  useSeo: (...args: unknown[]) => mockUseSeo(...args),
}));

vi.mock("@radarboard/hooks/use-demo-mode", () => ({
  useDemoMode: () => mockUseDemoMode(),
}));

const STALE_SEO_CONFIG = {
  dataSources: [{ id: "seo" }],
  sections: [
    {
      type: "stack",
      sections: [
        {
          type: "kpi-row",
          columns: 4,
          variant: "compact",
          metrics: [
            {
              label: "Clicks",
              source: { sourceId: "seo", field: "totalClicks", format: "number" },
            },
            {
              label: "Impressions",
              source: { sourceId: "seo", field: "totalImpressions", format: "number" },
            },
            {
              label: "CTR",
              source: { sourceId: "seo", field: "avgCtr", format: "percent" },
            },
            {
              label: "Position",
              source: { sourceId: "seo", field: "avgPosition", format: "number" },
            },
          ],
        },
        {
          type: "list",
          source: { sourceId: "source", field: "items" },
          itemTemplate: {
            title: { sourceId: "source", field: "label" },
            subtitle: { sourceId: "source", field: "meta" },
          },
        },
      ],
    },
  ],
};

describe("seoDescriptor", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    mockUseDemoMode.mockReturnValue({ isDemoMode: false });
    mockUseSeo.mockReturnValue({
      data: {
        queries: [
          {
            query: "goshuin atlas",
            clicks: 42,
            impressions: 320,
            ctr: 13.1,
            position: 4.802,
            projectColor: "#ff4f6d",
            siteUrl: "https://goshuin.app",
          },
        ],
        clicksTrend: [],
        impressionsTrend: [],
        totalClicks: 42,
        totalImpressions: 18000,
        avgCtr: 13.1,
        avgPosition: 4.802,
        latestAvailableDate: "2026-03-16",
      },
      configured: true,
      fetchedAt: 1_700_000_000,
      loading: false,
      refetch: vi.fn(async () => {}),
    });
  });

  it("passes demo mode into the seo hook", async () => {
    mockUseDemoMode.mockReturnValue({ isDemoMode: true });

    render(
      createElement(seoDescriptor.component, {
        projectSlug: "goshuin-atlas",
        config: seoDescriptor.defaultConfig,
        timeRange: "today",
      })
    );

    await screen.findByText("goshuin atlas");
    expect(mockUseSeo).toHaveBeenCalledWith("goshuin-atlas", null, "today", true);
  });

  it("renders compact seo metrics and query rows from the template path", async () => {
    render(
      createElement(seoDescriptor.component, {
        projectSlug: "goshuin-atlas",
        config: seoDescriptor.defaultConfig,
        timeRange: "today",
      })
    );

    expect((await screen.findAllByText("Clicks")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Impressions").length).toBeGreaterThan(0);
    expect(screen.getByText("CTR")).toBeTruthy();
    expect(screen.getByText("Position")).toBeTruthy();
    expect(screen.getByText("Impr")).toBeTruthy();
    expect(screen.getByText("Pos")).toBeTruthy();
    expect(screen.getByText("goshuin atlas")).toBeTruthy();
    expect(screen.getAllByText("42").length).toBeGreaterThan(0);
    expect(screen.getByText("18.0K")).toBeTruthy();
    expect(screen.getAllByText("4.8").length).toBeGreaterThan(0);
    expect(screen.queryByText("4.802")).toBeNull();
  });

  it("falls back to the default seo template when persisted config points at a placeholder source", async () => {
    render(
      createElement(seoDescriptor.component, {
        projectSlug: "goshuin-atlas",
        config: STALE_SEO_CONFIG,
        timeRange: "today",
      })
    );

    expect(await screen.findByText("goshuin atlas")).toBeTruthy();
    expect(screen.getByText("Impr")).toBeTruthy();
    expect(screen.getByText("Pos")).toBeTruthy();
    expect(screen.queryByText("No items")).toBeNull();
  });

  it("returns the default template config to the visual editor when persisted seo config is stale", () => {
    const editorConfig = seoDescriptor.visualEditor?.getConfig({
      projectSlug: null,
      projects: [],
      config: STALE_SEO_CONFIG,
    });

    expect(editorConfig).toEqual(SEO_TEMPLATE_CONFIG);
  });

  it("reports disconnected chrome state when search console is not configured", async () => {
    mockUseSeo.mockReturnValue({
      data: null,
      configured: false,
      fetchedAt: null,
      loading: false,
      refetch: vi.fn(async () => {}),
      error: null,
    });

    const onChromeStateChange = vi.fn();

    render(
      createElement(seoDescriptor.component, {
        widgetId: "seo",
        projectSlug: "goshuin-atlas",
        config: seoDescriptor.defaultConfig,
        timeRange: "today",
        onChromeStateChange,
      })
    );

    expect(await screen.findByText("Google Search Console not connected")).toBeTruthy();
    await waitFor(() => {
      expect(onChromeStateChange).toHaveBeenCalledWith("disconnected");
    });
  });

  it("shows a project-settings CTA when search console credentials exist but no site is linked", async () => {
    const onConnectService = vi.fn();
    mockUseSeo.mockReturnValue({
      data: {
        configured: false,
        ctaLabel: "Open Project Settings",
        ctaTarget: "intent:google-search-console-project",
        projectMappingRequired: true,
        setupMessage:
          "Google Search Console is connected, but no site is linked yet. Add a site URL in Project Settings.",
      },
      configured: false,
      fetchedAt: null,
      loading: false,
      refetch: vi.fn(async () => {}),
      error: null,
    });

    render(
      createElement(seoDescriptor.component, {
        projectSlug: "goshuin-atlas",
        config: seoDescriptor.defaultConfig,
        timeRange: "today",
        onConnectService,
      })
    );

    expect(
      await screen.findByText(
        "Google Search Console is connected, but no site is linked yet. Add a site URL in Project Settings."
      )
    ).toBeTruthy();

    screen.getByRole("button", { name: "Open Project Settings" }).click();
    expect(onConnectService).toHaveBeenCalledWith("intent:google-search-console-project");
  });
});
