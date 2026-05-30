/**
 * Rate limiting middleware using Upstash Ratelimit.
 *
 * Sliding window algorithm — shares the same Upstash Redis instance as the
 * event store. Separate limits for webhook ingestion vs. poll endpoints.
 */

import { Ratelimit } from "@upstash/ratelimit";
import type { Redis } from "@upstash/redis";
import type { Context, MiddlewareHandler } from "hono";
import { captureWarning } from "../lib/sentry.js";
import { getTenantId } from "../lib/tenant.js";

function getClientIp(c: Context): string {
  // Prefer platform-set headers (not spoofable) over x-forwarded-for
  return (
    c.req.header("x-vercel-forwarded-for")?.split(",")[0]?.trim() ??
    c.req.header("cf-connecting-ip") ??
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    c.req.header("x-real-ip") ??
    "unknown"
  );
}

/** Webhook routes: 100 requests/minute per IP per integration. */
export function webhookRateLimit(redis: Redis): MiddlewareHandler {
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, "1 m"),
    prefix: "rl:webhook",
  });

  return async (c, next) => {
    const tenantId = getTenantId(c);
    const integration = c.req.param("integration") ?? "unknown";
    const ip = getClientIp(c);
    const key = `${tenantId}:${ip}:${integration}`;

    try {
      const result = await limiter.limit(key);
      if (!result.success) {
        const retryAfterMs = result.reset - Date.now();
        const retryAfterSec = Math.ceil(Math.max(retryAfterMs, 0) / 1000);
        return c.json({ error: "Too many requests" }, 429, {
          "Retry-After": String(retryAfterSec),
        });
      }
    } catch (error) {
      // Fail open: allow the request through when Redis is unavailable.
      // Signature verification still protects against abuse.
      captureWarning("Rate limiter unavailable, allowing request", { error: String(error) });
    }

    await next();
  };
}

/** Poll route: 20 requests/minute per IP. */
export function pollRateLimit(redis: Redis): MiddlewareHandler {
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, "1 m"),
    prefix: "rl:poll",
  });

  return async (c, next) => {
    const tenantId = getTenantId(c);
    const ip = getClientIp(c);

    try {
      const result = await limiter.limit(`${tenantId}:${ip}`);
      if (!result.success) {
        const retryAfterMs = result.reset - Date.now();
        const retryAfterSec = Math.ceil(Math.max(retryAfterMs, 0) / 1000);
        return c.json({ error: "Too many requests" }, 429, {
          "Retry-After": String(retryAfterSec),
        });
      }
    } catch (error) {
      captureWarning("Poll rate limiter unavailable, allowing request", { error: String(error) });
    }

    await next();
  };
}
