import type { DataSourceContext } from "@radarboard/integration-sdk/types";
import type {
  GitHubRepoStarDailyRow,
  GitHubRepoStarEventRow,
  GitHubRepoStarSyncStateRow,
  GitHubRepoStarTrackingRow,
  GitHubStarHistoryRepository,
} from "@radarboard/types/database";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchGitHubStarsHistory } from "./star-history";

const getRepository = vi.fn();
const getStargazersPage = vi.fn();

vi.mock("./client", () => ({
  getRepository: (...args: unknown[]) => getRepository(...args),
  getStargazersPage: (...args: unknown[]) => getStargazersPage(...args),
}));

function createHistoryRepo(): GitHubStarHistoryRepository {
  const daily: GitHubRepoStarDailyRow[] = [];
  const syncStates: GitHubRepoStarSyncStateRow[] = [];
  const starEvents: GitHubRepoStarEventRow[] = [];
  const trackingStates: GitHubRepoStarTrackingRow[] = [];

  return {
    async listRepoKeys() {
      return Array.from(
        new Set([
          ...daily.map((row) => row.repoKey),
          ...syncStates.map((row) => row.repoKey),
          ...starEvents.map((row) => row.repoKey),
          ...trackingStates.map((row) => row.repoKey),
        ])
      ).sort();
    },
    async getDaily(repoKeys, options = {}) {
      return daily
        .filter(
          (row) =>
            repoKeys.includes(row.repoKey) &&
            (!options.fromDay || row.day >= options.fromDay) &&
            (!options.toDay || row.day <= options.toDay)
        )
        .sort((left, right) =>
          left.repoKey === right.repoKey
            ? left.day.localeCompare(right.day)
            : left.repoKey.localeCompare(right.repoKey)
        );
    },
    async upsertDaily(rows) {
      for (const row of rows) {
        const index = daily.findIndex(
          (current) => current.repoKey === row.repoKey && current.day === row.day
        );
        if (index === -1) daily.push(row);
        else daily[index] = row;
      }
    },
    async getSyncStates(repoKeys) {
      return syncStates.filter((row) => repoKeys.includes(row.repoKey));
    },
    async upsertSyncState(row) {
      const index = syncStates.findIndex((current) => current.repoKey === row.repoKey);
      if (index === -1) syncStates.push(row);
      else syncStates[index] = row;
    },
    async getStarEvents(repoKeys, options = {}) {
      return starEvents.filter(
        (row) =>
          repoKeys.includes(row.repoKey) &&
          (!options.actions?.length || options.actions.includes(row.action)) &&
          (options.occurredAfter == null || row.occurredAt >= options.occurredAfter) &&
          (options.occurredBefore == null || row.occurredAt <= options.occurredBefore)
      );
    },
    async upsertStarEvents(rows) {
      for (const row of rows) {
        const index = starEvents.findIndex(
          (current) => current.sourceEventId === row.sourceEventId
        );
        if (index === -1) starEvents.push(row);
        else starEvents[index] = row;
      }
    },
    async getTrackingStates(repoKeys) {
      return trackingStates.filter((row) => repoKeys.includes(row.repoKey));
    },
    async upsertTrackingState(row) {
      const index = trackingStates.findIndex((current) => current.repoKey === row.repoKey);
      if (index === -1) trackingStates.push(row);
      else trackingStates[index] = row;
    },
    async clearAll() {
      daily.splice(0);
      syncStates.splice(0);
      starEvents.splice(0);
      trackingStates.splice(0);
    },
  };
}

function createContext(repo: GitHubStarHistoryRepository): DataSourceContext {
  return {
    resolveCredential: vi.fn().mockResolvedValue({ token: "gh-token" }),
    getProjectIntegrations: vi.fn().mockResolvedValue({}),
    getAllProjects: vi.fn().mockResolvedValue([]),
    getGitHubStarHistoryRepo: () => repo,
  };
}

