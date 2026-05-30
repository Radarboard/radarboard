import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { SupabaseGitHubStarHistoryRepository } from "../repositories/supabase-github-star-history";

const BASE_URL = "https://test.supabase.co";
const ANON_KEY = "test-key";

let repo: SupabaseGitHubStarHistoryRepository;

beforeEach(() => {
  mockFetch.mockReset();
  repo = new SupabaseGitHubStarHistoryRepository({ url: BASE_URL, anonKey: ANON_KEY });
});

describe("SupabaseGitHubStarHistoryRepository", () => {
  it("reads filtered daily rows", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            repo_key: "openai/codex",
            day: "2026-03-20",
            total_stars: 10,
            stars_gained: 2,
            source: "daily-sync",
            updated_at: 100,
          },
        ]),
    });

    const rows = await repo.getDaily(["openai/codex"], {
      fromDay: "2026-03-01",
      toDay: "2026-03-20",
    });

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

    const [url] = mockFetch.mock.calls[0]!;
    const parsed = new URL(url);
    expect(parsed.pathname).toBe("/rest/v1/github_repo_star_daily");
    expect(parsed.searchParams.get("repo_key")).toBe('in.("openai/codex")');
    expect(parsed.searchParams.get("day")).toBe("gte.2026-03-01");
    expect(parsed.searchParams.getAll("day")).toContain("lte.2026-03-20");
  });

  it("upserts daily rows with repo/day conflict target", async () => {
    mockFetch.mockResolvedValue({ ok: true });

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

    const [url, options] = mockFetch.mock.calls[0]!;
    expect(new URL(url).searchParams.get("on_conflict")).toBe("repo_key,day");
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body as string)).toEqual([
      {
        repo_key: "openai/codex",
        day: "2026-03-20",
        total_stars: 10,
        stars_gained: 2,
        source: "daily-sync",
        updated_at: 100,
      },
    ]);
  });

  it("reads and upserts sync state rows", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              repo_key: "openai/codex",
              backfill_status: "complete",
              next_page: null,
              oldest_seen_starred_at: "2026-03-18T00:00:00.000Z",
              last_synced_at: 100,
              last_error: null,
              updated_at: 100,
            },
          ]),
      })
      .mockResolvedValueOnce({ ok: true });

    const states = await repo.getSyncStates(["openai/codex"]);
    expect(states).toEqual([
      {
        repoKey: "openai/codex",
        backfillStatus: "complete",
        nextPage: null,
        oldestSeenStarredAt: "2026-03-18T00:00:00.000Z",
        lastSyncedAt: 100,
        lastError: null,
        updatedAt: 100,
      },
    ]);

    await repo.upsertSyncState({
      repoKey: "openai/codex",
      backfillStatus: "backfilling",
      nextPage: 2,
      oldestSeenStarredAt: "2026-03-18T00:00:00.000Z",
      lastSyncedAt: 101,
      lastError: null,
      updatedAt: 101,
    });

    const [url, options] = mockFetch.mock.calls[1]!;
    expect(new URL(url).searchParams.get("on_conflict")).toBe("repo_key");
    expect(JSON.parse(options.body as string)).toEqual({
      repo_key: "openai/codex",
      backfill_status: "backfilling",
      next_page: 2,
      oldest_seen_starred_at: "2026-03-18T00:00:00.000Z",
      last_synced_at: 101,
      last_error: null,
      updated_at: 101,
    });
  });
});
