import { describe, expect, it } from "vitest";
import { buildTimelineBuckets, formatClock, isQuickRangeActive } from "../";

describe("buildTimelineBuckets", () => {
  it("builds buckets and counts severity totals", () => {
    const buckets = buildTimelineBuckets(
      [
        { occurredAt: "2026-03-19T20:00:00Z", level: "info" },
        { occurredAt: "2026-03-19T20:05:00Z", level: "error" },
        { occurredAt: "2026-03-19T20:10:00Z", level: "warn" },
      ],
      6
    );

    expect(buckets).toHaveLength(6);
    expect(buckets.some((bucket) => bucket.errorCount > 0)).toBe(true);
    expect(buckets.some((bucket) => bucket.warnCount > 0)).toBe(true);
    expect(buckets.reduce((sum, bucket) => sum + bucket.count, 0)).toBe(3);
  });
});

describe("isQuickRangeActive", () => {
  it("detects an active quick range", () => {
    const end = Date.parse("2026-03-19T20:30:00Z");
    const start = end - 15 * 60 * 1000;
    expect(isQuickRangeActive(start, end, end, 15 * 60 * 1000)).toBe(true);
  });

  it("returns false when the range does not match", () => {
    const end = Date.parse("2026-03-19T20:30:00Z");
    const start = end - 30 * 60 * 1000;
    expect(isQuickRangeActive(start, end, end, 15 * 60 * 1000)).toBe(false);
  });
});

describe("formatClock", () => {
  it("formats timestamps into human-readable clock strings", () => {
    expect(formatClock(Date.parse("2026-03-19T20:30:00Z"))).toMatch(/:/);
  });
});
