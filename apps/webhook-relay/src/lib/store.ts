/**
 * Upstash Redis event storage.
 *
 * Events are stored in a sorted set keyed by timestamp (ms), enabling
 * efficient time-range queries for the polling endpoint.
 *
 * Multi-tenant: events are namespaced by tenantId. Single-tenant deployments
 * use DEFAULT_TENANT ("_default") for backwards compatibility.
 */

import type { IntegrationEvent } from "@radarboard/integration-sdk/types";
import type { Redis } from "@upstash/redis";
import { DEFAULT_TENANT, tenantKey } from "./tenant.js";

const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface RelayEvent {
  id: string;
  integration: string;
  event: IntegrationEvent;
  receivedAt: number;
}

function eventsKey(tenantId: string): string {
  return tenantKey(tenantId, "events");
}

/** Store events in the sorted set with receivedAt as the score. */
export async function storeEvents(
  redis: Redis,
  integration: string,
  events: IntegrationEvent[],
  tenantId: string = DEFAULT_TENANT
): Promise<void> {
  if (events.length === 0) return;

  const now = Date.now();
  const members = events.map((event, index) => {
    const relayEvent: RelayEvent = {
      id: crypto.randomUUID(),
      integration,
      event,
      receivedAt: now,
    };
    // Offset each event by index to avoid identical scores in a batch,
    // which would cause unpredictable pagination ordering.
    return { score: now + index, member: JSON.stringify(relayEvent) };
  });

  // Upstash zadd takes rest params: (key, member1, member2, ...)
  const [first, ...rest] = members;
  await redis.zadd(eventsKey(tenantId), first!, ...rest);
}

/** Retrieve events after a given timestamp (exclusive lower bound). */
export async function getEventsSince(
  redis: Redis,
  sinceMs: number,
  limit: number,
  tenantId: string = DEFAULT_TENANT
): Promise<RelayEvent[]> {
  const results = await redis.zrange<RelayEvent[]>(eventsKey(tenantId), `(${sinceMs}`, "+inf", {
    byScore: true,
    count: limit,
    offset: 0,
  });

  return results;
}

/** Remove events older than 24 hours. Called lazily on each poll. */
export async function pruneExpiredEvents(
  redis: Redis,
  tenantId: string = DEFAULT_TENANT
): Promise<void> {
  const cutoff = Date.now() - MAX_AGE_MS;
  await redis.zremrangebyscore(eventsKey(tenantId), 0, cutoff);
}
