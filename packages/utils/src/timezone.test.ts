import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getDateStringInTimeZone,
  getStartOfTodayInTimeZone,
  isSameDayInTimeZone,
  normalizeTimeZone,
  resolveEffectiveTimeZone,
} from "./timezone";

describe("timezone helpers", () => {
  beforeEach(() => {
    const resolvedOptions = new Intl.DateTimeFormat().resolvedOptions();
    vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue({
      ...resolvedOptions,
      timeZone: "America/Toronto",
    });
  });

  it("normalizes invalid preferences and resolves browser time zone for auto mode", () => {
    expect(normalizeTimeZone("Invalid/Zone")).toBe("UTC");
    expect(resolveEffectiveTimeZone(null)).toBe("America/Toronto");
    expect(resolveEffectiveTimeZone("Europe/Paris")).toBe("Europe/Paris");
  });

  it("computes same-day checks and local midnight in a target time zone", () => {
    const now = new Date("2026-03-27T12:00:00.000Z");

    expect(getDateStringInTimeZone(now, "America/Toronto")).toBe("2026-03-27");
    expect(isSameDayInTimeZone("2026-03-27T05:00:00.000Z", "America/Toronto", now)).toBe(true);
    expect(getStartOfTodayInTimeZone("America/Toronto", now).toISOString()).toBe(
      "2026-03-27T04:00:00.000Z"
    );
  });
});
