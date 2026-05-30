import { afterEach, describe, expect, it } from "vitest";
import { getSpendingStatus, recordSpending, resetSpending } from "./spending-tracker";

afterEach(() => {
  resetSpending();
});

const budget = { dailyLimitUsd: 1, monthlyLimitUsd: 10, alertThresholdPct: 80 };

describe("recordSpending", () => {
  it("accumulates cost and returns no alerts under threshold", () => {
    // Haiku: ~$0.008 per (5000 input, 1000 output) — well under $1 daily
    const alerts = recordSpending("anthropic", "claude-haiku-4-5", 5000, 1000, budget);
    expect(alerts).toHaveLength(0);
  });

  it("triggers daily threshold alert at 80%", () => {
    // Sonnet: (100000/1M)*$3 + (50000/1M)*$15 = $0.30 + $0.75 = $1.05
    // This exceeds $1 daily limit
    const alerts = recordSpending("anthropic", "claude-sonnet-4-6", 100000, 50000, budget);
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts.some((a) => a.type === "daily_exceeded" || a.type === "daily_threshold")).toBe(
      true
    );
  });

  it("returns no alerts without budget", () => {
    const alerts = recordSpending("anthropic", "claude-opus-4-6", 1000000, 500000, null);
    expect(alerts).toHaveLength(0);
  });

  it("accumulates across multiple calls", () => {
    recordSpending("anthropic", "claude-haiku-4-5", 5000, 1000, budget);
    recordSpending("anthropic", "claude-haiku-4-5", 5000, 1000, budget);

    const status = getSpendingStatus(budget);
    expect(status.todayUsd).toBeGreaterThan(0);
  });
});

describe("getSpendingStatus", () => {
  it("returns zero state initially", () => {
    const status = getSpendingStatus(budget);
    expect(status.todayUsd).toBe(0);
    expect(status.monthUsd).toBe(0);
    expect(status.dailyBudgetPct).toBe(0);
    expect(status.monthlyBudgetPct).toBe(0);
  });

  it("reflects accumulated spending", () => {
    recordSpending("anthropic", "claude-sonnet-4-6", 10000, 5000, budget);

    const status = getSpendingStatus(budget);
    expect(status.todayUsd).toBeGreaterThan(0);
    expect(status.monthUsd).toBeGreaterThan(0);
    expect(status.dailyBudgetPct).toBeGreaterThan(0);
  });

  it("includes alerts when over budget", () => {
    // Opus: expensive enough to blow the budget
    recordSpending("anthropic", "claude-opus-4-6", 500000, 100000, budget);

    const status = getSpendingStatus(budget);
    expect(status.alerts.length).toBeGreaterThan(0);
  });
});
