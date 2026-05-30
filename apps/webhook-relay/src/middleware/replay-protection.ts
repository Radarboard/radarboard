/**
 * Replay protection middleware.
 *
 * Prevents replayed webhook payloads by:
 * 1. Rejecting requests older than MAX_AGE_MS (5 minutes)
 * 2. De-duplicating by delivery ID stored in Redis with a 5-minute TTL
 */

import type { Redis } from "@upstash/redis";
import type { Context, MiddlewareHandler } from "hono";
import { captureWarning } from "../lib/sentry.js";
import { getTenantId } from "../lib/tenant.js";

const MAX_AGE_MS = 300_000; // 5 minutes

/** Header names per integration that carry a unique delivery ID. */
const DELIVERY_HEADERS: Record<string, string> = {
  github: "x-github-delivery",
  vercel: "x-vercel-delivery",
  sentry: "sentry-hook-resource",
  linear: "linear-delivery",
  betterstack: "x-betterstack-delivery",
};

/** Timestamp headers per integration (if available). */
const TIMESTAMP_HEADERS: Record<string, string> = {
  sentry: "sentry-hook-timestamp",
};

/** Returns true if the request timestamp is too old. */
function isTimestampStale(c: Context, integration: string): boolean {
  const tsHeader = TIMESTAMP_HEADERS[integration];
  if (!tsHeader) return false;
  const tsValue = c.req.header(tsHeader);
  if (!tsValue) return false;
  const ts = Number(tsValue) * 1000; // assume seconds → ms
  return !Number.isNaN(ts) && Date.now() - ts > MAX_AGE_MS;
}

/** Returns true if the delivery ID has already been processed. */
async function isDuplicateDelivery(
  c: Context,
  redis: Redis,
  integration: string
): Promise<boolean> {
  const deliveryHeader = DELIVERY_HEADERS[integration];
  if (!deliveryHeader) {
    captureWarning("No delivery header configured for integration, replay protection skipped", {
      integration,
    });
    return false;
  }
  const deliveryId = c.req.header(deliveryHeader);
  if (!deliveryId) {
    captureWarning("Missing expected delivery ID header, replay protection skipped", {
      integration,
      expectedHeader: deliveryHeader,
    });
    return false;
  }
  const tenantId = getTenantId(c);
  const dedupKey = `relay:${tenantId}:dedup:${integration}:${deliveryId}`;
  try {
    // SET NX returns null if the key already exists
    const wasNew = await redis.set(dedupKey, "1", { nx: true, ex: 300 });
    return !wasNew;
  } catch (error) {
    // Fail open: allow the request through when Redis is unavailable.
    // Signature verification still protects against abuse.
    captureWarning("Replay protection unavailable, allowing request", { error: String(error) });
    return false;
  }
}

export function replayProtection(redis: Redis): MiddlewareHandler {
  return async (c, next) => {
    const integration = c.req.param("integration") ?? "unknown";

    if (isTimestampStale(c, integration)) {
      return c.json({ error: "Request too old (replay rejected)" }, 400);
    }

    if (await isDuplicateDelivery(c, redis, integration)) {
      return c.json({ error: "Duplicate delivery (replay rejected)" }, 409);
    }

    await next();
  };
}
