import { describe, expect, it, vi } from "vitest";
import { TTLMap } from "../ttl-map";

describe("TTLMap", () => {
  it("stores and retrieves values", () => {
    const map = new TTLMap<string, number>({ maxSize: 100, ttlMs: 60000 });
    map.set("a", 1);
    expect(map.get("a")).toBe(1);
  });

  it("returns undefined for missing keys", () => {
    const map = new TTLMap<string, number>({ maxSize: 100, ttlMs: 60000 });
    expect(map.get("missing")).toBeUndefined();
  });

  it("expires entries after TTL", async () => {
    vi.useFakeTimers();
    try {
      const map = new TTLMap<string, number>({ maxSize: 100, ttlMs: 30 });
      map.set("expiring", 42);

      expect(map.get("expiring")).toBe(42);

      vi.advanceTimersByTime(40);

      expect(map.get("expiring")).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("evicts oldest 25% when maxSize exceeded", () => {
    const map = new TTLMap<string, number>({ maxSize: 4, ttlMs: 60000 });

    map.set("a", 1);
    map.set("b", 2);
    map.set("c", 3);
    map.set("d", 4);

    // At maxSize — no eviction yet
    expect(map.size).toBe(4);

    // Exceed maxSize — should evict oldest 25% (1 entry)
    map.set("e", 5);
    expect(map.size).toBeLessThanOrEqual(4);

    // "a" was oldest and should be evicted
    expect(map.get("a")).toBeUndefined();
    expect(map.get("e")).toBe(5);
  });

  it("prune() removes all expired entries", async () => {
    vi.useFakeTimers();
    try {
      const map = new TTLMap<string, number>({ maxSize: 100, ttlMs: 20 });
      map.set("x", 1);
      map.set("y", 2);

      vi.advanceTimersByTime(30);

      map.set("z", 3); // fresh entry

      const pruned = map.prune();
      expect(pruned).toBe(2);
      expect(map.size).toBe(1);
      expect(map.get("z")).toBe(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it("has() returns false for expired entries", async () => {
    vi.useFakeTimers();
    try {
      const map = new TTLMap<string, number>({ maxSize: 100, ttlMs: 20 });
      map.set("check", 1);

      expect(map.has("check")).toBe(true);

      vi.advanceTimersByTime(30);

      expect(map.has("check")).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("delete() removes an entry", () => {
    const map = new TTLMap<string, number>({ maxSize: 100, ttlMs: 60000 });
    map.set("del", 1);
    expect(map.delete("del")).toBe(true);
    expect(map.get("del")).toBeUndefined();
  });

  it("clear() removes all entries", () => {
    const map = new TTLMap<string, number>({ maxSize: 100, ttlMs: 60000 });
    map.set("a", 1);
    map.set("b", 2);
    map.clear();
    expect(map.size).toBe(0);
  });

  it("handles large number of entries without memory leak", () => {
    const map = new TTLMap<string, number>({ maxSize: 100, ttlMs: 60000 });

    for (let i = 0; i < 200; i++) {
      map.set(`key-${i}`, i);
    }

    // Should never exceed maxSize after eviction
    expect(map.size).toBeLessThanOrEqual(100);
  });
});
