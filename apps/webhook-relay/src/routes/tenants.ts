/**
 * Tenant management API.
 *
 * POST   /api/tenants           — Create a new tenant (returns tenant config + webhook URLs)
 * GET    /api/tenants           — List all tenants
 * GET    /api/tenants/:id       — Get a specific tenant
 * DELETE /api/tenants/:id       — Delete a tenant and all its data
 * PUT    /api/tenants/:id/secrets — Update tenant secrets
 *
 * All endpoints require the admin secret (RELAY_ADMIN_SECRET) for authorization.
 */

import type { Redis } from "@upstash/redis";
import { Hono } from "hono";
import { getRelayEnv } from "../lib/env.js";
import {
  createTenant,
  deleteTenant,
  getTenantConfig,
  getTenantSecrets,
  listTenants,
  setTenantSecrets,
  type TenantSecrets,
} from "../lib/tenant.js";

function verifyAdminAuth(authHeader: string | undefined): boolean {
  const adminSecret = getRelayEnv("RELAY_ADMIN_SECRET");
  if (!adminSecret) return false;
  if (!authHeader?.startsWith("Bearer ")) return false;
  return authHeader.slice(7) === adminSecret;
}

export function tenantsRoute(redis: Redis): Hono {
  const route = new Hono();

  // Auth middleware for all tenant management endpoints
  route.use("/*", async (c, next) => {
    if (!verifyAdminAuth(c.req.header("authorization"))) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    await next();
  });

  // Create a new tenant
  route.post("/", async (c) => {
    const body = await c.req.json<{ id?: string; label?: string }>();
    const tenantId = body.id || crypto.randomUUID().slice(0, 8);

    // Check if tenant already exists
    const existing = await getTenantConfig(redis, tenantId);
    if (existing) {
      return c.json({ error: "Tenant already exists" }, 409);
    }

    const config = await createTenant(redis, tenantId, body.label);

    // Generate initial secrets
    const pollSecret = crypto.randomUUID();
    const secrets: TenantSecrets = {
      pollSecret,
      webhookSecrets: {},
    };
    await setTenantSecrets(redis, tenantId, secrets);

    return c.json(
      {
        tenant: config,
        pollSecret,
        webhookBaseUrl: `/api/t/${tenantId}/webhooks`,
        pollUrl: `/api/t/${tenantId}/events`,
      },
      201
    );
  });

  // List all tenants
  route.get("/", async (c) => {
    const tenants = await listTenants(redis);
    return c.json({ tenants });
  });

  // Get a specific tenant
  route.get("/:id", async (c) => {
    const tenantId = c.req.param("id");
    const config = await getTenantConfig(redis, tenantId);
    if (!config) {
      return c.json({ error: "Tenant not found" }, 404);
    }
    return c.json({ tenant: config });
  });

  // Delete a tenant
  route.delete("/:id", async (c) => {
    const tenantId = c.req.param("id");
    const config = await getTenantConfig(redis, tenantId);
    if (!config) {
      return c.json({ error: "Tenant not found" }, 404);
    }
    await deleteTenant(redis, tenantId);
    return c.json({ deleted: true });
  });

  // Update tenant secrets
  route.put("/:id/secrets", async (c) => {
    const tenantId = c.req.param("id");
    const config = await getTenantConfig(redis, tenantId);
    if (!config) {
      return c.json({ error: "Tenant not found" }, 404);
    }

    const body = await c.req.json<Partial<TenantSecrets>>();
    const existing = await getTenantSecrets(redis, tenantId);
    const updated: TenantSecrets = {
      pollSecret: body.pollSecret ?? existing?.pollSecret ?? "",
      webhookSecrets: { ...existing?.webhookSecrets, ...body.webhookSecrets },
    };
    await setTenantSecrets(redis, tenantId, updated);

    return c.json({ updated: true });
  });

  return route;
}
