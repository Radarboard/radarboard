import { createLogger } from "@radarboard/logger/logger";
import type { IntegrationConnection } from "@radarboard/types/database";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCredentialRepo, getSettingsRepo } from "@/db/repository";
import { errorJson, parseBody } from "@/lib/api";
import {
  listKnownIntegrationProviders,
  mergeConnectionsWithLegacy,
} from "@/lib/integration-connections";

const log = createLogger("api/integration-connections");

const capabilitySchema = z.object({
  id: z.string().min(1),
  enabled: z.boolean(),
  config: z.record(z.string(), z.unknown()).optional(),
  resources: z.record(z.string(), z.unknown()).optional(),
});

const connectionUpsertSchema = z.object({
  id: z.string().min(1),
  provider: z.string().min(1),
  name: z.string().min(1),
  credentialKey: z.string().min(1),
  enabled: z.boolean(),
  isDefault: z.boolean().optional(),
  capabilities: z.array(capabilitySchema).optional().default([]),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const connectionDeleteSchema = z.object({
  id: z.string().min(1),
});

function normalizeConnections(connections: IntegrationConnection[]): IntegrationConnection[] {
  const byProvider = new Map<string, IntegrationConnection[]>();

  for (const connection of connections) {
    const list = byProvider.get(connection.provider) ?? [];
    list.push(connection);
    byProvider.set(connection.provider, list);
  }

  return Array.from(byProvider.values()).flatMap((providerConnections) => {
    const hasDefault = providerConnections.some((connection) => connection.isDefault);

    return providerConnections.map((connection, index) => ({
      ...connection,
      isDefault: hasDefault ? connection.isDefault : index === 0,
    }));
  });
}

export async function handleGetIntegrationConnections() {
  try {
    const settingsRepo = getSettingsRepo();
    const credentialRepo = getCredentialRepo();

    const [explicitConnections, credentialKeys] = await Promise.all([
      settingsRepo.getIntegrationConnections().catch(() => []),
      credentialRepo.listCredentialKeys().catch(() => []),
    ]);

    return NextResponse.json({
      connections: mergeConnectionsWithLegacy(explicitConnections, credentialKeys),
      providers: listKnownIntegrationProviders(),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load integration connections";
    log.error("Failed to load integration connections", { error });
    return errorJson(500, message);
  }
}

export async function handleUpsertIntegrationConnection(request: Request) {
  try {
    const parsed = await parseBody(request, connectionUpsertSchema);
    if (!parsed.ok) return parsed.response;

    const repo = getSettingsRepo();
    const existing = await repo.getIntegrationConnections().catch(() => []);
    const now = Math.floor(Date.now() / 1000);
    const previous = existing.find((connection) => connection.id === parsed.data.id);

    const nextConnection: IntegrationConnection = {
      ...parsed.data,
      isDefault: parsed.data.isDefault ?? previous?.isDefault ?? existing.length === 0,
      source: "explicit",
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
    };

    const remaining = existing.filter((connection) => connection.id !== nextConnection.id);
    const normalized = normalizeConnections([
      ...remaining.map((connection) =>
        connection.provider === nextConnection.provider && nextConnection.isDefault
          ? { ...connection, isDefault: false, updatedAt: now }
          : connection
      ),
      nextConnection,
    ]);

    await repo.setIntegrationConnections(normalized);

    return NextResponse.json({ success: true, connection: nextConnection });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save integration connection";
    log.error("Failed to save integration connection", { error });
    return errorJson(500, message);
  }
}

export async function handleDeleteIntegrationConnection(request: Request) {
  try {
    const parsed = await parseBody(request, connectionDeleteSchema);
    if (!parsed.ok) return parsed.response;

    const repo = getSettingsRepo();
    const existing = await repo.getIntegrationConnections().catch(() => []);
    const target = existing.find((connection) => connection.id === parsed.data.id);
    if (!target) {
      return errorJson(404, "Connection not found");
    }

    const remaining = existing.filter((connection) => connection.id !== parsed.data.id);
    const normalized = normalizeConnections(remaining);
    await repo.setIntegrationConnections(normalized);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete integration connection";
    log.error("Failed to delete integration connection", { error });
    return errorJson(500, message);
  }
}
