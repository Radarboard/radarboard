import { describe, expect, it } from "vitest";
import { cronMatches } from "../scheduler";

describe("cronMatches", () => {
  it("matches wildcard pattern (every minute)", () => {
    expect(cronMatches("* * * * *", new Date("2026-03-24T08:30:00"))).toBe(true);
  });

  it("matches specific minute", () => {
    expect(cronMatches("30 * * * *", new Date("2026-03-24T08:30:00"))).toBe(true);
    expect(cronMatches("30 * * * *", new Date("2026-03-24T08:31:00"))).toBe(false);
  });

  it("matches specific hour and minute", () => {
    expect(cronMatches("0 8 * * *", new Date("2026-03-24T08:00:00"))).toBe(true);
    expect(cronMatches("0 8 * * *", new Date("2026-03-24T09:00:00"))).toBe(false);
  });

  it("matches day of week (Monday = 1)", () => {
    // 2026-03-23 is a Monday
    expect(cronMatches("0 8 * * 1", new Date("2026-03-23T08:00:00"))).toBe(true);
    // 2026-03-24 is a Tuesday
    expect(cronMatches("0 8 * * 1", new Date("2026-03-24T08:00:00"))).toBe(false);
  });

  it("matches step pattern (every 5 minutes)", () => {
    expect(cronMatches("*/5 * * * *", new Date("2026-03-24T08:00:00"))).toBe(true);
    expect(cronMatches("*/5 * * * *", new Date("2026-03-24T08:05:00"))).toBe(true);
    expect(cronMatches("*/5 * * * *", new Date("2026-03-24T08:03:00"))).toBe(false);
  });

  it("matches comma-separated values", () => {
    expect(cronMatches("0,30 * * * *", new Date("2026-03-24T08:00:00"))).toBe(true);
    expect(cronMatches("0,30 * * * *", new Date("2026-03-24T08:30:00"))).toBe(true);
    expect(cronMatches("0,30 * * * *", new Date("2026-03-24T08:15:00"))).toBe(false);
  });

  it("returns false for invalid cron", () => {
    expect(cronMatches("invalid", new Date())).toBe(false);
    expect(cronMatches("* * *", new Date())).toBe(false);
  });
});
