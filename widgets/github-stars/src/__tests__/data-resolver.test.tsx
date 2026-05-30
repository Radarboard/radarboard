// @vitest-environment jsdom

import { DATA_SOURCE_REGISTRY } from "@radarboard/widget-sdk/data-source-registry";
import { render, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "../data-resolver";

const usePollingIntervalMock = vi.fn();
const useGitHubStarsHistoryMock = vi.fn();
const buildGitHubStarsUrlMock = vi.fn();
const extractSelectedReposFromConfigMock = vi.fn();
const swrMock = vi.fn();

vi.mock("@radarboard/hooks/use-polling-interval", () => ({
  usePollingInterval: (...args: unknown[]) => usePollingIntervalMock(...args),
}));

vi.mock("../hooks/use-github-stars-history", () => ({
  useGitHubStarsHistory: (...args: unknown[]) => useGitHubStarsHistoryMock(...args),
}));

vi.mock("../repo-query", () => ({
  buildGitHubStarsUrl: (...args: unknown[]) => buildGitHubStarsUrlMock(...args),
  extractSelectedReposFromConfig: (...args: unknown[]) =>
    extractSelectedReposFromConfigMock(...args),
}));

vi.mock("swr", () => ({
  default: (...args: unknown[]) => swrMock(...args),
}));

describe("stars data resolver", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePollingIntervalMock.mockReturnValue(60_000);
    extractSelectedReposFromConfigMock.mockReturnValue([{ owner: "openai", repo: "codex" }]);
    buildGitHubStarsUrlMock.mockReturnValue("/api/integrations/github/stars?project=atlas");
    swrMock.mockReturnValue({
      data: {
        configured: false,
        repos: [
          {
            fullName: "openai/codex",
            htmlUrl: "https://github.com/openai/codex",
            stars: 120,
            forks: 5,
            openIssues: 1,
            watchers: 9,
            description: "Agents",
            language: "TypeScript",
            updatedAt: "2026-03-20T00:00:00.000Z",
          },
        ],
        totalStars: 120,
        totalForks: 5,
        starHistory: [],
        _fetchedAt: 88,
      },
      error: { message: "fetch failed" },
      isLoading: true,
      mutate: vi.fn(async () => undefined),
    });
    useGitHubStarsHistoryMock.mockReturnValue({
      data: {
        aggregateDaily: [{ date: "2026-03-20", totalStars: 120, starsGained: 5 }],
        aggregateAddedDaily: [{ date: "2026-03-20", count: 5 }],
        repoDaily: {
          "openai/codex": [{ date: "2026-03-20", totalStars: 120, starsGained: 5 }],
        },
        repoAddedDaily: {
          "openai/codex": [{ date: "2026-03-20", count: 5 }],
        },
        repos: [
          {
            repoKey: "openai/codex",
            fullName: "openai/codex",
            latestStars: 120,
            backfillStatus: "complete",
            lastSyncedAt: 123,
            coverageStatus: "partial",
            coverageMessage: "Tracking started recently",
          },
        ],
        latestSyncAt: 123,
      },
      refetch: vi.fn(async () => {}),
    });
  });

  it("reports aggregate star deltas and repo metadata", async () => {
    const Resolver = DATA_SOURCE_REGISTRY.get("github-stars");
    const onState = vi.fn();

    if (!Resolver) throw new Error("stars resolver not registered");

    render(
      createElement(Resolver, { projectSlug: "atlas", timeRange: "30d", config: {}, onState })
    );

    await waitFor(() => {
      expect(onState).toHaveBeenCalledWith(
        expect.objectContaining({
          fetchedAt: 88,
          loading: true,
          error: "fetch failed",
          data: expect.objectContaining({
            configured: false,
            totalStars: 120,
            totalStarsDelta: 5,
            totalStarsDeltaLabel: "+5",
            totalStarsCoverageStatus: "partial",
            totalStarsCoverageMessage: "Tracking started recently",
            repos: [
              expect.objectContaining({
                repoKey: "openai/codex",
                repoUrl: "https://github.com/openai/codex",
                starsDelta: 5,
                starsDeltaLabel: "+5",
                coverageStatus: "partial",
              }),
            ],
          }),
        })
      );
    });
    expect(useGitHubStarsHistoryMock).toHaveBeenCalledWith(
      "atlas",
      [{ owner: "openai", repo: "codex" }],
      "30d"
    );
  });

  it("falls back to sampled history deltas and full coverage messaging", async () => {
    swrMock.mockReturnValue({
      data: {
        repos: [
          {
            fullName: "openai/codex",
            htmlUrl: "https://github.com/openai/codex",
            stars: 120,
            forks: 5,
            openIssues: 1,
            watchers: 9,
            description: "Agents",
            language: "TypeScript",
            updatedAt: "2026-03-20T00:00:00.000Z",
          },
          {
            fullName: "Radarboard/radarboard",
            htmlUrl: "https://github.com/Radarboard/radarboard",
            stars: 500,
            forks: 20,
            openIssues: 2,
            watchers: 30,
            description: "Control room",
            language: "TypeScript",
            updatedAt: "2026-03-20T00:00:00.000Z",
          },
        ],
        totalStars: 620,
        totalForks: 25,
        starHistory: [],
        _fetchedAt: 100,
      },
      error: null,
      isLoading: false,
      mutate: vi.fn(async () => undefined),
    });
    useGitHubStarsHistoryMock.mockReturnValue({
      data: {
        aggregateDaily: [{ date: "2026-03-20", totalStars: 620, starsGained: 2 }],
        aggregateAddedDaily: [],
        repoDaily: {
          "openai/codex": [{ date: "2026-03-20", totalStars: 120, starsGained: 0 }],
          "Radarboard/radarboard": [{ date: "2026-03-20", totalStars: 620, starsGained: 2 }],
        },
        repoAddedDaily: {},
        repos: [
          {
            repoKey: "openai/codex",
            fullName: "openai/codex",
            latestStars: 120,
            backfillStatus: "complete",
            lastSyncedAt: 123,
            coverageStatus: "full",
            coverageMessage: null,
          },
          {
            repoKey: "Radarboard/radarboard",
            fullName: "Radarboard/radarboard",
            latestStars: 500,
            backfillStatus: "complete",
            lastSyncedAt: 123,
            coverageStatus: "full",
            coverageMessage: null,
          },
        ],
        latestSyncAt: 123,
      },
      refetch: vi.fn(async () => {}),
    });
    const Resolver = DATA_SOURCE_REGISTRY.get("github-stars");
    const onState = vi.fn();

    if (!Resolver) throw new Error("stars resolver not registered");

    render(
      createElement(Resolver, { projectSlug: "atlas", timeRange: "all", config: {}, onState })
    );

    await waitFor(() => {
      expect(onState).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            configured: true,
            totalStarsDelta: 2,
            totalStarsDeltaColor: "#7dd3fc",
            totalStarsCoverageStatus: "full",
            totalStarsCoverageMessage: null,
            repos: [
              expect.objectContaining({ fullName: "Radarboard/radarboard" }),
              expect.objectContaining({ fullName: "openai/codex" }),
            ],
          }),
        })
      );
    });
  });

  it("sorts repos by delta for ranged views and alphabetically when stars are tied", async () => {
    swrMock.mockReturnValue({
      data: {
        repos: [
          {
            fullName: "zeta/repo",
            htmlUrl: "https://github.com/zeta/repo",
            stars: 100,
            forks: 1,
            openIssues: 0,
            watchers: 5,
            description: null,
            language: null,
            updatedAt: "2026-03-20T00:00:00.000Z",
          },
          {
            fullName: "alpha/repo",
            htmlUrl: "https://github.com/alpha/repo",
            stars: 100,
            forks: 2,
            openIssues: 0,
            watchers: 7,
            description: null,
            language: null,
            updatedAt: "2026-03-20T00:00:00.000Z",
          },
        ],
        totalStars: 200,
        totalForks: 3,
        starHistory: [],
        _fetchedAt: 200,
      },
      error: null,
      isLoading: false,
      mutate: vi.fn(async () => undefined),
    });
    useGitHubStarsHistoryMock
      .mockReturnValueOnce({
        data: {
          aggregateDaily: [],
          aggregateAddedDaily: [],
          repoDaily: {
            "zeta/repo": [{ date: "2026-03-20", totalStars: 100, starsGained: 1 }],
            "alpha/repo": [{ date: "2026-03-20", totalStars: 100, starsGained: 10 }],
          },
          repoAddedDaily: {},
          repos: [
            {
              repoKey: "zeta/repo",
              fullName: "zeta/repo",
              latestStars: 100,
              backfillStatus: "complete",
              lastSyncedAt: 1,
              coverageStatus: "full",
              coverageMessage: null,
            },
            {
              repoKey: "alpha/repo",
              fullName: "alpha/repo",
              latestStars: 100,
              backfillStatus: "complete",
              lastSyncedAt: 1,
              coverageStatus: "full",
              coverageMessage: null,
            },
          ],
          latestSyncAt: 1,
        },
        refetch: vi.fn(async () => {}),
      })
      .mockReturnValueOnce({
        data: {
          aggregateDaily: [],
          aggregateAddedDaily: [],
          repoDaily: {
            "zeta/repo": [{ date: "2026-03-20", totalStars: 100, starsGained: 0 }],
            "alpha/repo": [{ date: "2026-03-20", totalStars: 100, starsGained: 0 }],
          },
          repoAddedDaily: {},
          repos: [
            {
              repoKey: "zeta/repo",
              fullName: "zeta/repo",
              latestStars: 100,
              backfillStatus: "complete",
              lastSyncedAt: 1,
              coverageStatus: "full",
              coverageMessage: null,
            },
            {
              repoKey: "alpha/repo",
              fullName: "alpha/repo",
              latestStars: 100,
              backfillStatus: "complete",
              lastSyncedAt: 1,
              coverageStatus: "full",
              coverageMessage: null,
            },
          ],
          latestSyncAt: 1,
        },
        refetch: vi.fn(async () => {}),
      });
    const Resolver = DATA_SOURCE_REGISTRY.get("github-stars");

    if (!Resolver) throw new Error("stars resolver not registered");

    const rangedOnState = vi.fn();
    const { rerender } = render(
      createElement(Resolver, {
        projectSlug: "atlas",
        timeRange: "30d",
        config: {},
        onState: rangedOnState,
      })
    );

    await waitFor(() => {
      const repos = rangedOnState.mock.calls.at(-1)?.[0].data.repos;
      expect(repos.map((repo: { fullName: string }) => repo.fullName)).toEqual([
        "alpha/repo",
        "zeta/repo",
      ]);
    });

    const allOnState = vi.fn();
    rerender(
      createElement(Resolver, {
        projectSlug: "atlas",
        timeRange: "all",
        config: {},
        onState: allOnState,
      })
    );

    await waitFor(() => {
      const repos = allOnState.mock.calls.at(-1)?.[0].data.repos;
      expect(repos.map((repo: { fullName: string }) => repo.fullName)).toEqual([
        "alpha/repo",
        "zeta/repo",
      ]);
    });
  });
});
