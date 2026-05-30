/**
 * Correlation scanner — computes pairwise Pearson correlations
 * across multiple metric series.
 */

export interface MetricSeries {
  integration: string;
  action: string;
  values: number[];
}

export interface CorrelationPair {
  metricA: { integration: string; action: string };
  metricB: { integration: string; action: string };
  correlation: number;
  strength: "strong" | "moderate" | "weak";
  direction: "positive" | "negative";
}

function pearson(a: number[], b: number[], n: number): number {
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
  return (n * sumAB - sumA * sumB) / denom;
}

/**
 * Compute pairwise Pearson correlations across all provided metric series.
 * Returns the top N strongest correlations (by absolute value).
 */
export function scanCorrelations(series: MetricSeries[], topN = 10): CorrelationPair[] {
  const pairs: CorrelationPair[] = [];

  for (let i = 0; i < series.length; i++) {
    for (let j = i + 1; j < series.length; j++) {
      const a = series[i]!;
      const b = series[j]!;
      const n = Math.min(a.values.length, b.values.length);
      if (n < 3) continue;

      const trimA = a.values.slice(a.values.length - n);
      const trimB = b.values.slice(b.values.length - n);
      const r = Math.round(pearson(trimA, trimB, n) * 1000) / 1000;

      const absR = Math.abs(r);
      const strength = absR > 0.7 ? "strong" : absR > 0.4 ? "moderate" : "weak";
      const direction = r >= 0 ? "positive" : "negative";

      pairs.push({
        metricA: { integration: a.integration, action: a.action },
        metricB: { integration: b.integration, action: b.action },
        correlation: r,
        strength,
        direction,
      });
    }
  }

  // Sort by absolute correlation descending
  pairs.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
  return pairs.slice(0, topN);
}
