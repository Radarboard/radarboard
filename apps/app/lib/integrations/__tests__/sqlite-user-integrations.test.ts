/**
 * Direct unit test for the SQLite settings repo's user-integration methods.
 *
 * Lives under lib/ (not data/settings/__tests__) so it actually runs in CI —
 * the app vitest `include` covers db/lib/hooks/app/modules but NOT data/, so the
 * sibling settings-repo tests are never executed. SQLite is the provider that
 * ships in the desktop app; the turso/planetscale/supabase impls mirror the same
 * column + JSON serialization.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/data/core/client", () => ({
  getDb: vi.fn(),
  ensureDbReady: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/data/core/schema", () => ({ userSettings: { id: "id" } }));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col, val) => ({ col, val })),
  sql: { raw: vi.fn((s: string) => s) },
}));

import { getDb } from "@/data/core/client";
import { SqliteSettingsRepository } from "@/data/settings/sqlite-settings";

function createMockDb() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.get = vi.fn();
  chain.where = vi.fn().mockReturnValue({ get: chain.get });
  chain.from = vi.fn().mockReturnValue({ where: chain.where });
  chain.select = vi.fn().mockReturnValue({ from: chain.from });
  chain.onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
  chain.values = vi.fn().mockReturnValue({ onConflictDoUpdate: chain.onConflictDoUpdate });
  chain.insert = vi.fn().mockReturnValue({ values: chain.values });
  chain.run = vi.fn().mockResolvedValue(undefined);
  // PRAGMA table_info — include user_integrations so ensureColumns skips the ALTER.
  chain.all = vi.fn().mockResolvedValue([{ name: "id" }, { name: "user_integrations" }]);
  return chain;
}

let mockDb: ReturnType<typeof createMockDb>;
let repo: SqliteSettingsRepository;

beforeEach(() => {
  mockDb = createMockDb();
  vi.mocked(getDb).mockReturnValue(mockDb as never);
  repo = new SqliteSettingsRepository();
});

afterEach(() => vi.clearAllMocks());

describe("SqliteSettingsRepository — user integrations", () => {
  it("getUserIntegrations returns [] when no row", async () => {
    mockDb.get.mockResolvedValue(undefined);
    expect(await repo.getUserIntegrations()).toEqual([]);
  });

  it("getUserIntegrations parses the user_integrations JSON column", async () => {
    mockDb.get.mockResolvedValue({ userIntegrations: JSON.stringify([{ id: "acme" }]) });
    expect(await repo.getUserIntegrations()).toEqual([{ id: "acme" }]);
  });

  it("setUserIntegrations writes the serialized configs to the user_integrations column", async () => {
    const configs = [{ id: "acme" }, { id: "beta" }];
    await repo.setUserIntegrations(configs);
    expect(mockDb.insert).toHaveBeenCalled();
    expect(mockDb.values).toHaveBeenCalledWith(
      expect.objectContaining({ userIntegrations: JSON.stringify(configs) })
    );
    // Upsert path also sets the column.
    expect(mockDb.onConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        set: expect.objectContaining({ userIntegrations: JSON.stringify(configs) }),
      })
    );
  });
});
