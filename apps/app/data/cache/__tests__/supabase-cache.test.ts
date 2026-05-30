import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { SupabaseCacheRepository } from "../supabase-cache";

const BASE_URL = "https://test.supabase.co";
const ANON_KEY = "test-key";

let repo: SupabaseCacheRepository;

beforeEach(() => {
  mockFetch.mockReset();
  repo = new SupabaseCacheRepository({ url: BASE_URL, anonKey: ANON_KEY });
});

function expectHeaders(call: unknown[], extraHeaders?: Record<string, string>) {
  const opts = call[1] as RequestInit;
  const headers = opts.headers as Record<string, string>;
  expect(headers.apikey).toBe(ANON_KEY);
  expect(headers.Authorization).toBe(`Bearer ${ANON_KEY}`);
  expect(headers["Content-Type"]).toBe("application/json");
  if (extraHeaders) {
    for (const [k, v] of Object.entries(extraHeaders)) {
      expect(headers[k]).toBe(v);
    }
  }
}

describe("SupabaseCacheRepository", () => {
  describe("get", () => {
    it("returns null when fetch returns empty array", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      const result = await repo.get("missing-key");

      expect(result).toBeNull();
      expect(mockFetch).toHaveBeenCalledOnce();
      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe(`${BASE_URL}/rest/v1/api_cache?key=eq.missing-key&select=*`);
      expectHeaders(mockFetch.mock.calls[0]);
    });

    it("returns null when fetch is not ok", async () => {
      mockFetch.mockResolvedValue({ ok: false });

      const result = await repo.get("bad-key");

      expect(result).toBeNull();
    });

    it("returns CacheEntry when row exists", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve([
            { key: "test:key", data: '{"x":1}', fetched_at: 1000, ttl_seconds: 300 },
          ]),
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
    it("calls fetch with POST and correct body including Prefer: resolution=merge-duplicates", async () => {
      mockFetch.mockResolvedValue({ ok: true });

      await repo.set({
        key: "test:key",
        route: "/api/test",
        data: '{"x":1}',
        fetchedAt: 1000,
        ttlSeconds: 300,
      });

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe(`${BASE_URL}/rest/v1/api_cache`);
      expect(opts.method).toBe("POST");

      const headers = opts.headers as Record<string, string>;
      expect(headers.Prefer).toBe("resolution=merge-duplicates,return=minimal");
      expect(headers.apikey).toBe(ANON_KEY);
      expect(headers.Authorization).toBe(`Bearer ${ANON_KEY}`);

      expect(JSON.parse(opts.body as string)).toEqual({
        key: "test:key",
        route: "/api/test",
        data: '{"x":1}',
        fetched_at: 1000,
        ttl_seconds: 300,
      });
    });
  });

  describe("delete", () => {
    it("calls fetch with DELETE and correct key filter", async () => {
      mockFetch.mockResolvedValue({ ok: true });

      await repo.delete("test:key");

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe(`${BASE_URL}/rest/v1/api_cache?key=eq.test%3Akey`);
      expect(opts.method).toBe("DELETE");
      expectHeaders(mockFetch.mock.calls[0]);
    });
  });

  describe("clear", () => {
    it("calls fetch with DELETE", async () => {
      mockFetch.mockResolvedValue({ ok: true });

      await repo.clear();

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe(`${BASE_URL}/rest/v1/api_cache?key=neq.___impossible___`);
      expect(opts.method).toBe("DELETE");
      expectHeaders(mockFetch.mock.calls[0]);
    });
  });

  describe("getKeysByRoute", () => {
    it("returns array of keys from filtered results", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([{ key: "k1" }, { key: "k2" }]),
      });

      const result = await repo.getKeysByRoute("/api/test");

      expect(result).toEqual(["k1", "k2"]);
      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe(`${BASE_URL}/rest/v1/api_cache?route=eq.%2Fapi%2Ftest&select=key`);
      expectHeaders(mockFetch.mock.calls[0]);
    });

    it("returns empty array when fetch is not ok", async () => {
      mockFetch.mockResolvedValue({ ok: false });

      const result = await repo.getKeysByRoute("/api/test");

      expect(result).toEqual([]);
    });
  });
});
