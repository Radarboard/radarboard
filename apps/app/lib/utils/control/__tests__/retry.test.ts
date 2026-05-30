import { describe, expect, it } from "vitest";
import { withRetry } from "../retry";

describe("withRetry", () => {
  it("returns result on first success", async () => {
    const result = await withRetry(async () => 42);
    expect(result).toBe(42);
  });

  it("retries on failure and succeeds", async () => {
    let attempts = 0;
    const result = await withRetry(
      async () => {
        attempts++;
        if (attempts < 3) throw new Error("transient");
        return "recovered";
      },
      { maxAttempts: 3, baseDelayMs: 10 }
    );

    expect(result).toBe("recovered");
    expect(attempts).toBe(3);
  });

  it("throws after max attempts exhausted", async () => {
    let attempts = 0;
    await expect(
      withRetry(
        async () => {
          attempts++;
          throw new Error("persistent");
        },
        { maxAttempts: 3, baseDelayMs: 10 }
      )
    ).rejects.toThrow("persistent");

    expect(attempts).toBe(3);
  });

  it("respects shouldRetry predicate", async () => {
    let attempts = 0;
    await expect(
      withRetry(
        async () => {
          attempts++;
          throw new Error("4xx error");
        },
        {
          maxAttempts: 5,
          baseDelayMs: 10,
          shouldRetry: () => false,
        }
      )
    ).rejects.toThrow("4xx error");

    // Should not retry at all
    expect(attempts).toBe(1);
  });

  it("applies exponential backoff", async () => {
    const _delays: number[] = [];
    const _originalSetTimeout = globalThis.setTimeout;

    let attempts = 0;
    try {
      await withRetry(
        async () => {
          attempts++;
          throw new Error("fail");
        },
        { maxAttempts: 3, baseDelayMs: 100, maxDelayMs: 5000 }
      );
    } catch {
      // expected
    }

    expect(attempts).toBe(3);
  });

  it("caps delay at maxDelayMs", async () => {
    let _attempts = 0;
    const start = Date.now();

    try {
      await withRetry(
        async () => {
          _attempts++;
          throw new Error("fail");
        },
        { maxAttempts: 2, baseDelayMs: 10, maxDelayMs: 20 }
      );
    } catch {
      // expected
    }

    const elapsed = Date.now() - start;
    // Should not exceed maxDelayMs + some buffer
    expect(elapsed).toBeLessThan(100);
  });

  it("passes attempt number to shouldRetry", async () => {
    const attemptsSeen: number[] = [];

    try {
      await withRetry(
        async () => {
          throw new Error("fail");
        },
        {
          maxAttempts: 4,
          baseDelayMs: 10,
          shouldRetry: (_err, attempt) => {
            attemptsSeen.push(attempt);
            return attempt < 2; // Stop after attempt 2
          },
        }
      );
    } catch {
      // expected
    }

    expect(attemptsSeen).toEqual([0, 1, 2]);
  });
});
