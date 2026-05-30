import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@libsql/client", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@libsql/client";
import { TursoGitHubStarHistoryRepository } from "../repositories/turso-github-star-history";

const mockExecute = vi.fn();

let repo: TursoGitHubStarHistoryRepository;

beforeEach(() => {
  mockExecute.mockReset();
  vi.mocked(createClient).mockReturnValue({ execute: mockExecute } as unknown as ReturnType<
    typeof createClient
  >);
  repo = new TursoGitHubStarHistoryRepository({
    url: "libsql://test.turso.io",
    authToken: "test-token",
  });
});

describe("TursoGitHubStarHistoryRepository", () => {
  it("reads daily rows with repo filters", async () => {
    mockExecute.mockResolvedValue({
      rows: [
        {
          repo_key: "openai/codex",
          day: "2026-03-20",
          total_stars: 10,
          stars_gained: 2,
          source: "daily-sync",
          updated_at: 100,
        },
      ],
    });

    const rows = await repo.getDaily(["openai/codex"], { fromDay: "2026-03-01" });

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
    const queryCall = mockExecute.mock.calls.find((call) => typeof call[0] === "object");
    expect(queryCall?.[0].sql).toContain("FROM github_repo_star_daily");
    expect(queryCall?.[0].args).toEqual(["openai/codex", "2026-03-01"]);
  });

  it("upserts daily rows and sync state rows", async () => {
    mockExecute.mockResolvedValue({ rows: [] });

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
      backfillStatus: "backfilling",
      nextPage: 2,
      oldestSeenStarredAt: "2026-03-18T00:00:00.000Z",
      lastSyncedAt: 101,
      lastError: null,
      updatedAt: 101,
    });

    const statementCalls = mockExecute.mock.calls.filter((call) => typeof call[0] === "object");

    expect(statementCalls[0]?.[0].sql).toContain("ON CONFLICT(repo_key, day) DO UPDATE");
    expect(statementCalls[0]?.[0].args).toEqual([
      "openai/codex",
      "2026-03-20",
      10,
      2,
      "daily-sync",
      100,
    ]);
    expect(statementCalls[1]?.[0].sql).toContain("ON CONFLICT(repo_key) DO UPDATE");
  });
});
