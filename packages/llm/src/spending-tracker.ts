/**
 * LLM spending tracker with budget alerts.
 *
 * Tracks cumulative spending per day/month and checks against
 * configurable budget thresholds. Emits alerts when approaching limits.
 */

import { calculateCost } from "./cost-calculator";

export interface SpendingBudget {
  dailyLimitUsd: number;
  monthlyLimitUsd: number;
  /** Percentage threshold to trigger alert (0-100). Default: 80. */
  alertThresholdPct?: number;
}

export interface SpendingStatus {
  todayUsd: number;
  monthUsd: number;
  dailyBudgetPct: number;
  monthlyBudgetPct: number;
  dailyLimitUsd: number;
  monthlyLimitUsd: number;
  alerts: SpendingAlert[];
}

export interface SpendingAlert {
  type: "daily_threshold" | "monthly_threshold" | "daily_exceeded" | "monthly_exceeded";
  message: string;
  currentUsd: number;
  limitUsd: number;
  pct: number;
}

// ---------------------------------------------------------------------------
// In-memory accumulator (resets on server restart)
// ---------------------------------------------------------------------------

interface DayAccumulator {
  date: string; // YYYY-MM-DD
  totalUsd: number;
}

interface MonthAccumulator {
  month: string; // YYYY-MM
  totalUsd: number;
}

const GLOBAL_KEY = "__radarboard_spending__" as const;

interface SpendingState {
  day: DayAccumulator;
  month: MonthAccumulator;
}

function getState(): SpendingState {
  const g = globalThis as unknown as Record<string, SpendingState>;
  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = today.slice(0, 7);

  if (!g[GLOBAL_KEY] || g[GLOBAL_KEY].day.date !== today) {
    g[GLOBAL_KEY] = {
      day: { date: today, totalUsd: 0 },
      month:
        g[GLOBAL_KEY]?.month.month === thisMonth
          ? g[GLOBAL_KEY].month
          : { month: thisMonth, totalUsd: 0 },
    };
  }

  return g[GLOBAL_KEY];
}

/**
 * Record a completed LLM request's cost.
 * Returns any triggered alerts.
 */
export function recordSpending(
  providerId: string,
  modelId: string,
  promptTokens: number,
  completionTokens: number,
  budget?: SpendingBudget | null
): SpendingAlert[] {
  const cost = calculateCost(providerId, modelId, promptTokens, completionTokens);
  const state = getState();

  state.day.totalUsd += cost.totalCostUsd;
  state.month.totalUsd += cost.totalCostUsd;

  if (!budget) return [];

  const threshold = budget.alertThresholdPct ?? 80;
  const alerts: SpendingAlert[] = [];

  const dailyPct = (state.day.totalUsd / budget.dailyLimitUsd) * 100;
  const monthlyPct = (state.month.totalUsd / budget.monthlyLimitUsd) * 100;

  if (dailyPct >= 100) {
    alerts.push({
      type: "daily_exceeded",
      message: `Daily LLM budget exceeded: $${state.day.totalUsd.toFixed(4)} / $${budget.dailyLimitUsd}`,
      currentUsd: state.day.totalUsd,
      limitUsd: budget.dailyLimitUsd,
      pct: Math.round(dailyPct),
    });
  } else if (dailyPct >= threshold) {
    alerts.push({
      type: "daily_threshold",
      message: `Daily LLM spending at ${Math.round(dailyPct)}%: $${state.day.totalUsd.toFixed(4)} / $${budget.dailyLimitUsd}`,
      currentUsd: state.day.totalUsd,
      limitUsd: budget.dailyLimitUsd,
      pct: Math.round(dailyPct),
    });
  }

  if (monthlyPct >= 100) {
    alerts.push({
      type: "monthly_exceeded",
      message: `Monthly LLM budget exceeded: $${state.month.totalUsd.toFixed(4)} / $${budget.monthlyLimitUsd}`,
      currentUsd: state.month.totalUsd,
      limitUsd: budget.monthlyLimitUsd,
      pct: Math.round(monthlyPct),
    });
  } else if (monthlyPct >= threshold) {
    alerts.push({
      type: "monthly_threshold",
      message: `Monthly LLM spending at ${Math.round(monthlyPct)}%: $${state.month.totalUsd.toFixed(4)} / $${budget.monthlyLimitUsd}`,
      currentUsd: state.month.totalUsd,
      limitUsd: budget.monthlyLimitUsd,
      pct: Math.round(monthlyPct),
    });
  }

  return alerts;
}

/** Get current spending status. */
export function getSpendingStatus(budget: SpendingBudget): SpendingStatus {
  const state = getState();

  const dailyPct = (state.day.totalUsd / budget.dailyLimitUsd) * 100;
  const monthlyPct = (state.month.totalUsd / budget.monthlyLimitUsd) * 100;

  const alerts: SpendingAlert[] = [];
  if (dailyPct >= 100) {
    alerts.push({
      type: "daily_exceeded",
      message: "Daily budget exceeded",
      currentUsd: state.day.totalUsd,
      limitUsd: budget.dailyLimitUsd,
      pct: Math.round(dailyPct),
    });
  }
  if (monthlyPct >= 100) {
    alerts.push({
      type: "monthly_exceeded",
      message: "Monthly budget exceeded",
      currentUsd: state.month.totalUsd,
      limitUsd: budget.monthlyLimitUsd,
      pct: Math.round(monthlyPct),
    });
  }

  return {
    todayUsd: Math.round(state.day.totalUsd * 10000) / 10000,
    monthUsd: Math.round(state.month.totalUsd * 10000) / 10000,
    dailyBudgetPct: Math.round(dailyPct),
    monthlyBudgetPct: Math.round(monthlyPct),
    dailyLimitUsd: budget.dailyLimitUsd,
    monthlyLimitUsd: budget.monthlyLimitUsd,
    alerts,
  };
}

/** Reset spending data (for testing). */
export function resetSpending(): void {
  const g = globalThis as unknown as Record<string, undefined>;
  g[GLOBAL_KEY] = undefined;
}
