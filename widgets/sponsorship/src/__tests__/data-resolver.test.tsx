// @vitest-environment jsdom

import { DATA_SOURCE_REGISTRY } from "@radarboard/widget-sdk/data-source-registry";
import { render, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "../data-resolver";

const useDashboardMock = vi.fn();
const useOpenCollectiveMock = vi.fn();
const useGitHubSponsorsMock = vi.fn();

vi.mock("@radarboard/hooks/use-dashboard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@radarboard/hooks/use-dashboard")>();
  return {
    ...actual,
    useDashboard: () => useDashboardMock(),
  };
});

vi.mock("../hooks/use-open-collective", () => ({
  useOpenCollective: (...args: unknown[]) => useOpenCollectiveMock(...args),
}));

vi.mock("../hooks/use-github-sponsors", () => ({
  useGitHubSponsors: (...args: unknown[]) => useGitHubSponsorsMock(...args),
}));

vi.mock("@radarboard/utils/project-helpers", () => ({
  resolveOcSlug: vi.fn(() => "radarboard"),
  resolveGitHubLogin: vi.fn(() => "thedaviddias"),
}));

describe("sponsorship data resolver", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDashboardMock.mockReturnValue({ projects: [], timeRange: "30d" });
    useOpenCollectiveMock.mockReturnValue({
      data: {
        stats: {
          yearlyBudget: 240000,
          balance: 50000,
          currency: "USD",
          backersCount: 2,
          sparklineData: [{ value: 1000 }],
        },
        recentTransactions: [
          {
            id: "txn-1",
            description: "",
            type: "CREDIT",
            fromAccount: { name: "Alice" },
            toAccount: { name: "Org" },
            amount: 900,
          },
        ],
        topMembers: [
          {
            id: "member-1",
            account: { name: "Alice" },
            tier: "Gold",
            role: "BACKER",
            totalDonated: 4000,
          },
        ],
      },
      fetchedAt: 200,
      loading: false,
      error: null,
      refetch: vi.fn(async () => {}),
    });
    useGitHubSponsorsMock.mockReturnValue({
      data: {
        stats: { monthlyIncome: 1200, sponsorCount: 1, currency: "USD" },
        sponsors: [
          {
            login: "alice",
            name: "Alice",
            tier: { name: "Pro", monthlyPriceInCents: 500 },
          },
        ],
        tiers: [{ id: "tier-1", name: "Pro", monthlyPriceInCents: 500, sponsorCount: 1 }],
        goal: { title: "Fund OSS", targetValue: 10000, percentComplete: 12 },
        limitedAccess: true,
      },
      fetchedAt: 250,
      loading: true,
      error: "github limited",
      refetch: vi.fn(async () => {}),
    });
  });

  it("combines github sponsors and open collective data into a unified summary", async () => {
    const Resolver = DATA_SOURCE_REGISTRY.get("sponsorship");
    const onState = vi.fn();

    if (!Resolver) throw new Error("sponsorship resolver not registered");

    render(createElement(Resolver, { projectSlug: "atlas", onState }));

    await waitFor(() => {
      expect(onState).toHaveBeenCalledWith(
        expect.objectContaining({
          fetchedAt: 200,
          loading: true,
          error: "github limited",
          data: expect.objectContaining({
            monthlyIncome: 212,
            totalSponsors: 3,
            sourceLabel: "OC + GitHub",
            balance: 500,
            isApproximate: true,
            limitedAccess: true,
            sponsorsCount: 1,
            tiersCount: 1,
            topMembersCount: 1,
            recentTransactionsCount: 1,
          }),
        })
      );
    });
    expect(useOpenCollectiveMock).toHaveBeenCalledWith("radarboard", "30d");
    expect(useGitHubSponsorsMock).toHaveBeenCalledWith("thedaviddias");
  });

  it("supports open-collective-only summaries and expense transactions", async () => {
    useOpenCollectiveMock.mockReturnValue({
      data: {
        stats: {
          yearlyBudget: 120000,
          balance: 25000,
          currency: "USD",
          backersCount: 4,
          sparklineData: [],
        },
        recentTransactions: [
          {
            id: "txn-2",
            description: "Infra bill",
            type: "DEBIT",
            fromAccount: { name: "Vendor" },
            toAccount: { name: "Org" },
            amount: 1500,
          },
        ],
        topMembers: [],
      },
      fetchedAt: 300,
      loading: false,
      error: null,
      refetch: vi.fn(async () => {}),
    });
    useGitHubSponsorsMock.mockReturnValue({
      data: null,
      fetchedAt: null,
      loading: false,
      error: null,
      refetch: vi.fn(async () => {}),
    });
    const Resolver = DATA_SOURCE_REGISTRY.get("sponsorship");
    const onState = vi.fn();

    if (!Resolver) throw new Error("sponsorship resolver not registered");

    render(createElement(Resolver, { projectSlug: "atlas", onState }));

    await waitFor(() => {
      expect(onState).toHaveBeenCalledWith(
        expect.objectContaining({
          fetchedAt: 300,
          data: expect.objectContaining({
            sourceLabel: "Open Collective",
            monthlyIncome: 100,
            totalSponsors: 4,
            hasGitHubSponsors: false,
            hasOpenCollective: true,
            recentTransactions: [
              expect.objectContaining({
                descriptionText: "Infra bill",
                accountName: "Org",
                displayAmount: -15,
                status: "error",
              }),
            ],
          }),
        })
      );
    });
  });

  it("reuses the same snapshot without reporting twice and exposes a combined refetch", async () => {
    const openCollectiveRefetch = vi.fn(async () => {});
    const githubRefetch = vi.fn(async () => {});
    useOpenCollectiveMock.mockReturnValue({
      data: null,
      fetchedAt: null,
      loading: false,
      error: null,
      refetch: openCollectiveRefetch,
    });
    useGitHubSponsorsMock.mockReturnValue({
      data: null,
      fetchedAt: 400,
      loading: false,
      error: null,
      refetch: githubRefetch,
    });
    const Resolver = DATA_SOURCE_REGISTRY.get("sponsorship");
    const onState = vi.fn();

    if (!Resolver) throw new Error("sponsorship resolver not registered");

    const { rerender } = render(createElement(Resolver, { projectSlug: "atlas", onState }));

    await waitFor(() => {
      expect(onState).toHaveBeenCalledTimes(1);
    });

    const firstCall = onState.mock.calls[0]?.[0];
    await firstCall.refetch();
    expect(openCollectiveRefetch).toHaveBeenCalledTimes(1);
    expect(githubRefetch).toHaveBeenCalledTimes(1);

    rerender(createElement(Resolver, { projectSlug: "atlas", onState }));

    await waitFor(() => {
      expect(onState).toHaveBeenCalledTimes(1);
    });
  });
});
