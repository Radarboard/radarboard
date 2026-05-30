/**
 * @radarboard/observability — lightweight tracing and metrics.
 *
 * Provides `withSpan(name, fn)` for wrapping async operations with
 * timing and error tracking. Spans are recorded in an in-memory ring
 * buffer for the debug panel, and optionally exported via OTLP HTTP.
 *
 * No external dependencies — follows the OpenTelemetry API shape so
 * migration to the real SDK is a one-line import swap.
 *
 * @example
 * ```ts
 * import { withSpan } from "@radarboard/observability";
 *
 * const data = await withSpan("github/pulls", async (span) => {
 *   span.setAttribute("repo", "my-repo");
 *   const res = await fetch("...");
 *   return res.json();
 * });
 * ```
 */

import { recordSpan, type SpanRecord, type SpanStatus } from "./collector";

// Re-export collector types and utilities
export type { SpanRecord, SpanStatus } from "./collector";
export {
  getSpanStats,
  getSpans,
  getSpansByTraceId,
  resetCollector,
} from "./collector";

// ---------------------------------------------------------------------------
// Span context — tracks the active span for parent/child relationships
// ---------------------------------------------------------------------------

interface SpanContext {
  traceId: string;
  spanId: string;
}

// AsyncLocalStorage would be ideal here but isn't available in all
// Next.js edge/client contexts. Use a simple module-level stack instead.
// This works correctly for sequential operations within a single request.
const spanStack: SpanContext[] = [];

function generateId(): string {
  // 16-char hex ID (matches OTEL's 8-byte span ID format)
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function generateTraceId(): string {
  // 32-char hex ID (matches OTEL's 16-byte trace ID format)
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------------------
// Span builder — mutable during execution, frozen on completion
// ---------------------------------------------------------------------------

export interface Span {
  /** Set an attribute on this span. */
  setAttribute(key: string, value: string | number | boolean): void;
  /** Set multiple attributes at once. */
  setAttributes(attrs: Record<string, string | number | boolean>): void;
  /** Mark the span as errored. */
  setError(message: string): void;
  /** Get the span ID (for logging/correlation). */
  readonly spanId: string;
  /** Get the trace ID (for correlation across spans). */
  readonly traceId: string;
}

class SpanImpl implements Span {
  readonly spanId: string;
  readonly traceId: string;
  readonly parentSpanId: string | null;
  readonly name: string;
  readonly startTimeMs: number;
  private attributes: Record<string, string | number | boolean> = {};
  private status: SpanStatus = "unset";
  private errorMessage?: string;

  constructor(name: string, parentContext: SpanContext | null) {
    this.spanId = generateId();
    this.traceId = parentContext?.traceId ?? generateTraceId();
    this.parentSpanId = parentContext?.spanId ?? null;
    this.name = name;
    this.startTimeMs = Date.now();
  }

  setAttribute(key: string, value: string | number | boolean): void {
    this.attributes[key] = value;
  }

  setAttributes(attrs: Record<string, string | number | boolean>): void {
    Object.assign(this.attributes, attrs);
  }

  setError(message: string): void {
    this.status = "error";
    this.errorMessage = message;
  }

  /** Complete the span and record it. */
  end(status?: SpanStatus): SpanRecord {
    const endTimeMs = Date.now();
    const finalStatus = this.status === "error" ? "error" : (status ?? "ok");

    const record: SpanRecord = {
      spanId: this.spanId,
      parentSpanId: this.parentSpanId,
      traceId: this.traceId,
      name: this.name,
      startTimeMs: this.startTimeMs,
      endTimeMs,
      durationMs: endTimeMs - this.startTimeMs,
      status: finalStatus,
      errorMessage: this.errorMessage,
      attributes: { ...this.attributes },
    };

    recordSpan(record);
    return record;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Execute `fn` inside a traced span. Automatically records duration,
 * parent/child relationships, and errors.
 *
 * Spans nest automatically — calling `withSpan` inside another `withSpan`
 * creates a parent-child relationship sharing the same trace ID.
 *
 * @param name - Span name (e.g. "integration.fetch/github/pulls")
 * @param fn - Async function to execute. Receives a mutable Span for adding attributes.
 * @returns The result of `fn`
 */
export async function withSpan<T>(name: string, fn: (span: Span) => Promise<T>): Promise<T> {
  const parentContext = spanStack.length > 0 ? spanStack[spanStack.length - 1]! : null;
  const span = new SpanImpl(name, parentContext);

  // Push onto the stack so nested withSpan calls see this as parent
  spanStack.push({ traceId: span.traceId, spanId: span.spanId });

  try {
    const result = await fn(span);
    span.end("ok");
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    span.setError(message);
    span.end("error");
    throw err;
  } finally {
    spanStack.pop();
  }
}

/**
 * Synchronous version of withSpan for non-async operations.
 */
export function withSpanSync<T>(name: string, fn: (span: Span) => T): T {
  const parentContext = spanStack.length > 0 ? spanStack[spanStack.length - 1]! : null;
  const span = new SpanImpl(name, parentContext);

  spanStack.push({ traceId: span.traceId, spanId: span.spanId });

  try {
    const result = fn(span);
    span.end("ok");
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    span.setError(message);
    span.end("error");
    throw err;
  } finally {
    spanStack.pop();
  }
}

/**
 * Get the current trace ID, or null if not inside a span.
 * Useful for attaching to log entries or API responses.
 */
export function getCurrentTraceId(): string | null {
  if (spanStack.length === 0) return null;
  return spanStack[spanStack.length - 1]?.traceId ?? null;
}

/**
 * Get the current span ID, or null if not inside a span.
 */
export function getCurrentSpanId(): string | null {
  if (spanStack.length === 0) return null;
  return spanStack[spanStack.length - 1]?.spanId ?? null;
}
