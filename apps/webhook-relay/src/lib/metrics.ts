/**
 * Lightweight in-memory metrics for observability.
 *
 * Exposes counters via GET /api/metrics in Prometheus text format.
 * Works with Grafana, Datadog, Prometheus, and any scraping tool.
 *
 * On persistent platforms (Railway, Fly.io, Docker), counters accumulate
 * across requests. On serverless (Vercel, Cloudflare Workers), counters
 * reset per invocation — use platform-native metrics for those.
 */

const counters = new Map<string, number>();
const histogramBuckets = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000];
const histograms = new Map<string, number[]>();

export function incrementCounter(name: string, labels: Record<string, string> = {}): void {
  const key = formatKey(name, labels);
  counters.set(key, (counters.get(key) ?? 0) + 1);
}

export function observeHistogram(
  name: string,
  valueMs: number,
  labels: Record<string, string> = {}
): void {
  const key = formatKey(name, labels);
  const values = histograms.get(key) ?? [];
  values.push(valueMs);
  histograms.set(key, values);
}

function formatKey(name: string, labels: Record<string, string>): string {
  const labelStr = Object.entries(labels)
    .map(([k, v]) => `${k}="${v}"`)
    .join(",");
  return labelStr ? `${name}{${labelStr}}` : name;
}

/** Render all metrics in Prometheus text exposition format. */
export function renderMetrics(): string {
  const lines: string[] = [];

  // Counters
  for (const [key, value] of counters) {
    lines.push(`${key} ${value}`);
  }

  // Histograms — compute bucket counts
  for (const [key, values] of histograms) {
    const sorted = values.sort((a, b) => a - b);
    let sum = 0;
    for (const v of sorted) sum += v;

    for (const bucket of histogramBuckets) {
      const count = sorted.filter((v) => v <= bucket).length;
      lines.push(`${key.replace("{", `_bucket{le="${bucket}",`)} ${count}`);
    }
    lines.push(`${key.replace("{", '_bucket{le="+Inf",')} ${sorted.length}`);
    lines.push(`${key.replace("{", "_sum{")} ${sum}`);
    lines.push(`${key.replace("{", "_count{")} ${sorted.length}`);
  }

  return lines.join("\n");
}

/** Reset all metrics. Useful for testing. */
function _resetMetrics(): void {
  counters.clear();
  histograms.clear();
}
