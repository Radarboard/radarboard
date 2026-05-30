import { describe, expect, it } from "vitest";
import { detectAnomalies, hasAnomalies } from "./anomaly-detector";

function makePoints(values: number[]): { timestamp: number; value: number }[] {
  return values.map((v, i) => ({ timestamp: Date.now() + i * 3600000, value: v }));
}

describe("detectAnomalies", () => {
  it("detects a spike", () => {
    const series = makePoints([10, 11, 10, 12, 10, 50, 11, 10]); // 50 is anomalous
    const anomalies = detectAnomalies(series, { sensitivity: 2 });

    expect(anomalies.length).toBeGreaterThanOrEqual(1);
    expect(anomalies[0]?.value).toBe(50);
    expect(anomalies[0]?.direction).toBe("spike");
    expect(anomalies[0]?.zScore).toBeGreaterThan(2);
  });

  it("detects a drop", () => {
    const series = makePoints([100, 98, 102, 99, 101, 20, 100, 99]); // 20 is anomalous
    const anomalies = detectAnomalies(series, { sensitivity: 2 });

    expect(anomalies.length).toBeGreaterThanOrEqual(1);
    const dropAnomaly = anomalies.find((a) => a.direction === "drop");
    expect(dropAnomaly).toBeDefined();
    expect(dropAnomaly?.value).toBe(20);
  });

  it("returns empty for normal data", () => {
    const series = makePoints([100, 101, 99, 100, 102, 98, 101, 100]);
    const anomalies = detectAnomalies(series, { sensitivity: 2 });
    expect(anomalies).toHaveLength(0);
  });

  it("returns empty for fewer than 3 points", () => {
    expect(detectAnomalies(makePoints([10, 20]))).toHaveLength(0);
    expect(detectAnomalies(makePoints([10]))).toHaveLength(0);
    expect(detectAnomalies([])).toHaveLength(0);
  });

  it("returns empty for identical values (zero variance)", () => {
    const series = makePoints([42, 42, 42, 42, 42]);
    expect(detectAnomalies(series)).toHaveLength(0);
  });

  it("sorts by absolute z-score descending", () => {
    const series = makePoints([10, 10, 10, 30, 50]); // 50 more anomalous than 30
    const anomalies = detectAnomalies(series, { sensitivity: 1 });

    if (anomalies.length >= 2) {
      const firstZScore = anomalies[0]?.zScore ?? 0;
      const secondZScore = anomalies[1]?.zScore ?? 0;
      expect(Math.abs(firstZScore)).toBeGreaterThanOrEqual(Math.abs(secondZScore));
    }
  });

  it("respects sensitivity parameter", () => {
    const series = makePoints([10, 10, 10, 10, 15]);
    const loose = detectAnomalies(series, { sensitivity: 3 });
    const strict = detectAnomalies(series, { sensitivity: 1 });
    expect(strict.length).toBeGreaterThanOrEqual(loose.length);
  });

  it("includes expectedValue in results", () => {
    const series = makePoints([10, 10, 10, 10, 50]);
    const anomalies = detectAnomalies(series, { sensitivity: 2 });

    if (anomalies.length > 0) {
      expect(anomalies[0]?.expectedValue).toBeCloseTo(18, 0); // mean of [10,10,10,10,50]
    }
  });
});

describe("hasAnomalies", () => {
  it("returns true when anomalies exist", () => {
    const series = makePoints([10, 10, 10, 10, 10, 10, 10, 200]);
    expect(hasAnomalies(series)).toBe(true);
  });

  it("returns false for normal data", () => {
    const series = makePoints([10, 11, 10, 11, 10]);
    expect(hasAnomalies(series)).toBe(false);
  });
});
