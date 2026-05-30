/**
 * In-memory health tracker for integration data sources.
 *
 * Records success/failure/latency for each data source key in a fixed-size
 * ring buffer. The `/api/health/integrations` endpoint reads from this to
 * surface health status without querying the debug events table.
 */

export interface HealthEntry {
  timestamp: number;
  ok: boolean;
  durationMs: number;
  error?: string;
}

export interface HealthSummary {
  key: string;
  totalRequests: number;
  successCount: number;
  failureCount: number;
  availabilityPct: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  lastFailure: HealthEntry | null;
  lastSuccess: HealthEntry | null;
  status: "healthy" | "degraded" | "unhealthy";
}

const BUFFER_SIZE = 50;
const DEGRADED_THRESHOLD = 0.9; // <90% availability = degraded
const UNHEALTHY_THRESHOLD = 0.5; // <50% availability = unhealthy

// Use globalThis to ensure a single shared instance across Next.js route modules
const GLOBAL_KEY = "__radarboard_health_buffers__" as const;

class RingBuffer {
  private entries: HealthEntry[] = [];
  private cursor = 0;
  private full = false;

  record(entry: HealthEntry): void {
    if (this.entries.length < BUFFER_SIZE) {
      this.entries.push(entry);
    } else {
      this.entries[this.cursor] = entry;
      this.full = true;
    }
    this.cursor = (this.cursor + 1) % BUFFER_SIZE;
  }

  getAll(): HealthEntry[] {
    if (!this.full) return [...this.entries];
    // Return in chronological order
    return [...this.entries.slice(this.cursor), ...this.entries.slice(0, this.cursor)];
  }
}

function getBuffers(): Map<string, RingBuffer> {
  const g = globalThis as unknown as Record<string, Map<string, RingBuffer>>;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = new Map<string, RingBuffer>();
  }
  return g[GLOBAL_KEY];
}

function getBuffer(key: string): RingBuffer {
  const buffers = getBuffers();
  let buf = buffers.get(key);
  if (!buf) {
    buf = new RingBuffer();
    buffers.set(key, buf);
  }
  return buf;
}

/** Record a data source request result. */
export function recordHealth(key: string, ok: boolean, durationMs: number, error?: string): void {
  getBuffer(key).record({
    timestamp: Date.now(),
    ok,
    durationMs,
    error,
  });
}

/** Compute a health summary for a single data source. */
export function summarize(key: string): HealthSummary | null {
  const buf = getBuffers().get(key);
  if (!buf) return null;

  const entries = buf.getAll();
  if (entries.length === 0) return null;

  const successes = entries.filter((e) => e.ok);
  const failures = entries.filter((e) => !e.ok);
  const availabilityPct = successes.length / entries.length;

  const latencies = successes.map((e) => e.durationMs).sort((a, b) => a - b);
  const avgLatencyMs =
    latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
  const p95LatencyMs =
    latencies.length > 0
      ? (latencies[Math.floor(latencies.length * 0.95)] ?? latencies[latencies.length - 1])
      : 0;

  let status: HealthSummary["status"] = "healthy";
  if (availabilityPct < UNHEALTHY_THRESHOLD) {
    status = "unhealthy";
  } else if (availabilityPct < DEGRADED_THRESHOLD) {
    status = "degraded";
  }

  return {
    key,
    totalRequests: entries.length,
    successCount: successes.length,
    failureCount: failures.length,
    availabilityPct: Math.round(availabilityPct * 1000) / 10,
    avgLatencyMs,
    p95LatencyMs: p95LatencyMs ?? 0,
    lastFailure: failures.length > 0 ? (failures[failures.length - 1] ?? null) : null,
    lastSuccess: successes.length > 0 ? (successes[successes.length - 1] ?? null) : null,
    status,
  };
}

/** Get health summaries for all tracked data sources. */
export function getAllHealthSummaries(): HealthSummary[] {
  const summaries: HealthSummary[] = [];
  for (const key of getBuffers().keys()) {
    const s = summarize(key);
    if (s) summaries.push(s);
  }
  return summaries.sort((a, b) => a.key.localeCompare(b.key));
}

/** Reset all health data (for testing). */
export function resetHealthData(): void {
  getBuffers().clear();
}
