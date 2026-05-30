/**
 * Anomaly detection for time-series metric data.
 *
 * Uses z-score analysis to identify data points that deviate
 * significantly from the mean. Configurable sensitivity.
 */

export interface DataPoint {
  timestamp: number;
  value: number;
}

export interface Anomaly {
  /** Timestamp of the anomalous data point. */
  timestamp: number;
  /** Actual observed value. */
  value: number;
  /** Expected value (mean). */
  expectedValue: number;
  /** Z-score (standard deviations from mean). */
  zScore: number;
  /** Direction of the anomaly. */
  direction: "spike" | "drop";
}

export interface AnomalyDetectionOptions {
  /** Z-score threshold for anomaly detection. Default: 2. */
  sensitivity?: number;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function stddev(values: number[], avg: number): number {
  if (values.length < 2) return 0;
  const variance = values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * Detect anomalies in a time-series using z-score analysis.
 *
 * @param series - Time-ordered data points
 * @param options - Detection sensitivity (lower = more sensitive)
 * @returns Array of detected anomalies, sorted by z-score (most anomalous first)
 */
export function detectAnomalies(
  series: DataPoint[],
  options: AnomalyDetectionOptions = {}
): Anomaly[] {
  const { sensitivity = 2 } = options;

  if (series.length < 3) return [];

  const values = series.map((p) => p.value);
  const avg = mean(values);
  const sd = stddev(values, avg);

  if (sd === 0) return []; // No variance — all values are identical

  const anomalies: Anomaly[] = [];

  for (const point of series) {
    const zScore = (point.value - avg) / sd;

    if (Math.abs(zScore) >= sensitivity) {
      anomalies.push({
        timestamp: point.timestamp,
        value: point.value,
        expectedValue: Math.round(avg * 100) / 100,
        zScore: Math.round(zScore * 100) / 100,
        direction: zScore > 0 ? "spike" : "drop",
      });
    }
  }

  // Sort by absolute z-score descending (most anomalous first)
  return anomalies.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));
}

/**
 * Quick check if a series contains any anomalies above the threshold.
 */
export function hasAnomalies(series: DataPoint[], options?: AnomalyDetectionOptions): boolean {
  return detectAnomalies(series, options).length > 0;
}
