/**
 * In-memory span collector with optional OTLP HTTP export.
 *
 * Stores completed spans in a fixed-size ring buffer for the debug panel.
 * When OTEL_EXPORTER_OTLP_ENDPOINT is set, also exports spans via HTTP.
 */

export type SpanStatus = "ok" | "error" | "unset";

export interface SpanRecord {
  /** Unique span ID. */
  spanId: string;
  /** Parent span ID, or null for root spans. */
  parentSpanId: string | null;
  /** Trace ID — shared across related spans. */
  traceId: string;
  /** Human-readable span name, e.g. "integration.fetch/github/pulls". */
  name: string;
  /** Start time in milliseconds. */
  startTimeMs: number;
  /** End time in milliseconds. */
  endTimeMs: number;
  /** Duration in milliseconds. */
  durationMs: number;
  /** Span status. */
  status: SpanStatus;
  /** Error message if status is "error". */
  errorMessage?: string;
  /** Arbitrary key-value attributes. */
  attributes: Record<string, string | number | boolean>;
}

// ---------------------------------------------------------------------------
// Ring buffer storage
// ---------------------------------------------------------------------------

const BUFFER_SIZE = 200;
const GLOBAL_KEY = "__radarboard_span_collector__" as const;

interface CollectorState {
  spans: SpanRecord[];
  cursor: number;
}

function getState(): CollectorState {
  const g = globalThis as unknown as Record<string, CollectorState>;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = { spans: [], cursor: 0 };
  }
  return g[GLOBAL_KEY];
}

/** Record a completed span. */
export function recordSpan(span: SpanRecord): void {
  const state = getState();

  if (state.spans.length < BUFFER_SIZE) {
    state.spans.push(span);
  } else {
    state.spans[state.cursor] = span;
  }
  state.cursor = (state.cursor + 1) % BUFFER_SIZE;

  // Export to OTLP if configured
  exportToOtlp(span);
}

/** Get all recorded spans in chronological order. */
export function getSpans(): SpanRecord[] {
  const state = getState();
  if (state.spans.length < BUFFER_SIZE) {
    return [...state.spans];
  }
  // Return in chronological order from the ring buffer
  return [...state.spans.slice(state.cursor), ...state.spans.slice(0, state.cursor)];
}

/** Get spans filtered by trace ID. */
export function getSpansByTraceId(traceId: string): SpanRecord[] {
  return getSpans().filter((s) => s.traceId === traceId);
}

/** Get summary statistics. */
export function getSpanStats(): {
  totalSpans: number;
  errorCount: number;
  avgDurationMs: number;
  sources: Record<string, number>;
} {
  const spans = getSpans();
  const errorCount = spans.filter((s) => s.status === "error").length;
  const totalDuration = spans.reduce((sum, s) => sum + s.durationMs, 0);
  const sources: Record<string, number> = {};

  for (const s of spans) {
    const source = s.name.split("/")[0] ?? "unknown";
    sources[source] = (sources[source] ?? 0) + 1;
  }

  return {
    totalSpans: spans.length,
    errorCount,
    avgDurationMs: spans.length > 0 ? Math.round(totalDuration / spans.length) : 0,
    sources,
  };
}

/** Reset all span data (for testing). */
export function resetCollector(): void {
  const g = globalThis as unknown as Record<string, undefined>;
  g[GLOBAL_KEY] = undefined;
}

// ---------------------------------------------------------------------------
// OTLP HTTP export (fire-and-forget)
// ---------------------------------------------------------------------------

let otlpEndpoint: string | null = null;
let otlpChecked = false;

function getOtlpEndpoint(): string | null {
  if (!otlpChecked) {
    const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
      ?.env;
    otlpEndpoint = env?.OTEL_EXPORTER_OTLP_ENDPOINT ?? null;
    otlpChecked = true;
  }
  return otlpEndpoint;
}

function exportToOtlp(span: SpanRecord): void {
  const endpoint = getOtlpEndpoint();
  if (!endpoint) return;

  // Fire-and-forget — don't block the request
  fetch(`${endpoint}/v1/traces`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      resourceSpans: [
        {
          resource: {
            attributes: [{ key: "service.name", value: { stringValue: "radarboard-web" } }],
          },
          scopeSpans: [
            {
              spans: [
                {
                  traceId: span.traceId,
                  spanId: span.spanId,
                  parentSpanId: span.parentSpanId ?? undefined,
                  name: span.name,
                  startTimeUnixNano: String(span.startTimeMs * 1_000_000),
                  endTimeUnixNano: String(span.endTimeMs * 1_000_000),
                  status: {
                    code: span.status === "error" ? 2 : span.status === "ok" ? 1 : 0,
                    message: span.errorMessage,
                  },
                  attributes: Object.entries(span.attributes).map(([key, value]) => ({
                    key,
                    value:
                      typeof value === "string"
                        ? { stringValue: value }
                        : typeof value === "number"
                          ? { intValue: String(value) }
                          : { boolValue: value },
                  })),
                },
              ],
            },
          ],
        },
      ],
    }),
  }).catch(() => {
    // Silently ignore export failures
  });
}
