/**
 * Centralized environment variable definitions for the webhook relay.
 *
 * All relay-specific env vars should be referenced through this module
 * instead of raw `process.env.*` access.
 */

export const RELAY_ENV_KEYS = {
  redis: {
    url: "KV_REST_API_URL",
    token: "KV_REST_API_TOKEN",
  },
  auth: {
    pollSecret: "RELAY_POLL_SECRET",
    adminSecret: "RELAY_ADMIN_SECRET",
  },
  sentry: {
    dsn: "SENTRY_DSN",
  },
  cors: {
    allowedOrigin: "ALLOWED_ORIGIN",
  },
  controls: {
    enabled: "RELAY_ENABLED",
    store: "RELAY_STORE",
  },
  webhookSecrets: {
    github: "WEBHOOK_SECRET_GITHUB",
    vercel: "WEBHOOK_SECRET_VERCEL",
    sentry: "WEBHOOK_SECRET_SENTRY",
    linear: "WEBHOOK_SECRET_LINEAR",
    betterstack: "WEBHOOK_SECRET_BETTERSTACK",
  },
} as const;

/**
 * Read an environment variable by its canonical name.
 * Returns `undefined` when the variable is missing or empty.
 */
export function getRelayEnv(name: string): string | undefined {
  const value = process.env[name];
  return value || undefined;
}

/**
 * Look up webhook secrets for a given integration.
 *
 * Supports zero-downtime secret rotation: set a comma-separated list
 * (e.g. `WEBHOOK_SECRET_GITHUB=new-secret,old-secret`) and verification
 * will try each key until one matches.
 *
 * Returns an empty array when the integration is unknown or not configured.
 */
export function getWebhookSecrets(integration: string): string[] {
  const key =
    RELAY_ENV_KEYS.webhookSecrets[integration as keyof typeof RELAY_ENV_KEYS.webhookSecrets];
  if (!key) return [];
  const raw = getRelayEnv(key);
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
