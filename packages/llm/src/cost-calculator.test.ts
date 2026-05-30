import { describe, expect, it } from "vitest";
import { aggregateCosts, calculateCost, getModelPricing } from "./cost-calculator";

describe("calculateCost", () => {
  it("calculates Anthropic Sonnet 4.6 cost", () => {
    // 1000 input tokens + 500 output tokens
    // Input: (1000 / 1M) * $3 = $0.003
    // Output: (500 / 1M) * $15 = $0.0075
    const cost = calculateCost("anthropic", "claude-sonnet-4-6", 1000, 500);
    expect(cost.inputCostUsd).toBe(0.003);
    expect(cost.outputCostUsd).toBe(0.0075);
    expect(cost.totalCostUsd).toBe(0.0105);
  });

  it("calculates Anthropic Opus 4.6 cost", () => {
    const cost = calculateCost("anthropic", "claude-opus-4-6", 10000, 2000);
    // Input: (10000 / 1M) * $15 = $0.15
    // Output: (2000 / 1M) * $75 = $0.15
    expect(cost.inputCostUsd).toBe(0.15);
    expect(cost.outputCostUsd).toBe(0.15);
    expect(cost.totalCostUsd).toBe(0.3);
  });

  it("calculates Haiku cost (cheapest)", () => {
    const cost = calculateCost("anthropic", "claude-haiku-4-5", 5000, 1000);
    // Input: (5000 / 1M) * $0.8 = $0.004
    // Output: (1000 / 1M) * $4 = $0.004
    expect(cost.inputCostUsd).toBe(0.004);
    expect(cost.outputCostUsd).toBe(0.004);
    expect(cost.totalCostUsd).toBe(0.008);
  });

  it("returns zero for Ollama (local)", () => {
    const cost = calculateCost("ollama", "llama3", 50000, 10000);
    expect(cost.inputCostUsd).toBe(0);
    expect(cost.outputCostUsd).toBe(0);
    expect(cost.totalCostUsd).toBe(0);
  });

  it("uses default pricing for unknown models", () => {
    const cost = calculateCost("anthropic", "unknown-model", 1000, 1000);
    // Default: $3/1M input, $15/1M output
    expect(cost.inputCostUsd).toBe(0.003);
    expect(cost.outputCostUsd).toBe(0.015);
  });

  it("handles zero tokens", () => {
    const cost = calculateCost("anthropic", "claude-sonnet-4-6", 0, 0);
    expect(cost.totalCostUsd).toBe(0);
  });
});

describe("getModelPricing", () => {
  it("returns pricing for known model", () => {
    const pricing = getModelPricing("anthropic", "claude-sonnet-4-6");
    expect(pricing).toEqual({ inputPer1M: 3, outputPer1M: 15 });
  });

  it("returns null for local providers", () => {
    expect(getModelPricing("ollama", "llama3")).toBeNull();
  });

  it("returns default for unknown model", () => {
    const pricing = getModelPricing("openai", "gpt-future");
    expect(pricing).toEqual({ inputPer1M: 3, outputPer1M: 15 });
  });
});

describe("aggregateCosts", () => {
  it("sums costs across traces", () => {
    const result = aggregateCosts([
      {
        providerId: "anthropic",
        modelId: "claude-sonnet-4-6",
        promptTokens: 1000,
        completionTokens: 500,
      },
      {
        providerId: "anthropic",
        modelId: "claude-haiku-4-5",
        promptTokens: 2000,
        completionTokens: 1000,
      },
    ]);

    // Sonnet: $0.003 + $0.0075 = $0.0105
    // Haiku: $0.0016 + $0.004 = $0.0056
    expect(result.totalCostUsd).toBeCloseTo(0.0161, 4);
  });

  it("handles empty array", () => {
    const result = aggregateCosts([]);
    expect(result.totalCostUsd).toBe(0);
  });
});
