import { describe, expect, it } from "vitest";
import { compareMetrics, pearsonCorrelation } from "../compare-metrics";

describe("pearsonCorrelation", () => {
  it("returns 1 for perfectly correlated arrays", () => {
    expect(pearsonCorrelation([1, 2, 3, 4, 5], [2, 4, 6, 8, 10])).toBe(1);
  });

  it("returns -1 for perfectly inversely correlated arrays", () => {
    expect(pearsonCorrelation([1, 2, 3, 4, 5], [10, 8, 6, 4, 2])).toBe(-1);
  });

  it("returns 0 for uncorrelated arrays", () => {
    const r = pearsonCorrelation([1, 2, 3, 4, 5], [3, 1, 4, 1, 5]);
    expect(Math.abs(r)).toBeLessThan(0.5);
  });

  it("returns 0 for arrays shorter than 3", () => {
    expect(pearsonCorrelation([1, 2], [3, 4])).toBe(0);
  });

  it("handles arrays of different lengths (uses shorter)", () => {
    const r = pearsonCorrelation([1, 2, 3, 4], [2, 4, 6]);
    expect(r).toBe(1);
  });
});

describe("compareMetrics", () => {
  it("detects aligned upward trends", () => {
    const result = compareMetrics(
      { integration: "openpanel", action: "data" },
      [10, 20, 30, 40, 50, 60],
      { integration: "revenuecat", action: "data" },
      [5, 10, 15, 20, 25, 30]
    );

    expect(result.metricA.direction).toBe("up");
    expect(result.metricB.direction).toBe("up");
    expect(result.aligned).toBe(true);
    expect(result.correlation).toBeGreaterThan(0.9);
  });

  it("detects inverse correlation", () => {
    const result = compareMetrics(
      { integration: "a", action: "x" },
      [10, 20, 30, 40, 50, 60],
      { integration: "b", action: "y" },
      [60, 50, 40, 30, 20, 10]
    );

    expect(result.correlation).toBeLessThan(-0.9);
    expect(result.aligned).toBe(false);
  });

  it("includes a summary string", () => {
    const result = compareMetrics(
      { integration: "openpanel", action: "data" },
      [10, 10, 10, 20, 20, 20],
      { integration: "revenuecat", action: "data" },
      [5, 5, 5, 10, 10, 10]
    );

    expect(result.summary).toContain("openpanel/data");
    expect(result.summary).toContain("revenuecat/data");
    expect(result.summary).toContain("correlation");
  });
});
