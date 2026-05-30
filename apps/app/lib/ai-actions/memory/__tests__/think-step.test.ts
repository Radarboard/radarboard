import { describe, expect, it } from "vitest";
import { thinkStep } from "../think-step";

describe("thinkStep", () => {
  it("echoes back the thought", () => {
    const result = thinkStep({ thought: "Revenue dropped 20%, checking BetterStack next" });
    expect(result.recorded).toBe(true);
    expect(result.thought).toBe("Revenue dropped 20%, checking BetterStack next");
  });

  it("includes plan when provided", () => {
    const result = thinkStep({
      thought: "Investigating anomaly",
      plan: ["Check BetterStack", "Check Sentry", "Compare with previous week"],
    });
    expect(result.plan).toHaveLength(3);
  });

  it("plan is undefined when not provided", () => {
    const result = thinkStep({ thought: "Just thinking" });
    expect(result.plan).toBeUndefined();
  });
});
