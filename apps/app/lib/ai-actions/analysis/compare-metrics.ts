/**
 * AI Action: Cross-metric comparison.
 *
 * Fetches two integration data sources, normalizes to the same time range,
 * and computes correlation + directional alignment.
 */

import { analyzeTrend } from "@radarboard/assistant-core/trend-analyzer";

export interface MetricSpec {
  integration: string;
  action: string;
}

export interface ComparisonResult {
  metricA: { integration: string; action: string; direction: string; changePct: number };
  metricB: { integration: string; action: string; direction: string; changePct: number };
  correlation: number;
  aligned: boolean;
  summary: string;
}

/**
 * Pearson correlation coefficient between two equal-length numeric arrays.
 */
export function pearsonCorrelation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 3) return 0;

  let sumA = 0;
  let sumB = 0;
  let sumAB = 0;
  let sumA2 = 0;
  let sumB2 = 0;

  for (let i = 0; i < n; i++) {
    sumA += a[i]!;
    sumB += b[i]!;
    sumAB += a[i]! * b[i]!;
    sumA2 += a[i]! * a[i]!;
    sumB2 += b[i]! * b[i]!;
  }

  const denom = Math.sqrt((n * sumA2 - sumA * sumA) * (n * sumB2 - sumB * sumB));
  if (denom === 0) return 0;
  return Math.round(((n * sumAB - sumA * sumB) / denom) * 1000) / 1000;
}

/**
 * Compare two metric data sets: compute individual trends + cross-correlation.
 */
export function compareMetrics(
  specA: MetricSpec,
  valuesA: number[],
  specB: MetricSpec,
  valuesB: number[]
): ComparisonResult {
  const midA = Math.floor(valuesA.length / 2);
  const trendA = analyzeTrend(valuesA.slice(midA), valuesA.slice(0, midA));

  const midB = Math.floor(valuesB.length / 2);
  const trendB = analyzeTrend(valuesB.slice(midB), valuesB.slice(0, midB));

  // Normalize lengths for correlation
  const minLen = Math.min(valuesA.length, valuesB.length);
  const corr = pearsonCorrelation(
    valuesA.slice(valuesA.length - minLen),
    valuesB.slice(valuesB.length - minLen)
  );

  const aligned = trendA.direction === trendB.direction;
  const corrLabel = Math.abs(corr) > 0.7 ? "strong" : Math.abs(corr) > 0.4 ? "moderate" : "weak";
  const corrDir = corr > 0 ? "positive" : "negative";

  const summary = `${specA.integration}/${specA.action} is ${trendA.direction} (${trendA.changePct}%), ${specB.integration}/${specB.action} is ${trendB.direction} (${trendB.changePct}%). ${corrLabel} ${corrDir} correlation (r=${corr}).`;

  return {
    metricA: {
      integration: specA.integration,
      action: specA.action,
      direction: trendA.direction,
      changePct: trendA.changePct,
    },
    metricB: {
      integration: specB.integration,
      action: specB.action,
      direction: trendB.direction,
      changePct: trendB.changePct,
    },
    correlation: corr,
    aligned,
    summary,
  };
}
