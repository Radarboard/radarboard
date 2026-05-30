import { beforeEach, describe, expect, it, vi } from "vitest";
import { cn } from "./cn";
import { formatCurrency } from "./format-currency";
import { formatDateTime, isDateString } from "./format-date-time";
import { formatNumber } from "./format-number";
import { calculateChange, formatPercent } from "./format-percent";
import { formatTimeAgo } from "./format-time-ago";

describe("format helpers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-27T12:00:00.000Z"));
  });

  it("formats currency and number values in compact and non-compact modes", () => {
    expect(formatCurrency(1200)).toBe("$1,200");
    expect(formatCurrency(1200, "USD", { compact: true })).toBe("$1.2K");
    expect(formatNumber(2_500_000, { compact: true })).toBe("2.5M");
  });

  it("formats percentages, percentage change, time ago strings, and tailwind-aware class merges", () => {
    expect(formatPercent(12.345, 2)).toBe("+12.35%");
    expect(calculateChange(120, 100)).toBe(20);
    expect(formatTimeAgo("2026-03-27T11:30:00.000Z")).toBe("30m");
    expect(cn("text-w-sm", "text-w-lg", "px-2", "px-4")).toBe("text-w-lg px-4");
  });

  it("formats date-only and timestamp values without leaking raw ISO strings", () => {
    expect(isDateString("2026-03-27")).toBe(true);
    expect(isDateString("2026-03-27T12:30:00.000Z")).toBe(true);
    expect(isDateString("not-a-date")).toBe(false);
    expect(
      formatDateTime("2026-03-27", {
        compact: true,
        locale: "en-US",
        now: new Date("2026-03-27T12:00:00.000Z"),
      })
    ).toBe("Mar 27");
    expect(
      formatDateTime("2026-03-27T12:30:00.000Z", {
        compact: true,
        locale: "en-US",
        timeZone: "UTC",
        now: new Date("2026-03-27T12:00:00.000Z"),
      })
    ).toBe("Mar 27, 12:30 PM");
  });
});
