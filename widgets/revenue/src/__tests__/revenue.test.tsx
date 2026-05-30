// @vitest-environment jsdom
import type { Project } from "@radarboard/types/project";
import type { RevenueOverview } from "@radarboard/types/revenue";
import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "../data-resolver";
import { revenueDescriptor } from "..";

const mockUseDashboard = vi.fn();
const mockUseRevenue = vi.fn();

vi.mock("@radarboard/hooks/use-dashboard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@radarboard/hooks/use-dashboard")>();
  return {
    ...actual,
    useDashboard: () => mockUseDashboard(),
  };
});

vi.mock("../hooks/use-revenue", () => ({
  useRevenue: (...args: unknown[]) => mockUseRevenue(...args),
}));

const PROJECTS: Project[] = [
  {
    id: "1",
    name: "Goshuin Atlas",
    slug: "goshuin-atlas",
    color: "#ff4f6d",
    platforms: [],
  },
];

const REVENUE: RevenueOverview = {
  grossRevenue: {
    value: 120000,
    previousValue: 100000,
    currency: "USD",
    sparklineData: [
      { date: "2026-03-17", value: 1 },
      { date: "2026-03-18", value: 2 },
    ],
  },
  mrr: {
    value: 42000,
    previousValue: 40000,
    currency: "USD",
    sparklineData: [
      { date: "2026-03-17", value: 1 },
      { date: "2026-03-18", value: 2 },
    ],
  },
  netRevenue: {
    value: 95000,
    previousValue: 91000,
    currency: "USD",
    sparklineData: [
      { date: "2026-03-17", value: 1 },
      { date: "2026-03-18", value: 2 },
    ],
  },
  lastPayment: {
    amount: 2500,
    currency: "USD",
    country: "US",
    countryCode: "US",
    projectName: "Goshuin Atlas",
    projectColor: "#ff4f6d",
    timeAgo: "2h ago",
  },
};

describe("revenueDescriptor", () => {
  beforeEach(() => {
    mockUseDashboard.mockReturnValue({
      timeRange: "30d",
      currency: "USD",
      projects: PROJECTS,
    });
    mockUseRevenue.mockReturnValue({
      data: REVENUE,
      series: [],
      raw: { newCustomers: 14, activeUsers: 220 },
      configured: true,
      fetchedAt: 1_700_000_000,
      loading: false,
      error: null,
      refetch: vi.fn(async () => {}),
    });
  });

  it("renders the same four-card summary in compact view", async () => {
    render(
      createElement(revenueDescriptor.component, { projectSlug: "goshuin-atlas", config: {} })
    );

    expect(await screen.findByText("Gross Revenue")).toBeTruthy();
    expect(screen.getByText("MRR")).toBeTruthy();
    expect(screen.getByText("Last Payment")).toBeTruthy();
    expect(screen.getByText("Net Revenue")).toBeTruthy();
    expect(screen.getByText("goshuin-atlas")).toBeTruthy();
  });

  it("renders the same four-card summary in expanded view", async () => {
    const ExpandedRevenueComponent = revenueDescriptor.expandedComponent;
    if (!ExpandedRevenueComponent) {
      throw new Error("Revenue widget must provide an expanded component");
    }

    render(
      createElement(ExpandedRevenueComponent, {
        projectSlug: "goshuin-atlas",
        config: {},
      })
    );

    expect((await screen.findAllByText("Gross Revenue")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("MRR").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Last Payment").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Net Revenue").length).toBeGreaterThan(0);
    expect(screen.getByText("New Customers")).toBeTruthy();
    expect(screen.getByText("Active Users")).toBeTruthy();
  });

  it("shows a project-settings CTA when RevenueCat credentials exist but no project is linked", async () => {
    const onConnectService = vi.fn();
    mockUseRevenue.mockReturnValue({
      data: {
        configured: false,
        ctaLabel: "Open Project Settings",
        ctaTarget: "intent:revenuecat-project",
        projectMappingRequired: true,
        setupMessage:
          "RevenueCat is connected, but no project is linked yet. Add a RevenueCat project ID in Project Settings.",
      },
      series: [],
      raw: null,
      configured: false,
      fetchedAt: null,
      loading: false,
      error: null,
      refetch: vi.fn(async () => {}),
    });

    render(
      createElement(revenueDescriptor.component, {
        projectSlug: "goshuin-atlas",
        config: {},
        onConnectService,
      })
    );

    expect(
      await screen.findByText(
        "RevenueCat is connected, but no project is linked yet. Add a RevenueCat project ID in Project Settings."
      )
    ).toBeTruthy();

    screen.getByRole("button", { name: "Open Project Settings" }).click();
    expect(onConnectService).toHaveBeenCalledWith("intent:revenuecat-project");
  });
});
