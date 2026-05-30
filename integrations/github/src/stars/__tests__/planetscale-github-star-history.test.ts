import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { PlanetscaleGitHubStarHistoryRepository } from "../repositories/planetscale-github-star-history";

const CONFIG = {
  host: "test.connect.psdb.cloud",
  username: "test-user",
  password: "test-pass",
};

let repo: PlanetscaleGitHubStarHistoryRepository;

beforeEach(() => {
  mockFetch.mockReset();
  repo = new PlanetscaleGitHubStarHistoryRepository(CONFIG);
});

function mockOkResponse(rows: Record<string, unknown>[]) {
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ rows }),
  });
}

describe("PlanetscaleGitHubStarHistoryRepository", () => {
  it("reads daily rows", async () => {
    mockOkResponse([
      {
        repo_key: "openai/codex",
        day: "2026-03-20",
        total_stars: 10,
        stars_gained: 2,
        source: "daily-sync",
        updated_at: 100,
      },
    ]);

    const rows = await repo.getDaily(["openai/codex"], { toDay: "2026-03-20" });

    expect(rows).toEqual([
      {
        repoKey: "openai/codex",
        day: "2026-03-20",
        totalStars: 10,
        starsGained: 2,
        source: "daily-sync",
        updatedAt: 100,
      },
    ]);

    const body = JSON.parse(mockFetch.mock.calls[0]![1].body as string);
    expect(body.query).toContain("FROM github_repo_star_daily");
    expect(body.args).toEqual(["openai/codex", "2026-03-20"]);
  });

  it("upserts daily rows and sync state rows", async () => {
    mockOkResponse([]);

    await repo.upsertDaily([
      {
        repoKey: "openai/codex",
        day: "2026-03-20",
        totalStars: 10,
        starsGained: 2,
        source: "daily-sync",
        updatedAt: 100,
      },
    ]);
    await repo.upsertSyncState({
      repoKey: "openai/codex",
      backfillStatus: "complete",
      nextPage: null,
      oldestSeenStarredAt: "2026-03-18T00:00:00.000Z",
      lastSyncedAt: 101,
      lastError: null,
      updatedAt: 101,
    });

    const dailyBody = JSON.parse(mockFetch.mock.calls[0]![1].body as string);
    expect(dailyBody.query).toContain("ON DUPLICATE KEY UPDATE");
    expect(dailyBody.args).toEqual(["openai/codex", "2026-03-20", 10, 2, "daily-sync", 100]);

    const syncBody = JSON.parse(mockFetch.mock.calls[1]![1].body as string);
    expect(syncBody.query).toContain("github_repo_star_sync_state");
    expect(syncBody.query).toContain("ON DUPLICATE KEY UPDATE");
  });
});
