import "@/lib/integrations-init";

import { getAllIntegrations } from "@radarboard/integration-sdk/registry";
import { integrationRoute } from "@radarboard/integration-sdk/routes";
import { createLogger } from "@radarboard/logger/logger";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCacheRepo, getCredentialRepo } from "@/db/repository";
import { errorJson, parseBody, parseSearchParams } from "@/lib/api";

const log = createLogger("api/credentials");

const CredentialPostSchema = z.object({
  key: z.string().min(1, "Missing key"),
  values: z.record(z.string(), z.string().min(1)),
});

const CredentialDeleteSchema = z.object({
  key: z.string().min(1, "Missing key"),
});

const CredentialGetSchema = z.object({
  key: z.string().min(1).optional(),
});

async function clearRouteCache(route: string) {
  try {
    const repo = getCacheRepo();
    const keys = await repo.getKeysByRoute(route);
    await Promise.all(keys.map((key) => repo.delete(key)));
  } catch {
    // Best-effort cache invalidation only.
  }
}

async function invalidateCredentialDependentCaches(key: string) {
  const routes = new Set<string>();

  for (const integration of getAllIntegrations()) {
    if (integration.id !== key && integration.auth.id !== key) continue;

    for (const dataSource of integration.dataSources ?? []) {
      routes.add(integrationRoute(integration.id, dataSource.action));
    }
  }

  await Promise.all(Array.from(routes).map((route) => clearRouteCache(route)));
}

export async function handleGetCredentials(request: Request) {
  const params = parseSearchParams(new URL(request.url).searchParams, CredentialGetSchema);
  if (!params.ok) return params.response;

  const { key } = params.data;

  try {
    const repo = getCredentialRepo();

    if (key) {
      const values = await repo.getCredential(key);
      return NextResponse.json({ key, values });
    }

    const connectedKeys = await repo.listCredentialKeys();
    return NextResponse.json({ connectedKeys });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("no such table") || message.includes("does not exist")) {
      if (key) {
        return NextResponse.json({ key, values: null });
      }
      return NextResponse.json({ connectedKeys: [] });
    }
    log.error("GET error", { message });
    return errorJson(500, "Failed to list credentials");
  }
}

export async function handleSaveCredentials(request: Request) {
  try {
    const parsed = await parseBody(request, CredentialPostSchema);
    if (!parsed.ok) return parsed.response;

    const { key, values } = parsed.data;
    const repo = getCredentialRepo();
    await repo.setCredential(key, values);
    await invalidateCredentialDependentCaches(key);

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error("POST error", { error });
    return errorJson(500, "Failed to save credentials");
  }
}

export async function handleDeleteCredentials(request: Request) {
  try {
    const parsed = await parseBody(request, CredentialDeleteSchema);
    if (!parsed.ok) return parsed.response;

    const { key } = parsed.data;
    const repo = getCredentialRepo();

    let previousValues: Record<string, string> | null = null;
    try {
      previousValues = await repo.getCredential(key);
    } catch (error) {
      log.warn("Failed to read previous values for deletion", { key, error });
    }

    await repo.deleteCredential(key);
    await invalidateCredentialDependentCaches(key);

    return NextResponse.json({ success: true, previousValues });
  } catch (error) {
    log.error("DELETE error", { error });
    return errorJson(500, "Failed to delete credentials");
  }
}
