/**
 * In-memory event store — zero-dependency alternative to Upstash Redis.
 *
 * Set `RELAY_STORE=memory` to use this instead of Redis. Events are stored
 * in a sorted array with automatic pruning. Data is lost on restart.
 *
 * Suitable for development, single-instance deployments, and users who
 * don't want to configure an external Redis service.
 */

import type { IntegrationEvent } from "@radarboard/integration-sdk/types";
import type { RelayEvent } from "./store.js";

const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_EVENTS = 10_000; // Cap to prevent unbounded memory growth

/** Sorted by receivedAt ascending. */
const events: RelayEvent[] = [];

export async function storeEvents(
  _redis: unknown,
  integration: string,
  incoming: IntegrationEvent[]
): Promise<void> {
  if (incoming.length === 0) return;

  const now = Date.now();
  for (let i = 0; i < incoming.length; i++) {
    const event = incoming[i];
    if (!event) continue;
    events.push({
      id: crypto.randomUUID(),
      integration,
      event,
      receivedAt: now + i,
    });
  }

  // Cap at MAX_EVENTS by removing oldest
  if (events.length > MAX_EVENTS) {
    events.splice(0, events.length - MAX_EVENTS);
  }
}

export async function getEventsSince(
  _redis: unknown,
  sinceMs: number,
  limit: number
): Promise<RelayEvent[]> {
  // Binary search for the first event after sinceMs (exclusive)
  let lo = 0;
  let hi = events.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if ((events[mid]?.receivedAt ?? 0) <= sinceMs) lo = mid + 1;
    else hi = mid;
  }
  return events.slice(lo, lo + limit);
}

export async function pruneExpiredEvents(_redis: unknown): Promise<void> {
  const cutoff = Date.now() - MAX_AGE_MS;
  // Remove from the front (oldest events)
  while (events.length > 0 && (events[0]?.receivedAt ?? 0) < cutoff) {
    events.shift();
  }
}