describe("fetchGitHubStarsHistory", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-20T12:00:00.000Z"));
    getRepository.mockReset();
    getStargazersPage.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("builds exact daily rows from stargazer timestamps and fills missing days", async () => {
    const repo = createHistoryRepo();
    const ctx = createContext(repo);

    getRepository.mockResolvedValue({
      stargazers_count: 3,
      full_name: "openai/codex",
    });
    getStargazersPage.mockResolvedValue([
      { starred_at: "2026-03-18T01:00:00.000Z", user: { login: "a" } },
      { starred_at: "2026-03-18T06:00:00.000Z", user: { login: "b" } },
      { starred_at: "2026-03-20T10:00:00.000Z", user: { login: "c" } },
    ]);

    const result = await fetchGitHubStarsHistory([{ owner: "openai", repo: "codex" }], "all", ctx);

    expect(result.aggregateDaily).toEqual([
      { date: "2026-03-18", totalStars: 2, starsGained: 2 },
      { date: "2026-03-19", totalStars: 2, starsGained: 0 },
      { date: "2026-03-20", totalStars: 3, starsGained: 1 },
    ]);
    expect(result.aggregateAddedDaily).toEqual([]);
    expect(result.repoDaily["openai/codex"]).toEqual(result.aggregateDaily);
    expect(result.repoAddedDaily["openai/codex"]).toEqual([]);
    expect(result.repos).toEqual([
      expect.objectContaining({
        repoKey: "openai/codex",
        fullName: "openai/codex",
        latestStars: 3,
        backfillStatus: "complete",
        lastSyncedAt: Math.floor(new Date("2026-03-20T12:00:00.000Z").getTime() / 1000),
        nextPage: null,
        historyMode: "exact",
        lastError: null,
        trackingStartedAt: null,
        baselineStars: null,
        lastWebhookAt: null,
        coverageStatus: "range_before_tracking",
        coverageMessage: "Tracking not started",
      }),
    ]);
    expect(getStargazersPage).toHaveBeenCalledWith(
      { token: "gh-token" },
      "openai",
      "codex",
      1,
      100
    );
  });

  it("resumes backfill from stored nextPage and persists completion", async () => {
    const repo = createHistoryRepo();
    await repo.upsertDaily([
      {
        repoKey: "openai/codex",
        day: "2026-03-18",
        totalStars: 1,
        starsGained: 1,
        source: "backfill",
        updatedAt: 1,
      },
    ]);
    await repo.upsertSyncState({
      repoKey: "openai/codex",
      backfillStatus: "backfilling",
      nextPage: 3,
      oldestSeenStarredAt: "2026-03-18T01:00:00.000Z",
      lastSyncedAt: 1,
      lastError: null,
      updatedAt: 1,
    });

    const ctx = createContext(repo);
    getRepository.mockResolvedValue({
      stargazers_count: 2,
      full_name: "openai/codex",
    });
    getStargazersPage.mockResolvedValue([
      { starred_at: "2026-03-20T10:00:00.000Z", user: { login: "c" } },
    ]);

    const result = await fetchGitHubStarsHistory([{ owner: "openai", repo: "codex" }], "all", ctx);

    expect(getStargazersPage).toHaveBeenCalledWith(
      { token: "gh-token" },
      "openai",
      "codex",
      3,
      100
    );
    expect(result.aggregateDaily).toEqual([
      { date: "2026-03-18", totalStars: 1, starsGained: 1 },
      { date: "2026-03-19", totalStars: 1, starsGained: 0 },
      { date: "2026-03-20", totalStars: 2, starsGained: 1 },
    ]);
  });

  it("extends a completed repo to today using the live current star count", async () => {
    const repo = createHistoryRepo();
    await repo.upsertDaily([
      {
        repoKey: "openai/codex",
        day: "2026-03-18",
        totalStars: 2,
        starsGained: 2,
        source: "backfill",
        updatedAt: 1,
      },
    ]);
    await repo.upsertSyncState({
      repoKey: "openai/codex",
      backfillStatus: "complete",
      nextPage: null,
      oldestSeenStarredAt: "2026-03-18T01:00:00.000Z",
      lastSyncedAt: 1,
      lastError: null,
      updatedAt: 1,
    });

    const ctx = createContext(repo);
    getRepository.mockResolvedValue({
      stargazers_count: 5,
      full_name: "openai/codex",
    });

    const result = await fetchGitHubStarsHistory([{ owner: "openai", repo: "codex" }], "all", ctx);

    expect(getStargazersPage).not.toHaveBeenCalled();
    expect(result.aggregateDaily).toEqual([
      { date: "2026-03-18", totalStars: 2, starsGained: 2 },
      { date: "2026-03-19", totalStars: 2, starsGained: 0 },
      { date: "2026-03-20", totalStars: 5, starsGained: 3 },
    ]);
  });

  it("can backfill beyond the incremental page limit in full mode", async () => {
    const repo = createHistoryRepo();
    const ctx = createContext(repo);

    getRepository.mockResolvedValue({
      stargazers_count: 1_012,
      full_name: "openai/codex",
    });
    getStargazersPage.mockImplementation((_config, _owner, _repo, page: number) => {
      if (page <= 10) {
        return Promise.resolve(
          Array.from({ length: 100 }, (_, index) => ({
            starred_at: `2026-03-${`${((page + index) % 20) + 1}`.padStart(2, "0")}T10:00:00.000Z`,
            user: { login: `user-${page}-${index}` },
          }))
        );
      }

      if (page === 11) {
        return Promise.resolve(
          Array.from({ length: 12 }, (_, index) => ({
            starred_at: `2026-03-${`${index + 1}`.padStart(2, "0")}T10:00:00.000Z`,
            user: { login: `user-11-${index}` },
          }))
        );
      }

      return Promise.resolve([]);
    });

    const result = await fetchGitHubStarsHistory([{ owner: "openai", repo: "codex" }], "all", ctx, {
      syncMode: "full",
    });

    expect(getStargazersPage).toHaveBeenCalledWith(
      { token: "gh-token" },
      "openai",
      "codex",
      11,
      100
    );
    expect(result.repos[0]?.backfillStatus).toBe("complete");
  });
});
