/**
 * Security middleware: integration validation, body size limit,
 * Content-Type guard, and kill switch.
 *
 * These are the first layers of defense — they run before rate limiting,
 * replay protection, and signature verification.
 */

import type { MiddlewareHandler } from "hono";
import { bodyLimit as honoBodyLimit } from "hono/body-limit";
import { getRelayEnv } from "../lib/env.js";

const MAX_BODY_BYTES = 256 * 1024; // 256 KB — webhooks rarely exceed this

/**
 * Reject requests for unknown integration names immediately.
 * Prevents bogus paths from creating garbage rate-limit and dedup keys in Redis.
 *
 * Accepts a set of valid integration names — derived from the WEBHOOK_HANDLERS
 * map so it stays in sync as integrations are added or removed.
 */
export function validateIntegration(knownIntegrations: Set<string>): MiddlewareHandler {
  return async (c, next) => {
    const integration = c.req.param("integration");
    if (!integration || !knownIntegrations.has(integration)) {
      return c.json({ error: "Unknown integration" }, 404);
    }
    await next();
  };
}

/**
 * Global kill switch.
 *
 * Set `RELAY_ENABLED=false` to instantly reject all webhook ingestion.
 * Per-integration: `RELAY_DISABLE_GITHUB=true` disables only GitHub.
 *
 * The poll endpoint is NOT affected — the dashboard can still drain
 * buffered events after the kill switch is flipped.
 */
export function killSwitch(): MiddlewareHandler {
  return async (c, next) => {
    const globalEnabled = getRelayEnv("RELAY_ENABLED");
    if (globalEnabled === "false") {
      return c.json({ error: "Relay is disabled" }, 503);
    }

    // Safe: integration is already validated by validateIntegration()
    const integration = c.req.param("integration");
    if (integration) {
      const perIntegration = getRelayEnv(`RELAY_DISABLE_${integration.toUpperCase()}`);
      if (perIntegration === "true") {
        return c.json({ error: "Service temporarily unavailable" }, 503);
      }
    }

    await next();
  };
}

/**
 * Reject payloads larger than 256 KB.
 * Two-layer defense:
 * 1. Content-Length header check for early reject (cheap)
 * 2. Hono's built-in body limit for actual body enforcement (handles chunked encoding)
 */
export function bodyLimit(): MiddlewareHandler {
  const streamLimit = honoBodyLimit({
    maxSize: MAX_BODY_BYTES,
    onError: (c) => c.json({ error: "Payload too large" }, 413),
  });

  return async (c, next) => {
    const contentLength = c.req.header("content-length");
    if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
      return c.json({ error: "Payload too large" }, 413);
    }
    return streamLimit(c, next);
  };
}

/**
 * Reject requests without application/json Content-Type.
 * All supported webhook providers send JSON payloads.
 */
export function jsonOnly(): MiddlewareHandler {
  return async (c, next) => {
    const ct = c.req.header("content-type") ?? "";
    if (!ct.includes("application/json")) {
      return c.json({ error: "Content-Type must be application/json" }, 415);
    }
    await next();
  };
}
