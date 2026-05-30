import type { CacheEntry, CacheRepository } from "@radarboard/types/database";
import { beforeEach, vi } from "vitest";

vi.mock("../repository", () => ({
  getCacheRepo: vi.fn(),
}));

import { clearCache, getCacheEntry, getCacheKeysByRoute, resetMemCache, withCache } from "../cache";
import { getCacheRepo } from "../repository";

const mockRepo: Record<keyof CacheRepository, ReturnType<typeof vi.fn>> = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
  clear: vi.fn(),
  getKeysByRoute: vi.fn(),
};

beforeEach(() => {
  mockRepo.get.mockReset();
  mockRepo.set.mockReset();
  mockRepo.delete.mockReset();
  mockRepo.clear.mockReset();
  mockRepo.getKeysByRoute.mockReset();
  resetMemCache();
  vi.mocked(getCacheRepo).mockReturnValue(mockRepo as unknown as CacheRepository);
  vi.spyOn(Date, "now").mockReturnValue(1_000_000_000 * 1000); // unix 1_000_000_000
});

describe("withCache", () => {
  const baseOptions = {
    key: "test:key",
    route: "/api/test",
    ttlSeconds: 300,
    fetchFn: vi.fn(),
  };

  it("returns fresh cached data when entry is within TTL", async () => {
    const cached: CacheEntry = {
      key: "test:key",
      data: JSON.stringify({ value: 42 }),
      fetchedAt: 1_000_000_000 - 100, // 100s ago, within 300s TTL
      ttlSeconds: 300,
    };
    mockRepo.get.mockResolvedValue(cached);

    const result = await withCache({ ...baseOptions });

    expect(result).toEqual(expect.objectContaining({ data: { value: 42 } }));
    expect(baseOptions.fetchFn).not.toHaveBeenCalled();
  });

  it("calls fetchFn when cache is empty", async () => {
    mockRepo.get.mockResolvedValue(null);
    mockRepo.set.mockResolvedValue(undefined);
    const fetchFn = vi.fn().mockResolvedValue({ fresh: true });

    const result = await withCache({ ...baseOptions, fetchFn });

    expect(fetchFn).toHaveBeenCalledOnce();
    expect(result).toEqual(expect.objectContaining({ data: { fresh: true } }));
    expect(mockRepo.set).toHaveBeenCalledWith({
      key: "test:key",
      route: "/api/test",
      data: JSON.stringify({ fresh: true }),
      fetchedAt: 1_000_000_000,
      ttlSeconds: 300,
    });
  });

  it("calls fetchFn when cache is expired", async () => {
    const expired: CacheEntry = {
      key: "test:key",
      data: JSON.stringify({ old: true }),
      fetchedAt: 1_000_000_000 - 400, // 400s ago, TTL is 300s → expired
      ttlSeconds: 300,
    };
    mockRepo.get.mockResolvedValue(expired);
    mockRepo.set.mockResolvedValue(undefined);
    const fetchFn = vi.fn().mockResolvedValue({ refreshed: true });

    const result = await withCache({ ...baseOptions, fetchFn });

    expect(fetchFn).toHaveBeenCalledOnce();
    expect(result).toEqual(expect.objectContaining({ data: { refreshed: true } }));
  });

  it("writes result to cache after successful fetch", async () => {
    mockRepo.get.mockResolvedValue(null);
    mockRepo.set.mockResolvedValue(undefined);
    const fetchFn = vi.fn().mockResolvedValue({ saved: true });

    await withCache({ ...baseOptions, fetchFn, ttlSeconds: 600 });

    expect(mockRepo.set).toHaveBeenCalledWith({
      key: "test:key",
      route: "/api/test",
      data: JSON.stringify({ saved: true }),
      fetchedAt: 1_000_000_000,
      ttlSeconds: 600,
    });
  });

  it("returns stale data when fetchFn throws and cache has expired entry", async () => {
    const expired: CacheEntry = {
      key: "test:key",
      data: JSON.stringify({ stale: true }),
      fetchedAt: 1_000_000_000 - 500,
      ttlSeconds: 300,
    };
    // First call: initial check (expired), second call: stale fallback
    mockRepo.get.mockResolvedValue(expired);
    const fetchFn = vi.fn().mockRejectedValue(new Error("API down"));

    const result = await withCache({ ...baseOptions, fetchFn });

    expect(result).toEqual(expect.objectContaining({ data: { stale: true }, _stale: true }));
  });

  it("throws when fetchFn fails and no cache exists", async () => {
    mockRepo.get.mockResolvedValue(null);
    const error = new Error("API down");
    const fetchFn = vi.fn().mockRejectedValue(error);

    await expect(withCache({ ...baseOptions, fetchFn })).rejects.toThrow("API down");
  });

  it("skips cache read when forceRefresh is true", async () => {
    mockRepo.set.mockResolvedValue(undefined);
    const fetchFn = vi.fn().mockResolvedValue({ forced: true });

    const result = await withCache({ ...baseOptions, fetchFn, forceRefresh: true });

    // repo.get should NOT have been called for initial read
    // (it may be called in stale fallback, but fetchFn succeeds here)
    expect(mockRepo.get).not.toHaveBeenCalled();
    expect(fetchFn).toHaveBeenCalledOnce();
    expect(result).toEqual(expect.objectContaining({ data: { forced: true } }));
  });

  it("handles cache read errors gracefully", async () => {
    mockRepo.get.mockRejectedValue(new Error("DB read error"));
    mockRepo.set.mockResolvedValue(undefined);
    const fetchFn = vi.fn().mockResolvedValue({ fallback: true });

    const result = await withCache({ ...baseOptions, fetchFn });

    expect(fetchFn).toHaveBeenCalledOnce();
    expect(result).toEqual(expect.objectContaining({ data: { fallback: true } }));
  });

  it("handles cache write errors gracefully", async () => {
    mockRepo.get.mockResolvedValue(null);
    mockRepo.set.mockRejectedValue(new Error("DB write error"));
    const fetchFn = vi.fn().mockResolvedValue({ stillReturned: true });

    const result = await withCache({ ...baseOptions, fetchFn });

    expect(result).toEqual(expect.objectContaining({ data: { stillReturned: true } }));
  });
});

describe("getCacheEntry", () => {
  it("returns parsed entry", async () => {
    const entry: CacheEntry = {
      key: "k",
      data: JSON.stringify({ hello: "world" }),
      fetchedAt: 100,
      ttlSeconds: 60,
    };
    mockRepo.get.mockResolvedValue(entry);

    const result = await getCacheEntry("k");

    expect(result).toEqual({
      data: { hello: "world" },
      fetchedAt: 100,
      ttlSeconds: 60,
    });
  });

  it("returns null when no entry exists", async () => {
    mockRepo.get.mockResolvedValue(null);

    const result = await getCacheEntry("missing");

    expect(result).toBeNull();
  });
});

describe("clearCache", () => {
  it("calls repo.clear", async () => {
    mockRepo.clear.mockResolvedValue(undefined);

    await clearCache();

    expect(mockRepo.clear).toHaveBeenCalledOnce();
  });
});

describe("getCacheKeysByRoute", () => {
  it("delegates to repo", async () => {
    mockRepo.getKeysByRoute.mockResolvedValue(["key1", "key2"]);

    const result = await getCacheKeysByRoute("/api/test");

    expect(mockRepo.getKeysByRoute).toHaveBeenCalledWith("/api/test");
    expect(result).toEqual(["key1", "key2"]);
  });
});
