/**
 * Webhook Relay — Hono application
 *
 * Lightweight cloud-deployed API that receives webhooks from external services,
 * verifies signatures, stores events in Upstash Redis, and exposes a poll
 * endpoint for the local dashboard.
 */

import { Redis } from "@upstash/redis";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { getRelayEnv, RELAY_ENV_KEYS } from "./lib/env.js";
import {
  captureError,
  captureWarning,
  sentryFlushMiddleware,
  sentryMiddleware,
} from "./lib/sentry.js";
import { tenantContext } from "./lib/tenant.js";
import { eventsRoute } from "./routes/events.js";
import { healthRoute } from "./routes/health.js";
import { metricsRoute } from "./routes/metrics.js";
import { tenantsRoute } from "./routes/tenants.js";
import { webhooksRoute } from "./routes/webhooks.js";

// RELAY_STORE=memory enables an in-memory event store — no Redis required.
// Events are lost on restart. Suitable for development and simple deployments.
const useMemoryStore = getRelayEnv("RELAY_STORE") === "memory";

let redis: Redis;
if (useMemoryStore) {
  captureWarning("Running in memory-store mode — events will be lost on restart");
  // Create a dummy Redis object; routes that use it will be patched below.
  // Rate limiting and replay protection are disabled in memory mode.
  redis = {} as Redis;
} else {
  const redisUrl = getRelayEnv(RELAY_ENV_KEYS.redis.url);
  const redisToken = getRelayEnv(RELAY_ENV_KEYS.redis.token);
  if (!redisUrl || !redisToken) {
    throw new Error(
      "Missing required environment variables: KV_REST_API_URL and/or KV_REST_API_TOKEN. " +
        "Set RELAY_STORE=memory to run without Redis. " +
        "See apps/docs/developer-guide/webhook-relay.mdx for setup instructions."
    );
  }
  redis = new Redis({ url: redisUrl, token: redisToken });
}

export const app = new Hono().basePath("/api");

// Sentry error reporting — captures unhandled errors with request context.
// No-op when SENTRY_DSN is not configured.
app.use("*", sentryMiddleware());

// Flush Sentry's event buffer before the response completes.
// On Vercel serverless, the function can freeze immediately after the response
// is sent — without flushing, buffered events may never reach Sentry.
app.use("*", sentryFlushMiddleware());

// Global error handler — last line of defense. Logs the error (catches errors
// that sentryMiddleware can't, e.g. Hono routing/CORS errors) then returns 500.
app.onError((err, c) => {
  captureError(err, c);
  return c.json({ error: "Internal server error" }, 500);
});

// CORS: webhook routes allow all origins (external services POST to them).
// The events route is restricted if ALLOWED_ORIGIN is configured.
// The health route allows all origins so the dashboard status page can check it.
const allowedOrigin = getRelayEnv(RELAY_ENV_KEYS.cors.allowedOrigin);
if (!allowedOrigin) {
  captureWarning(
    "ALLOWED_ORIGIN not set — events endpoint CORS is open to all origins. " +
      "Set ALLOWED_ORIGIN to restrict cross-origin access to the poll endpoint."
  );
}
if (!getRelayEnv(RELAY_ENV_KEYS.auth.pollSecret)) {
  captureWarning(
    "RELAY_POLL_SECRET not set — all poll requests will be rejected with 401. " +
      "Generate one with: openssl rand -hex 32"
  );
}
app.use(
  "/health/*",
  cors({
    origin: "*",
    allowMethods: ["GET"],
  })
);
app.use(
  "/metrics/*",
  cors({
    origin: "*",
    allowMethods: ["GET"],
  })
);
app.use(
  "/events/*",
  cors({
    origin: allowedOrigin ?? "*",
    allowMethods: ["GET"],
  })
);
app.use(
  "/webhooks/*",
  cors({
    origin: "*",
    allowMethods: ["POST"],
  })
);

// ── Single-tenant routes (backwards compatible) ──
// These use DEFAULT_TENANT ("_default") for Redis key namespacing.
app.route("/health", healthRoute());
app.route("/metrics", metricsRoute());
app.route("/webhooks", webhooksRoute(redis));
app.route("/events", eventsRoute(redis));

// ── Multi-tenant routes ──
// Tenant ID in the URL path enables isolated Redis namespaces, secrets, and rate limits.
// POST /api/t/:tenantId/webhooks/:integration — receive webhooks for a specific tenant
// GET  /api/t/:tenantId/events              — poll events for a specific tenant
app.use("/t/:tenantId/*", tenantContext());
app.use(
  "/t/:tenantId/events/*",
  cors({
    origin: allowedOrigin ?? "*",
    allowMethods: ["GET"],
  })
);
app.use(
  "/t/:tenantId/webhooks/*",
  cors({
    origin: "*",
    allowMethods: ["POST"],
  })
);
app.route("/t/:tenantId/webhooks", webhooksRoute(redis));
app.route("/t/:tenantId/events", eventsRoute(redis));

// ── Tenant management API ──
// POST /api/tenants      — provision a new tenant
// GET  /api/tenants      — list all tenants
// DELETE /api/tenants/:id — delete a tenant
if (!useMemoryStore) {
  app.route("/tenants", tenantsRoute(redis));
}
