// @vitest-environment jsdom

// Mock ResizeObserver for jsdom
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

import { TooltipProvider } from "@radarboard/ui/tooltip";
import { render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { commitsDescriptor } from "..";

function renderWithProviders(element: React.ReactElement) {
  return render(createElement(TooltipProvider, null, element));
}

const mockUseGithubCommits = vi.fn();

vi.mock("../hooks/use-github-commits", () => ({
  useGithubCommits: (...args: unknown[]) => mockUseGithubCommits(...args),
}));

const FIXTURE_REPOS = [
  {
    repo: "thedaviddias/front-end-checklist",
    totalCommits: 120,
    dailyStats: [
      { date: "2025-12-01", count: 5 },
      { date: "2025-12-02", count: 3 },
      { date: "2025-12-03", count: 8 },
    ],
    visibility: "public" as const,
  },
  {
    repo: "thedaviddias/private-project",
    totalCommits: 45,
    dailyStats: [
      { date: "2025-12-01", count: 2 },
      { date: "2025-12-04", count: 7 },
    ],
    visibility: "private" as const,
  },
];

describe("commitsDescriptor", () => {
  beforeEach(() => {
    mockUseGithubCommits.mockReturnValue({
      data: { repos: FIXTURE_REPOS },
      configured: true,
      fetchedAt: 1_700_000_000,
      loading: false,
      error: null,
      refetch: vi.fn(async () => {}),
    });
  });

  it("declares the github integration dependency", () => {
    expect(commitsDescriptor.requiredIntegrations).toEqual(["github"]);
  });

  it("requests both repo and public_repo OAuth scopes", () => {
    const auth = commitsDescriptor.auth;
    expect(auth).toBeDefined();
    const authObj = Array.isArray(auth) ? auth[0] : auth;
    expect(authObj?.oauth?.scopes).toContain("repo");
    expect(authObj?.oauth?.scopes).toContain("public_repo");
  });

  it("has an expanded component defined", () => {
    expect(commitsDescriptor.expandedComponent).toBeDefined();
  });

  it("renders the compact contribution graph", { timeout: 15_000 }, async () => {
    const Component = commitsDescriptor.component;
    renderWithProviders(
      createElement(Component, {
        widgetId: commitsDescriptor.id,
        projectSlug: null,
        timeRange: "30d",
        config: commitsDescriptor.defaultConfig,
        onRefetch: vi.fn(),
        onFetchedAt: vi.fn(),
      })
    );

    // The ContributionGraph renders "Less" and "More" labels
    expect(await screen.findByText("Less")).toBeDefined();
    expect(await screen.findByText("More")).toBeDefined();
  });

  it("renders empty state when not configured", async () => {
    mockUseGithubCommits.mockReturnValue({
      data: undefined,
      configured: false,
      fetchedAt: null,
      loading: false,
      error: null,
      refetch: vi.fn(async () => {}),
    });

    const Component = commitsDescriptor.component;
    const onChromeStateChange = vi.fn();
    render(
      createElement(Component, {
        widgetId: commitsDescriptor.id,
        projectSlug: null,
        timeRange: "30d",
        config: commitsDescriptor.defaultConfig,
        onRefetch: vi.fn(),
        onFetchedAt: vi.fn(),
        onChromeStateChange,
      })
    );

    expect(await screen.findByText(/GitHub not connected/)).toBeDefined();
    await waitFor(() => {
      expect(onChromeStateChange).toHaveBeenCalledWith("disconnected");
    });
  });

  it("renders empty state when no repos have activity", async () => {
    mockUseGithubCommits.mockReturnValue({
      data: { repos: [] },
      configured: true,
      fetchedAt: 1_700_000_000,
      loading: false,
      error: null,
      refetch: vi.fn(async () => {}),
    });

    const Component = commitsDescriptor.component;
    render(
      createElement(Component, {
        widgetId: commitsDescriptor.id,
        projectSlug: null,
        timeRange: "30d",
        config: commitsDescriptor.defaultConfig,
        onRefetch: vi.fn(),
        onFetchedAt: vi.fn(),
      })
    );

    expect(
      await screen.findByText(/No commit activity in the connected repositories/)
    ).toBeDefined();
  });

  it("renders error state", async () => {
    mockUseGithubCommits.mockReturnValue({
      data: undefined,
      configured: true,
      fetchedAt: null,
      loading: false,
      error: "Rate limit exceeded",
      refetch: vi.fn(async () => {}),
    });

    const Component = commitsDescriptor.component;
    render(
      createElement(Component, {
        widgetId: commitsDescriptor.id,
        projectSlug: null,
        timeRange: "30d",
        config: commitsDescriptor.defaultConfig,
        onRefetch: vi.fn(),
        onFetchedAt: vi.fn(),
      })
    );

    expect(await screen.findByText(/Rate limit exceeded/)).toBeDefined();
  });

  it("renders loading state", () => {
    mockUseGithubCommits.mockReturnValue({
      data: undefined,
      configured: true,
      fetchedAt: null,
      loading: true,
      error: null,
      refetch: vi.fn(async () => {}),
    });

    const Component = commitsDescriptor.component;
    render(
      createElement(Component, {
        widgetId: commitsDescriptor.id,
        projectSlug: null,
        timeRange: "30d",
        config: commitsDescriptor.defaultConfig,
        onRefetch: vi.fn(),
        onFetchedAt: vi.fn(),
      })
    );

    expect(screen.getByText(/Loading/)).toBeDefined();
  });

  it("renders the expanded view with tabs and repo breakdown", { timeout: 15_000 }, async () => {
    const ExpandedComponent = commitsDescriptor.expandedComponent;
    if (!ExpandedComponent) throw new Error("expandedComponent not defined");

    renderWithProviders(
      createElement(ExpandedComponent, {
        widgetId: commitsDescriptor.id,
        projectSlug: null,
        timeRange: "30d",
        config: commitsDescriptor.defaultConfig,
        onRefetch: vi.fn(),
        onFetchedAt: vi.fn(),
      })
    );

    // Tabs
    expect(await screen.findByText(/All \(2\)/)).toBeDefined();
    expect(await screen.findByText(/Public \(1\)/)).toBeDefined();
    expect(await screen.findByText(/Private \(1\)/)).toBeDefined();

    // Repo breakdown
    expect(await screen.findByText("thedaviddias/front-end-checklist")).toBeDefined();
    expect(await screen.findByText("thedaviddias/private-project")).toBeDefined();

    // Total from daily stats aggregation: (5+3+8) + (2+7) = 25
    expect(await screen.findByText("25")).toBeDefined();

    // Date range
    expect(await screen.findByText(/commits/)).toBeDefined();
  });
});
