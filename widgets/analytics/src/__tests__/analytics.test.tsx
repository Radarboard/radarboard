// @vitest-environment jsdom
import type { AnalyticsOverview } from "@radarboard/types/analytics";
import { Dialog, DialogContent } from "@radarboard/ui/app-dialog";
import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "../data-resolver";
import { analyticsDescriptor } from "..";
import { TopPageDetail } from "../components/top-page-detail";

const mockUseAnalytics = vi.fn();

vi.mock("../hooks/use-analytics", () => ({
  useAnalytics: (...args: unknown[]) => mockUseAnalytics(...args),
}));

const ANALYTICS_FIXTURE: AnalyticsOverview = {
  liveVisitors: 6,
  metrics: {
    uniqueVisitors: 546,
    totalSessions: 570,
    totalPageViews: 1527,
    bounceRate: 65,
    avgSessionDuration: 183,
  },
  topPages: Array.from({ length: 12 }, (_, index) => ({
    path: `/page-${index + 1}`,
    title: `Page ${index + 1}`,
    sessions: 120 - index,
    bounceRate: 40 + index,
    avgDuration: 60 + index,
    openPanelUrl: "https://dashboard.openpanel.dev/org_123/souls-directory/pages",
    platformName: "souls.directory",
    projectColor: "#8b5cf6",
  })),
  referrers: [
    { name: "google.com", sessions: 200, bounceRate: 45 },
    { name: "direct", sessions: 120, bounceRate: 30 },
  ],
  visitorTrend: [
    { date: "2026-03-18", value: 100 },
    { date: "2026-03-19", value: 120 },
  ],
};

describe("analyticsDescriptor", () => {
  beforeEach(() => {
    mockUseAnalytics.mockReturnValue({
      data: ANALYTICS_FIXTURE,
      configured: true,
      fetchedAt: 1_700_000_000,
      loading: false,
      error: null,
      refetch: vi.fn(async () => {}),
    });
  });

  it("uses a live-visitors headline and shows the range visitors in KPI cards", async () => {
    render(
      createElement(analyticsDescriptor.component, {
        projectSlug: "goshuin-atlas",
        config: analyticsDescriptor.defaultConfig,
        timeRange: "7d",
      })
    );

    expect(await screen.findByText("live visitors")).toBeTruthy();
    expect(screen.getByText("6")).toBeTruthy();
    expect(screen.getByText("Visitors")).toBeTruthy();
    expect(screen.getByText("546")).toBeTruthy();
    expect(screen.getByText("Avg Duration")).toBeTruthy();
    expect(screen.getByText("3m 3s")).toBeTruthy();
    expect(screen.queryByText("Bounce Rate")).toBeNull();
    expect(screen.getAllByText("souls.directory").length).toBeGreaterThan(0);
  });

  it("keeps the expanded summary alert realtime while KPIs stay range-based", async () => {
    const ExpandedAnalyticsComponent = analyticsDescriptor.expandedComponent;
    if (!ExpandedAnalyticsComponent) {
      throw new Error("Analytics widget must provide an expanded component");
    }

    render(
      createElement(ExpandedAnalyticsComponent, {
        projectSlug: "goshuin-atlas",
        config: analyticsDescriptor.defaultConfig,
        timeRange: "7d",
      })
    );

    expect(await screen.findByText("6 live visitors right now")).toBeTruthy();
    expect(screen.getAllByText("Visitors").length).toBeGreaterThan(0);
    expect(screen.getAllByText("546").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Avg Duration").length).toBeGreaterThan(0);
    expect(screen.getAllByText("3m 3s").length).toBeGreaterThan(0);
    expect(screen.queryByText("Bounce Rate")).toBeNull();
  });

  it("renders an OpenPanel link in the top page detail view", () => {
    render(
      createElement(
        Dialog,
        { open: true },
        createElement(
          DialogContent,
          { "aria-describedby": undefined },
          createElement(TopPageDetail, {
            page: ANALYTICS_FIXTURE.topPages[0] as NonNullable<
              typeof ANALYTICS_FIXTURE.topPages
            >[number],
          })
        )
      )
    );

    const openPanelLink = screen.getByRole("link", { name: "Open in OpenPanel →" });
    expect(openPanelLink.getAttribute("href")).toBe(
      "https://dashboard.openpanel.dev/org_123/souls-directory/pages"
    );
  });

  it("shows a project-settings CTA when OpenPanel credentials exist but no project is linked", async () => {
    const onConnectService = vi.fn();
    mockUseAnalytics.mockReturnValue({
      data: {
        configured: false,
        ctaLabel: "Open Project Settings",
        ctaTarget: "intent:openpanel-project",
        projectMappingRequired: true,
        setupMessage:
          "OpenPanel is connected, but no project is linked yet. Select an OpenPanel project in Project Settings.",
      },
      configured: false,
      fetchedAt: null,
      loading: false,
      error: null,
      refetch: vi.fn(async () => {}),
    });

    render(
      createElement(analyticsDescriptor.component, {
        projectSlug: "goshuin-atlas",
        config: analyticsDescriptor.defaultConfig,
        timeRange: "7d",
        onConnectService,
      })
    );

    expect(
      await screen.findByText(
        "OpenPanel is connected, but no project is linked yet. Select an OpenPanel project in Project Settings."
      )
    ).toBeTruthy();

    const button = screen.getByRole("button", { name: "Open Project Settings" });
    button.click();
    expect(onConnectService).toHaveBeenCalledWith("intent:openpanel-project");
  });
});
