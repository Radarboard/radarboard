import {
  getTimeRangeWindow,
  isDateInTimeRange,
  isSameDayInTimeZone,
  normalizeTimeZone,
} from "@radarboard/utils/timezone";
import { describe, expect, it } from "vitest";

describe("time-range timezone helpers", () => {
  it("uses timezone-specific local dates for today windows", () => {
    const now = new Date("2026-03-19T02:30:00Z");

    expect(getTimeRangeWindow("today", "UTC", now)).toMatchObject({
      startDate: "2026-03-19",
      endDate: "2026-03-19",
    });
    expect(getTimeRangeWindow("today", "America/Toronto", now)).toMatchObject({
      startDate: "2026-03-18",
      endDate: "2026-03-18",
    });
  });

  it("filters dates against the selected timezone instead of raw UTC day boundaries", () => {
    const now = new Date("2026-03-19T02:30:00Z");
    const sample = "2026-03-18T12:00:00Z";

    expect(isDateInTimeRange(sample, "today", "America/Toronto", now)).toBe(true);
    expect(isDateInTimeRange(sample, "today", "UTC", now)).toBe(false);
  });

  it("compares same-day checks in the selected timezone", () => {
    const now = new Date("2026-03-19T02:30:00Z");
    const sample = "2026-03-18T12:00:00Z";

    expect(isSameDayInTimeZone(sample, "America/Toronto", now)).toBe(true);
    expect(isSameDayInTimeZone(sample, "UTC", now)).toBe(false);
  });

  it("falls back to UTC for invalid timezones", () => {
    expect(normalizeTimeZone("Mars/Olympus")).toBe("UTC");
  });
});
