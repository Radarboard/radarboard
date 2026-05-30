import { describe, expect, it } from "vitest";
import { scanCorrelations } from "./correlation-scanner";

describe("scanCorrelations", () => {
  it("finds strong positive correlation", () => {
    const result = scanCorrelations([
      { integration: "a", action: "data", values: [1, 2, 3, 4, 5] },
      { integration: "b", action: "data", values: [2, 4, 6, 8, 10] },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.correlation).toBe(1);
    expect(result[0]?.strength).toBe("strong");
    expect(result[0]?.direction).toBe("positive");
  });

  it("finds strong negative correlation", () => {
    const result = scanCorrelations([
      { integration: "a", action: "data", values: [1, 2, 3, 4, 5] },
      { integration: "b", action: "data", values: [10, 8, 6, 4, 2] },
    ]);

    expect(result[0]?.correlation).toBe(-1);
    expect(result[0]?.direction).toBe("negative");
  });

  it("returns pairs sorted by absolute correlation", () => {
    const result = scanCorrelations([
      { integration: "a", action: "data", values: [1, 2, 3, 4, 5] },
      { integration: "b", action: "data", values: [2, 4, 6, 8, 10] },
      { integration: "c", action: "data", values: [3, 1, 4, 1, 5] },
    ]);

    expect(result.length).toBeGreaterThanOrEqual(2);
    const firstCorrelation = result[0]?.correlation ?? 0;
    const secondCorrelation = result[1]?.correlation ?? 0;
    expect(Math.abs(firstCorrelation)).toBeGreaterThanOrEqual(Math.abs(secondCorrelation));
  });

  it("respects topN limit", () => {
    const result = scanCorrelations(
      [
        { integration: "a", action: "data", values: [1, 2, 3, 4, 5] },
        { integration: "b", action: "data", values: [2, 4, 6, 8, 10] },
        { integration: "c", action: "data", values: [10, 8, 6, 4, 2] },
      ],
      1
    );

    expect(result).toHaveLength(1);
  });

  it("skips series with fewer than 3 points", () => {
    const result = scanCorrelations([
      { integration: "a", action: "data", values: [1, 2] },
      { integration: "b", action: "data", values: [3, 4] },
    ]);

    expect(result).toHaveLength(0);
  });

  it("returns empty for single series", () => {
    const result = scanCorrelations([
      { integration: "a", action: "data", values: [1, 2, 3, 4, 5] },
    ]);

    expect(result).toHaveLength(0);
  });
});
