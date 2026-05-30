import { beforeEach, vi } from "vitest";

vi.mock("../client", () => ({
  getDb: vi.fn(),
}));
vi.mock("../schema", () => ({
  apiCache: { key: "key", route: "route" },
}));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col, val) => ({ col, val })),
}));

import { getDb } from "@/data/core/client";
import { SqliteCacheRepository } from "../sqlite-cache";

// Build a chainable mock DB object
function createMockDb() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};

  // select().from().where().get()
  chain.get = vi.fn();
  chain.where = vi.fn().mockReturnValue({ get: chain.get });
  chain.from = vi.fn().mockReturnValue({ where: chain.where });
  chain.select = vi.fn().mockReturnValue({ from: chain.from });

  // insert().values().onConflictDoUpdate()
  chain.onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
  chain.values = vi.fn().mockReturnValue({ onConflictDoUpdate: chain.onConflictDoUpdate });
  chain.insert = vi.fn().mockReturnValue({ values: chain.values });

  // delete().where() -- also delete() with no where (for clear)
  chain.deleteWhere = vi.fn().mockResolvedValue(undefined);
  chain.deleteFn = vi.fn().mockReturnValue({ where: chain.deleteWhere });

  return chain;
}

let mockDb: ReturnType<typeof createMockDb>;
let repo: SqliteCacheRepository;

beforeEach(() => {
  mockDb = createMockDb();

  const dbProxy = {
    select: mockDb.select,
    insert: mockDb.insert,
    delete: mockDb.deleteFn,
  };

  vi.mocked(getDb).mockReturnValue(dbProxy as unknown as ReturnType<typeof getDb>);
  repo = new SqliteCacheRepository();
});

describe("SqliteCacheRepository", () => {
  describe("get", () => {
    it("returns null when no entry found", async () => {
      mockDb.get.mockResolvedValue(undefined);

      const result = await repo.get("missing-key");

      expect(result).toBeNull();
    });

    it("returns mapped CacheEntry when row exists", async () => {
      mockDb.get.mockResolvedValue({
        key: "test:key",
        data: '{"x":1}',
        fetchedAt: 1000,
        ttlSeconds: 300,
        route: "/api/test",
      });

      const result = await repo.get("test:key");

      expect(result).toEqual({
        key: "test:key",
        data: '{"x":1}',
        fetchedAt: 1000,
        ttlSeconds: 300,
      });
    });
  });

  describe("set", () => {
    it("upserts entry with onConflictDoUpdate", async () => {
      await repo.set({
        key: "test:key",
        route: "/api/test",
        data: '{"x":1}',
        fetchedAt: 1000,
        ttlSeconds: 300,
      });

      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalledWith({
        key: "test:key",
        route: "/api/test",
        data: '{"x":1}',
        fetchedAt: 1000,
        ttlSeconds: 300,
      });
      expect(mockDb.onConflictDoUpdate).toHaveBeenCalledWith({
        target: "key", // apiCache.key from mocked schema
        set: {
          data: '{"x":1}',
          fetchedAt: 1000,
          ttlSeconds: 300,
        },
      });
    });
  });

  describe("delete", () => {
    it("removes entry by key", async () => {
      await repo.delete("test:key");

      expect(mockDb.deleteFn).toHaveBeenCalled();
      expect(mockDb.deleteWhere).toHaveBeenCalled();
    });
  });

  describe("clear", () => {
    it("deletes all entries", async () => {
      // clear() calls db.delete(apiCache) with no where
      mockDb.deleteFn.mockResolvedValue(undefined);

      await repo.clear();

      expect(mockDb.deleteFn).toHaveBeenCalled();
    });
  });

  describe("getKeysByRoute", () => {
    it("returns filtered keys", async () => {
      // getKeysByRoute uses select({key}).from().where() — no .get(), returns array
      const rows = [{ key: "k1" }, { key: "k2" }];
      mockDb.where.mockResolvedValue(rows);

      const result = await repo.getKeysByRoute("/api/test");

      expect(result).toEqual(["k1", "k2"]);
    });
  });
});
