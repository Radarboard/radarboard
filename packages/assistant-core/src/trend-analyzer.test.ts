import { describe, expect, it } from "vitest";
import { analyzeTrend } from "./trend-analyzer";

describe("analyzeTrend", () => {
  it("detects upward trend", () => {
    const result = analyzeTrend([100, 110, 120], [80, 85, 90]);
    expect(result.direction).toBe("up");
    expect(result.changePct).toBeGreaterThan(0);
  });

  it("detects downward trend", () => {
    const result = analyzeTrend([50, 45, 40], [80, 85, 90]);
    expect(result.direction).toBe("down");
    expect(result.changePct).toBeLessThan(0);
  });

  it("detects flat trend within threshold", () => {
    const result = analyzeTrend([100, 101, 100], [100, 99, 100]);
    expect(result.direction).toBe("flat");
    expect(Math.abs(result.changePct)).toBeLessThan(2);
  });

  it("computes correct percentage change", () => {
    // Previous avg: 100, Current avg: 150 → +50%
    const result = analyzeTrend([150], [100]);
    expect(result.changePct).toBe(50);
  });

  it("computes velocity (slope)", () => {
    // Strictly increasing: slope should be positive
    const result = analyzeTrend([10, 20, 30, 40], [5, 10, 15, 20]);
    expect(result.velocity).toBeGreaterThan(0);
  });

  it("forecasts based on linear trend", () => {
    const result = analyzeTrend([10, 20, 30], [5, 10, 15]);
    // Last value: 30, velocity ~10/point, forecast = 30 + 10*7 = 100
    expect(result.forecast7d).toBeGreaterThan(30);
  });

  it("handles empty arrays", () => {
    const result = analyzeTrend([], []);
    expect(result.direction).toBe("flat");
    expect(result.changePct).toBe(0);
    expect(result.currentAvg).toBe(0);
    expect(result.previousAvg).toBe(0);
  });

  it("handles zero previous average", () => {
    const result = analyzeTrend([10, 20], [0, 0]);
    expect(result.direction).toBe("up");
    expect(result.changePct).toBe(100);
  });

  it("returns rounded values", () => {
    const result = analyzeTrend([33.333, 66.666], [11.111, 22.222]);
    expect(Number.isFinite(result.changePct)).toBe(true);
    expect(Number.isFinite(result.velocity)).toBe(true);
    expect(Number.isFinite(result.forecast7d)).toBe(true);
  });
});
