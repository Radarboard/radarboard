/**
 * POST /api/webhooks/:integration
 *
 * Receives inbound webhooks, verifies signatures using the existing
 * integration handlers, and stores events in Upstash Redis.
 */

import "../lib/integrations-init.js";

import { INTEGRATION_REGISTRY } from "@radarboard/integration-sdk/registry";
import type { WebhookHandler } from "@radarboard/integration-sdk/types";
import type { Redis } from "@upstash/redis";
import { Hono } from "hono";
import { getRelayEnv, getWebhookSecrets } from "../lib/env.js";
import { incrementCounter, observeHistogram } from "../lib/metrics.js";
import { captureWarning } from "../lib/sentry.js";
import { storeEvents as redisStoreEvents } from "../lib/store.js";
import { storeEvents as memoryStoreEvents } from "../lib/store-memory.js";
import { DEFAULT_TENANT, getTenantId, getTenantSecrets } from "../lib/tenant.js";
import { webhookRateLimit } from "../middleware/rate-limit.js";
import { replayProtection } from "../middleware/replay-protection.js";

const storeEvents = getRelayEnv("RELAY_STORE") === "memory" ? memoryStoreEvents : redisStoreEvents;

import { bodyLimit, jsonOnly, killSwitch, validateIntegration } from "../middleware/security.js";

/**
 * Try verifying the signature against each configured secret.
 * Supports zero-downtime secret rotation — if either the old or new key
 * matches, verification passes.
 */
async function verifyWithRotation(
  handler: WebhookHandler,
  request: Request,
  secrets: string[]
): Promise<boolean> {
  for (const secret of secrets) {
    try {
      const verified = await handler.verifySignature(request.clone(), secret);
      if (verified) return true;
    } catch (error) {
      captureWarning("Signature verification threw for one secret, trying next", {
        error: String(error),
      });
    }
  }
  return false;
}

export function webhooksRoute(redis: Redis): Hono {
  const route = new Hono();

  const knownIntegrations = new Set(
    Array.from(INTEGRATION_REGISTRY.values())
      .filter((d) => d.webhookHandler)
      .map((d) => d.id)
  );

  // Security layers — order matters: cheapest checks first.
  // validateIntegration runs first to reject bogus paths before
  // they create garbage rate-limit or dedup keys in Redis.
  route.use("/:integration", validateIntegration(knownIntegrations));
  route.use("/:integration", killSwitch());
  route.use("/:integration", bodyLimit());
  route.use("/:integration", jsonOnly());
  // Rate limiting and replay protection require Redis.
  // In memory-store mode, skip them — signature verification still protects.
  if (getRelayEnv("RELAY_STORE") !== "memory") {
    route.use("/:integration", webhookRateLimit(redis));
    route.use("/:integration", replayProtection(redis));
  }

  route.post("/:integration", async (c) => {
    const start = Date.now();
    const integration = c.req.param("integration");
    // Safe cast: validateIntegration middleware already rejected unknown names
    const descriptor = INTEGRATION_REGISTRY.get(integration);
    const handler = descriptor?.webhookHandler as WebhookHandler;

    // Resolve webhook secrets: env-based for single-tenant, Redis-based for multi-tenant
    const tenantId = getTenantId(c);
    let secrets: string[];
    if (tenantId === DEFAULT_TENANT) {
      secrets = getWebhookSecrets(integration);
    } else {
      const tenantSecrets = await getTenantSecrets(redis, tenantId);
      const raw = tenantSecrets?.webhookSecrets[integration] ?? "";
      secrets = raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    if (secrets.length === 0) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // Clone the request upfront — verifySignature consumes the body stream,
    // so parsePayload needs its own unconsumed copy.
    const requestForVerify = c.req.raw.clone();
    const requestForParse = c.req.raw.clone();

    const verified = await verifyWithRotation(handler, requestForVerify, secrets);
    if (!verified) {
      return c.json({ error: "Invalid signature" }, 401);
    }

    let events: Awaited<ReturnType<WebhookHandler["parsePayload"]>>;
    try {
      events = await handler.parsePayload(requestForParse);
    } catch (error) {
      captureWarning("Webhook payload parse failure", { integration, error: String(error) });
      return c.json({ error: "Failed to parse payload" }, 400);
    }

    try {
      await storeEvents(redis, integration, events, tenantId);
    } catch (error) {
      captureWarning("Failed to store webhook events in Redis", {
        integration,
        eventCount: events.length,
        error: String(error),
      });
      return c.json({ error: "Failed to store events" }, 502);
    }

    incrementCounter("relay_webhooks_received_total", { integration });
    incrementCounter("relay_events_stored_total", { integration });
    observeHistogram("relay_webhook_duration_ms", Date.now() - start, { integration });

    return c.json({ received: true, eventCount: events.length });
  });

  return route;
}
