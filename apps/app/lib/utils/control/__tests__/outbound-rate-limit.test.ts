import { afterEach, describe, expect, it } from "vitest";
import {
  OutboundRateLimitError,
  resetOutboundRateLimits,
  withOutboundRateLimit,
} from "../outbound-rate-limit";

afterEach(() => {
  resetOutboundRateLimits();
});

describe("withOutboundRateLimit", () => {
  it("allows requests within budget", async () => {
    const result = await withOutboundRateLimit("npm", async () => "data");
    expect(result).toBe("data");
  });

  it("exhausts budget and throws OutboundRateLimitError", async () => {
    // revenuecat has maxTokens: 5
    for (let i = 0; i < 5; i++) {
      await withOutboundRateLimit("revenuecat", async () => "ok");
    }

    await expect(withOutboundRateLimit("revenuecat", async () => "blocked")).rejects.toThrow(
      OutboundRateLimitError
    );
  });

  it("OutboundRateLimitError has retryAfterMs", async () => {
    for (let i = 0; i < 5; i++) {
      await withOutboundRateLimit("revenuecat", async () => {});
    }

    try {
      await withOutboundRateLimit("revenuecat", async () => {});
    } catch (err) {
      expect(err).toBeInstanceOf(OutboundRateLimitError);
      const rl = err as OutboundRateLimitError;
      expect(rl.integrationKey).toBe("revenuecat");
      expect(rl.retryAfterMs).toBeGreaterThan(0);
    }
  });

  it("isolates budgets by integration", async () => {
    // Exhaust revenuecat
    for (let i = 0; i < 5; i++) {
      await withOutboundRateLimit("revenuecat", async () => {});
    }

    // npm should still work
    const result = await withOutboundRateLimit("npm", async () => "ok");
    expect(result).toBe("ok");
  });

  it("uses default config for unknown integrations", async () => {
    // Default has maxTokens: 30
    for (let i = 0; i < 30; i++) {
      await withOutboundRateLimit("unknown-integration", async () => {});
    }

    await expect(withOutboundRateLimit("unknown-integration", async () => {})).rejects.toThrow(
      OutboundRateLimitError
    );
  });

  it("refills tokens over time", async () => {
    // Use a custom config via the integration map — revenuecat has low limits
    for (let i = 0; i < 5; i++) {
      await withOutboundRateLimit("revenuecat", async () => {});
    }

    // Wait for some refill (revenuecat refillRate: 0.08/s)
    await new Promise((r) => setTimeout(r, 50));

    // Should still be limited since refill is very slow
    await expect(withOutboundRateLimit("revenuecat", async () => {})).rejects.toThrow(
      OutboundRateLimitError
    );
  });
});
