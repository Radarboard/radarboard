import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@libsql/client", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@libsql/client";
import { TursoCacheRepository } from "../turso-cache";

const mockExecute = vi.fn();

let repo: TursoCacheRepository;

beforeEach(() => {
  mockExecute.mockReset();
  vi.mocked(createClient).mockReturnValue({ execute: mockExecute } as unknown as ReturnType<
    typeof createClient
  >);
  repo = new TursoCacheRepository({ url: "libsql://test.turso.io", authToken: "test-token" });
});

describe("TursoCacheRepository", () => {
  describe("get", () => {
    it("returns null when no rows", async () => {
      mockExecute.mockResolvedValue({ rows: [] });

      const result = await repo.get("missing-key");

      expect(result).toBeNull();
      expect(mockExecute).toHaveBeenCalledWith({
        sql: "SELECT key, data, fetched_at, ttl_seconds FROM api_cache WHERE key = ?",
        args: ["missing-key"],
      });
    });

    it("returns CacheEntry when row exists", async () => {
      mockExecute.mockResolvedValue({
        rows: [{ key: "test:key", data: '{"x":1}', fetched_at: 1000, ttl_seconds: 300 }],
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
    it("executes INSERT...ON CONFLICT SQL with correct args", async () => {
      mockExecute.mockResolvedValue({ rows: [] });

      await repo.set({
        key: "test:key",
        route: "/api/test",
        data: '{"x":1}',
        fetchedAt: 1000,
        ttlSeconds: 300,
      });

      expect(mockExecute).toHaveBeenCalledOnce();
      const call = mockExecute.mock.calls[0][0];
      expect(call.sql).toContain("INSERT INTO api_cache");
      expect(call.sql).toContain("ON CONFLICT(key) DO UPDATE");
      expect(call.args).toEqual([
        "test:key",
        "/api/test",
        '{"x":1}',
        1000,
        300,
        '{"x":1}',
        1000,
        300,
      ]);
    });
  });

  describe("delete", () => {
    it("executes DELETE with correct key", async () => {
      mockExecute.mockResolvedValue({ rows: [] });

      await repo.delete("test:key");

      expect(mockExecute).toHaveBeenCalledWith({
        sql: "DELETE FROM api_cache WHERE key = ?",
        args: ["test:key"],
      });
    });
  });

  describe("clear", () => {
    it("executes DELETE without filter", async () => {
      mockExecute.mockResolvedValue({ rows: [] });

      await repo.clear();

      expect(mockExecute).toHaveBeenCalledWith("DELETE FROM api_cache");
    });
  });

  describe("getKeysByRoute", () => {
    it("returns keys from filtered query", async () => {
      mockExecute.mockResolvedValue({
        rows: [{ key: "k1" }, { key: "k2" }],
      });

      const result = await repo.getKeysByRoute("/api/test");

      expect(result).toEqual(["k1", "k2"]);
      expect(mockExecute).toHaveBeenCalledWith({
        sql: "SELECT key FROM api_cache WHERE route = ?",
        args: ["/api/test"],
      });
    });
  });
});
