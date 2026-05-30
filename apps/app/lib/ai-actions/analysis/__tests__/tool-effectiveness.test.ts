import { afterEach, describe, expect, it } from "vitest";
import {
  getToolEffectiveness,
  recordToolOutcome,
  resetToolEffectiveness,
} from "../tool-effectiveness";

afterEach(() => {
  resetToolEffectiveness();
});

describe("tool effectiveness", () => {
  it("records and retrieves tool outcomes", () => {
    recordToolOutcome("get_revenue", true);
    recordToolOutcome("get_revenue", true, "positive");
    recordToolOutcome("get_revenue", false, "negative");

    const results = getToolEffectiveness("get_revenue");
    expect(results).toHaveLength(1);
    expect(results[0]?.totalCalls).toBe(3);
    expect(results[0]?.positiveRatings).toBe(1);
    expect(results[0]?.negativeRatings).toBe(1);
  });

  it("calculates success rate", () => {
    recordToolOutcome("tool_a", true);
    recordToolOutcome("tool_a", true);
    recordToolOutcome("tool_a", false);

    const results = getToolEffectiveness("tool_a");
    expect(results[0]?.successRate).toBeCloseTo(0.667, 2);
  });

  it("returns all tools sorted by score", () => {
    recordToolOutcome("good_tool", true, "positive");
    recordToolOutcome("good_tool", true, "positive");
    recordToolOutcome("bad_tool", false, "negative");
    recordToolOutcome("bad_tool", false, "negative");

    const results = getToolEffectiveness();
    expect(results).toHaveLength(2);
    expect(results[0]?.toolId).toBe("good_tool");
    expect(results[0]?.score).toBeGreaterThan(results[1]?.score);
  });

  it("returns empty for no data", () => {
    expect(getToolEffectiveness()).toHaveLength(0);
  });
});
