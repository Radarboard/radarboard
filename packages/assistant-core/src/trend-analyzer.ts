/**
 * Trend analysis for time-series metric data.
 *
 * Computes direction, percentage change, velocity, and a simple
 * linear forecast from two consecutive time periods.
 */

export type TrendDirection = "up" | "down" | "flat";

export interface TrendSummary {
  /** Trend direction based on percentage change. */
  direction: TrendDirection;
  /** Percentage change from previous to current period. */
  changePct: number;
  /** Rate of change per data point (slope of linear regression). */
  velocity: number;
  /** Simple linear forecast for the next 7 data points. */
  forecast7d: number;
  /** Average of current period. */
  currentAvg: number;
  /** Average of previous period. */
  previousAvg: number;
}

/** Threshold below which change is considered "flat". */
const FLAT_THRESHOLD_PCT = 2;

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Simple linear regression slope.
 * Returns the rate of change per data point.
 */
function linearSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i]!;
    sumXY += i * values[i]!;
    sumX2 += i * i;
  }

  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) return 0;

  return (n * sumXY - sumX * sumY) / denominator;
}

/**
 * Analyze the trend between two consecutive time periods.
 *
 * @param current - Values for the current period (most recent)
 * @param previous - Values for the previous period (comparison baseline)
 * @returns Trend summary with direction, change%, velocity, and forecast
 */
export function analyzeTrend(current: number[], previous: number[]): TrendSummary {
  const currentAvg = average(current);
  const previousAvg = average(previous);

  const changePct =
    previousAvg === 0
      ? currentAvg === 0
        ? 0
        : 100
      : ((currentAvg - previousAvg) / Math.abs(previousAvg)) * 100;

  const roundedChange = Math.round(changePct * 100) / 100;

  const direction: TrendDirection =
    Math.abs(roundedChange) < FLAT_THRESHOLD_PCT ? "flat" : roundedChange > 0 ? "up" : "down";

  // Velocity from the current period's linear regression
  const velocity = Math.round(linearSlope(current) * 1000) / 1000;

  // Forecast: extend the linear trend 7 points beyond the last data point
  const lastValue = current.length > 0 ? current[current.length - 1]! : 0;
  const forecast7d = Math.round((lastValue + velocity * 7) * 100) / 100;

  return {
    direction,
    changePct: roundedChange,
    velocity,
    forecast7d,
    currentAvg: Math.round(currentAvg * 100) / 100,
    previousAvg: Math.round(previousAvg * 100) / 100,
  };
}
