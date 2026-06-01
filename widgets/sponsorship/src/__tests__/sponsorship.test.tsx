// @vitest-environment jsdom
import type { Project } from "@radarboard/types/project";
import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "../data-resolver";
import { sponsorshipDescriptor } from "..";

const mockUseDashboard = vi.fn();
const mockUseOpenCollective = vi.fn();
const mockUseGitHubSponsors = vi.fn();

vi.mock("@radarboard/hooks/use-dashboard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@radarboard/hooks/use-dashboard")>();
  return {
    ...actual,
    useDashboard: () => mockUseDashboard(),
  };
});

vi.mock("../hooks/use-open-collective", () => ({
  useOpenCollective: (...args: unknown[]) => mockUseOpenCollective(...args),
}));

vi.mock("../hooks/use-github-sponsors", () => ({
  useGitHubSponsors: (...args: unknown[]) => mockUseGitHubSponsors(...args),
}));

const PROJECTS: Project[] = [
  {
    id: "1",
    name: "Goshuin Atlas",
    slug: "goshuin-atlas",
    color: "#ff4f6d",
    platforms: [
      {
        id: "platform-web",
        name: "Web",
        type: "website",
        integrations: {
          openCollective: { slug: "goshuin-atlas" },
          github: { owner: "thedaviddias", repo: "goshuin-atlas" },
        },
      },
    ],
  },
];

describe("sponsorshipDescriptor", () => {
  beforeEach(() => {
    mockUseDashboard.mockReturnValue({ projects: PROJECTS });
    mockUseOpenCollective.mockReturnValue({
      data: {
        stats: {
          balance: 125000,
          totalRaised: 300000,
          totalExpenses: 50000,
          yearlyBudget: 240000,
          currency: "USD",
          backersCount: 12,
          contributorsCount: 3,
          sparklineData: [
            { timestamp: "2026-03-17", value: 200 },
            { timestamp: "2026-03-18", value: 350 },
          ],
        },
        recentTransactions: [],
        topMembers: [],
      },
      configured: true,
      fetchedAt: 1_700_000_000,
      loading: false,
      error: null,
      refetch: vi.fn(async () => {}),
    });
    mockUseGitHubSponsors.mockReturnValue({
      data: {
        stats: {
          monthlyIncome: 45000,
          sponsorCount: 7,
          currency: "USD",
        },
        sponsors: [],
        tiers: [],
        goal: null,
        limitedAccess: false,
      },
      configured: true,
      fetchedAt: 1_700_000_100,
      loading: false,
      error: null,
      refetch: vi.fn(async () => {}),
    });
  });

  it("renders the same four-card summary in compact view", async () => {
    render(
      createElement(sponsorshipDescriptor.component, {
        projectSlug: "goshuin-atlas",
        config: {},
      })
    );

    expect(await screen.findByText("Monthly Income")).toBeTruthy();
    expect(screen.getByText("Total Sponsors")).toBeTruthy();
    expect(screen.getByText("OC Balance")).toBeTruthy();
    expect(screen.getByText("Donations")).toBeTruthy();
  });

  it("renders the same four-card summary in expanded view", async () => {
    const ExpandedSponsorshipComponent = sponsorshipDescriptor.expandedComponent;
    if (!ExpandedSponsorshipComponent) {
      throw new Error("Sponsorship widget must provide an expanded component");
    }

    render(
      createElement(ExpandedSponsorshipComponent, {
        projectSlug: "goshuin-atlas",
        config: {},
      })
    );

    expect((await screen.findAllByText("Monthly Income")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Total Sponsors").length).toBeGreaterThan(0);
    expect(screen.getAllByText("OC Balance").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Donations").length).toBeGreaterThan(0);
    expect(screen.getByRole("tab", { name: /Sponsors \(0\)/i })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Backers \(0\)/i })).toBeTruthy();
  });

  it("renders the not-configured state when no sponsorship provider is connected", async () => {
    mockUseOpenCollective.mockReturnValue({
      data: null,
      configured: false,
      fetchedAt: null,
      loading: false,
      error: null,
      refetch: vi.fn(async () => {}),
    });
    mockUseGitHubSponsors.mockReturnValue({
      data: null,
      configured: false,
      fetchedAt: null,
      loading: false,
      error: null,
      refetch: vi.fn(async () => {}),
    });

    render(
      createElement(sponsorshipDescriptor.component, {
        projectSlug: "goshuin-atlas",
        config: {},
      })
    );

    expect(
      await screen.findByText(
        "Connect GitHub Sponsors or Open Collective to enable sponsorship data."
      )
    ).toBeTruthy();
    expect(screen.queryByText("Monthly Income")).toBeNull();
  });
});
