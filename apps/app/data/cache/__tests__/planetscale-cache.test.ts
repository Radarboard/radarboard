import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { PlanetscaleCacheRepository } from "../planetscale-cache";

const CONFIG = {
  host: "test.connect.psdb.cloud",
  username: "test-user",
  password: "test-pass",
};
const EXPECTED_AUTH = `Basic ${Buffer.from(`${CONFIG.username}:${CONFIG.password}`).toString("base64")}`;

let repo: PlanetscaleCacheRepository;

beforeEach(() => {
  mockFetch.mockReset();
  repo = new PlanetscaleCacheRepository(CONFIG);
});

function mockOkResponse(rows: Record<string, unknown>[]) {
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ rows }),
  });
}

function expectQueryCall(expectedQuery: string, expectedArgs: unknown[]) {
  expect(mockFetch).toHaveBeenCalledOnce();
  const [url, opts] = mockFetch.mock.calls[0];
  expect(url).toBe(`https://${CONFIG.host}/v1/query`);
  expect(opts.method).toBe("POST");

  const headers = opts.headers as Record<string, string>;
  expect(headers.Authorization).toBe(EXPECTED_AUTH);
  expect(headers["Content-Type"]).toBe("application/json");

  const body = JSON.parse(opts.body as string);
  expect(body.query).toBe(expectedQuery);
  expect(body.args).toEqual(expectedArgs);
}

describe("PlanetscaleCacheRepository", () => {
  describe("get", () => {
    it("returns null when empty", async () => {
      mockOkResponse([]);

      const result = await repo.get("missing-key");

      expect(result).toBeNull();
      expectQueryCall(
        "SELECT cache_key, data, fetched_at, ttl_seconds FROM api_cache WHERE cache_key = ?",
        ["missing-key"]
      );
    });

    it("returns CacheEntry mapping cache_key to key", async () => {
      mockOkResponse([
        { cache_key: "test:key", data: '{"x":1}', fetched_at: 1000, ttl_seconds: 300 },
      ]);

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
    it("sends INSERT...ON DUPLICATE KEY UPDATE query", async () => {
      mockOkResponse([]);

      await repo.set({
        key: "test:key",
        route: "/api/test",
        data: '{"x":1}',
        fetchedAt: 1000,
        ttlSeconds: 300,
      });

      expect(mockFetch).toHaveBeenCalledOnce();
      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(body.query).toContain("INSERT INTO api_cache");
      expect(body.query).toContain("ON DUPLICATE KEY UPDATE");
      expect(body.args).toEqual(["test:key", "/api/test", '{"x":1}', 1000, 300]);
    });
  });

  describe("delete", () => {
    it("sends DELETE query", async () => {
      mockOkResponse([]);

      await repo.delete("test:key");

      expectQueryCall("DELETE FROM api_cache WHERE cache_key = ?", ["test:key"]);
    });
  });

  describe("clear", () => {
    it("sends DELETE without filter", async () => {
      mockOkResponse([]);

      await repo.clear();

      expectQueryCall("DELETE FROM api_cache", []);
    });
  });

  describe("getKeysByRoute", () => {
    it("returns keys from filtered query", async () => {
      mockOkResponse([{ cache_key: "k1" }, { cache_key: "k2" }]);

      const result = await repo.getKeysByRoute("/api/test");

      expect(result).toEqual(["k1", "k2"]);
      expectQueryCall("SELECT cache_key FROM api_cache WHERE route = ?", ["/api/test"]);
    });
  });

  describe("query error", () => {
    it("throws when fetch returns non-ok", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Internal Server Error"),
      });

      await expect(repo.get("any-key")).rejects.toThrow(
        "PlanetScale query failed: 500 Internal Server Error"
      );
    });
  });
});
