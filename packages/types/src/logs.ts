/** Severity levels for structured log entries. */
export type LogLevel = "debug" | "info" | "warn" | "error";

/** A single structured log entry produced by the logger. */
export interface LogEntry {
  /** Unique identifier for this entry. */
  id: string;
  /** Unix timestamp in milliseconds. */
  timestamp: number;
  /** Severity level. */
  level: LogLevel;
  /** Source module or context (e.g. "api/revenue", "cache", "revenuecat"). */
  source: string;
  /** Human-readable message. */
  message: string;
  /** Optional structured metadata (request context, durations, error stacks). */
  metadata?: Record<string, unknown>;
  /** Optional project slug for project-scoped logs. */
  projectSlug?: string;
}

/** Response shape for the /api/logs endpoint. */
export interface LogsResponse {
  logs: LogEntry[];
  total: number;
  hasMore: boolean;
}

/** Query parameters for filtering logs. */
export interface LogsQueryParams {
  level?: LogLevel;
  source?: string;
  search?: string;
  after?: number;
  limit?: number;
}
