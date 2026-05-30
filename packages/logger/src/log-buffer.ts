import type { LogEntry, LogLevel } from "@radarboard/types/logs";

const MAX_ENTRIES = 1000;

interface QueryOptions {
  level?: LogLevel;
  source?: string;
  search?: string;
  after?: number;
  limit?: number;
}

/** In-memory ring buffer that holds the last N log entries for dashboard display. */
class LogRingBuffer {
  private entries: LogEntry[] = [];
  private listeners = new Set<(entry: LogEntry) => void>();

  push(entry: LogEntry): void {
    this.entries.push(entry);
    if (this.entries.length > MAX_ENTRIES) {
      this.entries.shift();
    }
    for (const listener of this.listeners) {
      listener(entry);
    }
  }

  getEntries(options?: QueryOptions): { logs: LogEntry[]; total: number; hasMore: boolean } {
    let result = this.entries;
    const level = options?.level;
    const source = options?.source;
    const search = options?.search?.toLowerCase();
    const after = options?.after;
    const limit = options?.limit ?? 100;

    if (level) {
      result = result.filter((e) => e.level === level);
    }
    if (source) {
      result = result.filter((e) => e.source.includes(source));
    }
    if (search) {
      result = result.filter(
        (e) => e.message.toLowerCase().includes(search) || e.source.toLowerCase().includes(search)
      );
    }
    if (after) {
      result = result.filter((e) => e.timestamp > after);
    }

    const total = result.length;
    const limited = result.slice(-limit);

    return {
      logs: limited,
      total,
      hasMore: total > limit,
    };
  }

  /** Subscribe to new log entries. Returns an unsubscribe function. */
  subscribe(listener: (entry: LogEntry) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  clear(): void {
    this.entries = [];
  }

  get size(): number {
    return this.entries.length;
  }
}

/**
 * Singleton log buffer shared across the server process.
 * API routes read from this to serve the dashboard logs widget.
 * The logger pushes entries here on every log call.
 */
export const logBuffer = new LogRingBuffer();
