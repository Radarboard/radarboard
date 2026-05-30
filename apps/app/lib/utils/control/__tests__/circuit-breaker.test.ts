import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CircuitOpenError,
  getCircuitState,
  getRemainingCooldownMs,
  resetAllCircuits,
  withCircuitBreaker,
} from "../circuit-breaker";

afterEach(() => {
  resetAllCircuits();
});

describe("withCircuitBreaker", () => {
  it("passes through when circuit is closed", async () => {
    const result = await withCircuitBreaker("test", async () => 42);
    expect(result).toBe(42);
    expect(getCircuitState("test")).toBe("closed");
  });

  it("opens after threshold consecutive failures", async () => {
    const config = { threshold: 3, baseCooldownMs: 1000, maxCooldownMs: 60000 };

    for (let i = 0; i < 3; i++) {
      await expect(
        withCircuitBreaker(
          "api",
          async () => {
            throw new Error("fail");
          },
          config
        )
      ).rejects.toThrow("fail");
    }

    expect(getCircuitState("api", config)).toBe("open");

    // 4th call should throw CircuitOpenError without executing fn
    const fn = vi.fn();
    await expect(withCircuitBreaker("api", fn, config)).rejects.toThrow(CircuitOpenError);
    expect(fn).not.toHaveBeenCalled();
  });

  it("resets on success", async () => {
    const config = { threshold: 2 };

    // Fail once
    await expect(
      withCircuitBreaker(
        "reset-test",
        async () => {
          throw new Error("fail");
        },
        config
      )
    ).rejects.toThrow();

    // Succeed
    await withCircuitBreaker("reset-test", async () => "ok", config);

    // Circuit should be closed
    expect(getCircuitState("reset-test", config)).toBe("closed");
  });

  it("transitions to half_open after cooldown expires", async () => {
    const config = { threshold: 1, baseCooldownMs: 50 };

    await expect(
      withCircuitBreaker(
        "half-open",
        async () => {
          throw new Error("fail");
        },
        config
      )
    ).rejects.toThrow();

    expect(getCircuitState("half-open", config)).toBe("open");

    // Wait for cooldown
    await new Promise((r) => setTimeout(r, 60));

    expect(getCircuitState("half-open", config)).toBe("half_open");

    // Should allow the probe call
    const result = await withCircuitBreaker("half-open", async () => "recovered", config);
    expect(result).toBe("recovered");
    expect(getCircuitState("half-open", config)).toBe("closed");
  });

  it("re-opens on half_open probe failure", async () => {
    const config = { threshold: 1, baseCooldownMs: 50 };

    await expect(
      withCircuitBreaker(
        "reopen",
        async () => {
          throw new Error("fail");
        },
        config
      )
    ).rejects.toThrow();

    await new Promise((r) => setTimeout(r, 60));
    expect(getCircuitState("reopen", config)).toBe("half_open");

    // Probe fails — should re-open
    await expect(
      withCircuitBreaker(
        "reopen",
        async () => {
          throw new Error("still failing");
        },
        config
      )
    ).rejects.toThrow();

    expect(getCircuitState("reopen", config)).toBe("open");
  });

  it("uses exponential backoff for cooldown", async () => {
    const config = { threshold: 2, baseCooldownMs: 1000, maxCooldownMs: 60000 };

    // Fail exactly threshold times to open circuit
    for (let i = 0; i < 2; i++) {
      await expect(
        withCircuitBreaker(
          "backoff",
          async () => {
            throw new Error("fail");
          },
          config
        )
      ).rejects.toThrow("fail");
    }

    // Circuit is now open with 2 failures
    // Cooldown = baseCooldownMs * 2^(failures - threshold) = 1000 * 2^0 = 1000ms
    const remaining = getRemainingCooldownMs("backoff", config);
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(1100);
  });

  it("caps cooldown at maxCooldownMs", async () => {
    const config = { threshold: 1, baseCooldownMs: 1000, maxCooldownMs: 5000 };

    // Fail 20 times to trigger very high backoff
    for (let i = 0; i < 20; i++) {
      try {
        await withCircuitBreaker(
          "capped",
          async () => {
            throw new Error("fail");
          },
          config
        );
      } catch {
        // expected
      }
    }

    const remaining = getRemainingCooldownMs("capped", config);
    expect(remaining).toBeLessThanOrEqual(5000);
  });

  it("isolates circuits by key", async () => {
    const config = { threshold: 2 };

    for (let i = 0; i < 2; i++) {
      await expect(
        withCircuitBreaker(
          "key-a",
          async () => {
            throw new Error("fail");
          },
          config
        )
      ).rejects.toThrow();
    }

    expect(getCircuitState("key-a", config)).toBe("open");
    expect(getCircuitState("key-b", config)).toBe("closed");

    // key-b should still work
    const result = await withCircuitBreaker("key-b", async () => "ok", config);
    expect(result).toBe("ok");
  });

  it("CircuitOpenError has retryAfterMs", async () => {
    const config = { threshold: 1, baseCooldownMs: 5000 };

    await expect(
      withCircuitBreaker(
        "err-test",
        async () => {
          throw new Error("fail");
        },
        config
      )
    ).rejects.toThrow();

    try {
      await withCircuitBreaker("err-test", async () => {}, config);
    } catch (err) {
      expect(err).toBeInstanceOf(CircuitOpenError);
      const ce = err as CircuitOpenError;
      expect(ce.circuitKey).toBe("err-test");
      expect(ce.retryAfterMs).toBeGreaterThan(0);
    }
  });
});
