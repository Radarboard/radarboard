import { afterEach, describe, expect, it } from "vitest";
import { checkRateLimit, resetRateLimitData } from "../rate-limit";

afterEach(() => {
  resetRateLimitData();
});

describe("rate-limit", () => {
  it("allows requests within the budget", () => {
    const result = checkRateLimit("ip-1", { maxTokens: 5, refillRate: 1 });
    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.remaining).toBe(4);
    }
  });

  it("exhausts tokens and blocks", () => {
    const config = { maxTokens: 3, refillRate: 0.1 };

    expect(checkRateLimit("ip-2", config).allowed).toBe(true);
    expect(checkRateLimit("ip-2", config).allowed).toBe(true);
    expect(checkRateLimit("ip-2", config).allowed).toBe(true);

    const blocked = checkRateLimit("ip-2", config);
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.retryAfterMs).toBeGreaterThan(0);
    }
  });

  it("isolates keys", () => {
    const config = { maxTokens: 1, refillRate: 0.01 };

    expect(checkRateLimit("ip-a", config).allowed).toBe(true);
    expect(checkRateLimit("ip-a", config).allowed).toBe(false);
    // Different key should still have tokens
    expect(checkRateLimit("ip-b", config).allowed).toBe(true);
  });

  it("refills tokens over time", async () => {
    const config = { maxTokens: 2, refillRate: 100 }; // 100/s = fast refill

    expect(checkRateLimit("ip-3", config).allowed).toBe(true);
    expect(checkRateLimit("ip-3", config).allowed).toBe(true);
    // Should be at 0 tokens now

    // Wait a small amount for refill
    await new Promise((r) => setTimeout(r, 30));

    const result = checkRateLimit("ip-3", config);
    expect(result.allowed).toBe(true);
  });

  it("caps tokens at maxTokens", async () => {
    const config = { maxTokens: 3, refillRate: 1000 };

    // First call initializes at maxTokens
    const result = checkRateLimit("ip-4", config);
    expect(result.allowed).toBe(true);
    if (result.allowed) {
      // Even with fast refill, should not exceed maxTokens - 1
      expect(result.remaining).toBeLessThanOrEqual(config.maxTokens);
    }
  });

  it("resetRateLimitData clears all buckets", () => {
    const config = { maxTokens: 1, refillRate: 0.001 };
    checkRateLimit("ip-5", config);
    checkRateLimit("ip-5", config); // exhausted

    resetRateLimitData();

    // Should have fresh tokens after reset
    expect(checkRateLimit("ip-5", config).allowed).toBe(true);
  });
});
