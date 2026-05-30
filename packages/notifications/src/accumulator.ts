/**
 * DigestAccumulator
 *
 * Groups notification events into time-based windows by (source, type, projectSlug).
 * When a window closes the accumulator calls the provided flush callback with all
 * events in that window, letting the caller decide whether to deliver individually
 * (1 event) or as a digest (2+ events).
 *
 * critical severity events bypass accumulation entirely — they are not passed to
 * this class; the caller delivers them immediately.
 */

import type { NotificationChannel, NotificationEventRow } from "@radarboard/types/notifications";

export interface WindowFlushPayload {
  key: string;
  source: string;
  type: string;
  projectSlug: string | null;
  events: NotificationEventRow[];
  channels: NotificationChannel[];
  windowStart: number;
  windowEnd: number;
}

export type FlushCallback = (payload: WindowFlushPayload) => void | Promise<void>;

interface WindowState {
  source: string;
  type: string;
  projectSlug: string | null;
  events: NotificationEventRow[];
  channels: Set<NotificationChannel>;
  openedAt: number;
  windowMs: number;
}

function windowKey(event: NotificationEventRow, routingKey: string): string {
  return `${event.source}:${event.type}:${event.projectSlug ?? "*"}:${routingKey}`;
}

export class DigestAccumulator {
  private windows = new Map<string, WindowState>();
  private onFlush: FlushCallback;

  constructor(onFlush: FlushCallback) {
    this.onFlush = onFlush;
  }

  add(
    event: NotificationEventRow,
    windowMs: number,
    channels: NotificationChannel[],
    routingKey: string
  ): void {
    const key = windowKey(event, routingKey);
    const now = Date.now();
    const existing = this.windows.get(key);

    if (!existing) {
      this.windows.set(key, {
        source: event.source,
        type: event.type,
        projectSlug: event.projectSlug,
        events: [event],
        channels: new Set(channels),
        openedAt: now,
        windowMs,
      });
    } else {
      existing.events.push(event);
      for (const channel of channels) {
        existing.channels.add(channel);
      }
    }
  }

  /**
   * Flush all windows whose deadline has passed.
   * Call this on a periodic timer (e.g. every 5 seconds).
   */
  tick(): void {
    const now = Date.now();
    for (const [key, window] of this.windows) {
      if (now - window.openedAt >= window.windowMs) {
        this.windows.delete(key);
        const result = this.onFlush({
          key,
          source: window.source,
          type: window.type,
          projectSlug: window.projectSlug,
          events: window.events,
          channels: [...window.channels],
          windowStart: Math.floor(window.openedAt / 1000),
          windowEnd: Math.floor(now / 1000),
        });
        if (result instanceof Promise) {
          result.catch(() => {
            /* flush error intentionally swallowed */
          });
        }
      }
    }
  }

  /** Flush all open windows immediately — useful for graceful shutdown in tests. */
  flushAll(): void {
    const now = Date.now();
    for (const [key, window] of this.windows) {
      this.windows.delete(key);
      const result = this.onFlush({
        key,
        source: window.source,
        type: window.type,
        projectSlug: window.projectSlug,
        events: window.events,
        channels: [...window.channels],
        windowStart: Math.floor(window.openedAt / 1000),
        windowEnd: Math.floor(now / 1000),
      });
      if (result instanceof Promise) {
        result.catch(() => {
          /* flush error intentionally swallowed */
        });
      }
    }
  }

  pendingWindowCount(): number {
    return this.windows.size;
  }
}
