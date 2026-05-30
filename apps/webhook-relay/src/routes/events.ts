/**
 * GET /api/events?since=<ms>&limit=<n>
 *
 * Poll endpoint for the local dashboard. Requires Bearer auth.
 * Returns events stored since the given timestamp.
 */

import type { Redis } from "@upstash/redis";
import { Hono } from "hono";
import { verifyPollAuth } from "../lib/auth.js";
import { getRelayEnv } from "../lib/env.js";
import { captureWarning } from "../lib/sentry.js";
import {
  getEventsSince as redisGetEventsSince,
  pruneExpiredEvents as redisPruneExpiredEvents,
} from "../lib/store.js";
import {
  getEventsSince as memoryGetEventsSince,
  pruneExpiredEvents as memoryPruneExpiredEvents,
} from "../lib/store-memory.js";
import { DEFAULT_TENANT, getTenantId, getTenantSecrets } from "../lib/tenant.js";
import { pollRateLimit } from "../middleware/rate-limit.js";

const useMemory = getRelayEnv("RELAY_STORE") === "memory";
const getEventsSince = useMemory ? memoryGetEventsSince : redisGetEventsSince;
const pruneExpiredEvents = useMemory ? memoryPruneExpiredEvents : redisPruneExpiredEvents;

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;
const DEFAULT_SINCE_OFFSET_MS = 60_000; // 60 seconds

export function eventsRoute(redis: Redis): Hono {
  const route = new Hono();

  if (!useMemory) {
    route.use("/", pollRateLimit(redis));
  }

  route.get("/", async (c) => {
    // Auth: env-based for single-tenant, Redis-based for multi-tenant
    const tenantId = getTenantId(c);
    const authHeader = c.req.header("authorization");

    if (tenantId === DEFAULT_TENANT) {
      if (!verifyPollAuth(authHeader)) {
        return c.json({ error: "Unauthorized" }, 401);
      }
    } else {
      const tenantSecrets = await getTenantSecrets(redis, tenantId);
      if (!tenantSecrets?.pollSecret) {
        return c.json({ error: "Tenant not configured" }, 404);
      }
      const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
      if (!token || token !== tenantSecrets.pollSecret) {
        return c.json({ error: "Unauthorized" }, 401);
      }
    }

    const sinceParam = c.req.query("since");
    const limitParam = c.req.query("limit");

    const since = sinceParam ? Number(sinceParam) : Date.now() - DEFAULT_SINCE_OFFSET_MS;
    const limit = Math.min(limitParam ? Number(limitParam) : DEFAULT_LIMIT, MAX_LIMIT);

    if (Number.isNaN(since) || Number.isNaN(limit) || since < 0 || limit < 1) {
      return c.json({ error: "Invalid query parameters" }, 400);
    }

    // Lazy cleanup of old events — fire-and-forget so pruning failures
    // don't block event delivery.
    pruneExpiredEvents(redis, tenantId).catch((error) => {
      captureWarning("Failed to prune expired relay events", { error: String(error) });
    });

    let events: Awaited<ReturnType<typeof getEventsSince>>;
    try {
      events = await getEventsSince(redis, since, limit, tenantId);
    } catch (error) {
      captureWarning("Failed to fetch events from Redis", { error: String(error) });
      return c.json({ error: "Event store unavailable" }, 502);
    }
    const now = Date.now();

    return c.json(events, 200, {
      "X-Relay-Timestamp": String(now),
    });
  });

  return route;
}
