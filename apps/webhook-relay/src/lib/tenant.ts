/**
 * Tenant context for multi-tenant relay mode.
 *
 * When a tenantId is present in the route path, the relay operates in
 * multi-tenant mode with isolated Redis namespaces, secrets, and rate limits.
 * When absent, it falls back to single-tenant mode (backwards compatible).
 *
 * Tenant secrets (webhook signing keys + poll secret) are stored in Redis
 * under `relay:tenant:{tenantId}:secrets`. This keeps the relay self-contained
 * without requiring access to the main app's database.
 */

import type { Redis } from "@upstash/redis";
import type { MiddlewareHandler } from "hono";

/** Default tenant ID for single-tenant (self-hosted) deployments. */
export const DEFAULT_TENANT = "_default";

/** Redis key prefix for tenant metadata. */
const TENANT_PREFIX = "relay:tenant";

export interface TenantSecrets {
  pollSecret: string;
  webhookSecrets: Record<string, string>; // integration -> secret (comma-separated for rotation)
}

export interface TenantConfig {
  id: string;
  createdAt: number;
  label?: string;
}

/** Build a namespaced Redis key for a tenant. */
export function tenantKey(tenantId: string, ...parts: string[]): string {
  return `relay:${tenantId}:${parts.join(":")}`;
}

/** Hono middleware that extracts tenantId from route params and sets it in context. */
export function tenantContext(): MiddlewareHandler {
  return async (c, next) => {
    const tenantId = c.req.param("tenantId") ?? DEFAULT_TENANT;
    c.set("tenantId", tenantId);
    await next();
  };
}

/** Get the tenantId from Hono context, falling back to DEFAULT_TENANT. */
export function getTenantId(c: { get: (key: string) => unknown }): string {
  return (c.get("tenantId") as string) ?? DEFAULT_TENANT;
}

// ── Tenant CRUD (stored in Redis) ─────────────────────────────────

/** Create a new tenant with generated secrets. */
export async function createTenant(
  redis: Redis,
  tenantId: string,
  label?: string
): Promise<TenantConfig> {
  const config: TenantConfig = {
    id: tenantId,
    createdAt: Date.now(),
    label,
  };
  await redis.set(`${TENANT_PREFIX}:${tenantId}:config`, JSON.stringify(config));
  return config;
}

/** Get tenant config. Returns null if tenant doesn't exist. */
export async function getTenantConfig(
  redis: Redis,
  tenantId: string
): Promise<TenantConfig | null> {
  const raw = await redis.get<string>(`${TENANT_PREFIX}:${tenantId}:config`);
  if (!raw) return null;
  return JSON.parse(raw) as TenantConfig;
}

/** Store tenant secrets (poll secret + webhook signing keys). */
export async function setTenantSecrets(
  redis: Redis,
  tenantId: string,
  secrets: TenantSecrets
): Promise<void> {
  await redis.set(`${TENANT_PREFIX}:${tenantId}:secrets`, JSON.stringify(secrets));
}

/** Get tenant secrets. Returns null if not configured. */
export async function getTenantSecrets(
  redis: Redis,
  tenantId: string
): Promise<TenantSecrets | null> {
  const raw = await redis.get<string>(`${TENANT_PREFIX}:${tenantId}:secrets`);
  if (!raw) return null;
  return JSON.parse(raw) as TenantSecrets;
}

/** Delete a tenant and all its data. */
export async function deleteTenant(redis: Redis, tenantId: string): Promise<void> {
  const keys = [
    `${TENANT_PREFIX}:${tenantId}:config`,
    `${TENANT_PREFIX}:${tenantId}:secrets`,
    tenantKey(tenantId, "events"),
  ];
  await Promise.all(keys.map((key) => redis.del(key)));
}

/** List all tenant IDs. Scans for tenant config keys in Redis. */
export async function listTenants(redis: Redis): Promise<TenantConfig[]> {
  const configs: TenantConfig[] = [];
  let cursor = 0;
  do {
    const [nextCursor, keys] = await redis.scan(cursor, {
      match: `${TENANT_PREFIX}:*:config`,
      count: 100,
    });
    cursor = Number(nextCursor);
    for (const key of keys) {
      const raw = await redis.get<string>(key);
      if (raw) {
        configs.push(JSON.parse(raw) as TenantConfig);
      }
    }
  } while (cursor !== 0);
  return configs;
}
