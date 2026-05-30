import { afterEach, describe, expect, it } from "vitest";
import type { ModelSelection } from "./model-fallback";
import { resetModelFallback, withModelFallback } from "./model-fallback";

afterEach(() => {
  resetModelFallback();
});

const primary: ModelSelection = {
  providerId: "anthropic",
  modelId: "claude-sonnet-4-6",
  apiKey: "key1",
};
const fallback1: ModelSelection = { providerId: "openai", modelId: "gpt-4o", apiKey: "key2" };
const fallback2: ModelSelection = {
  providerId: "google",
  modelId: "gemini-1.5-pro",
  apiKey: "key3",
};

describe("withModelFallback", () => {
  it("uses primary provider when healthy", async () => {
    const result = await withModelFallback(
      primary,
      [fallback1],
      async (sel) => `response from ${sel.providerId}`,
      { maxRetriesPerProvider: 0, baseRetryDelayMs: 10 }
    );

    expect(result.result).toBe("response from anthropic");
    expect(result.usedProvider.providerId).toBe("anthropic");
    expect(result.fellBack).toBe(false);
  });

  it("falls back to alternative when primary fails", async () => {
    let _callCount = 0;
    const result = await withModelFallback(
      primary,
      [fallback1],
      async (sel) => {
        _callCount++;
        if (sel.providerId === "anthropic") throw new Error("API down");
        return `response from ${sel.providerId}`;
      },
      { maxRetriesPerProvider: 0, circuitThreshold: 10, baseRetryDelayMs: 10 }
    );

    expect(result.result).toBe("response from openai");
    expect(result.usedProvider.providerId).toBe("openai");
    expect(result.fellBack).toBe(true);
  });

  it("tries multiple fallbacks in order", async () => {
    const tried: string[] = [];
    const result = await withModelFallback(
      primary,
      [fallback1, fallback2],
      async (sel) => {
        tried.push(sel.providerId);
        if (sel.providerId !== "google") throw new Error("down");
        return "ok";
      },
      { maxRetriesPerProvider: 0, circuitThreshold: 10, baseRetryDelayMs: 10 }
    );

    expect(tried).toEqual(["anthropic", "openai", "google"]);
    expect(result.usedProvider.providerId).toBe("google");
  });

  it("throws when all providers fail", async () => {
    await expect(
      withModelFallback(
        primary,
        [fallback1],
        async () => {
          throw new Error("down");
        },
        { maxRetriesPerProvider: 0, circuitThreshold: 10, baseRetryDelayMs: 10 }
      )
    ).rejects.toThrow("All LLM providers failed");
  });

  it("retries on last provider before giving up", async () => {
    let attempts = 0;
    const result = await withModelFallback(
      primary,
      [], // No alternatives — primary is the last provider
      async () => {
        attempts++;
        if (attempts < 3) throw new Error("transient");
        return "recovered";
      },
      { maxRetriesPerProvider: 2, circuitThreshold: 10, baseRetryDelayMs: 10 }
    );

    expect(result.result).toBe("recovered");
    expect(result.fellBack).toBe(false);
    expect(attempts).toBe(3);
  });

  it("skips unhealthy providers (circuit open)", async () => {
    // First: fail primary enough to open circuit
    for (let i = 0; i < 3; i++) {
      try {
        await withModelFallback(
          primary,
          [fallback1],
          async (sel) => {
            if (sel.providerId === "anthropic") throw new Error("down");
            return "ok";
          },
          { maxRetriesPerProvider: 0, circuitThreshold: 3, baseRetryDelayMs: 10 }
        );
      } catch {
        // may throw if all fail
      }
    }

    // Now primary should be skipped (circuit open), going straight to fallback
    const tried: string[] = [];
    await withModelFallback(
      primary,
      [fallback1],
      async (sel) => {
        tried.push(sel.providerId);
        return "ok";
      },
      { circuitThreshold: 3, baseRetryDelayMs: 10 }
    );

    // Primary should be skipped
    expect(tried).toEqual(["openai"]);
  });
});
