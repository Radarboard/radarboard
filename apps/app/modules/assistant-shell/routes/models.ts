import { listProviders } from "@radarboard/llm/providers/registry";
import { createLogger } from "@radarboard/logger/logger";
import { NextResponse } from "next/server";
import { getCredentialRepo } from "@/db/repository";
import { errorJson } from "@/lib/api";
import { featureNotFound, isFeatureEnabled } from "@/lib/features";

const log = createLogger("api/chat/models");

/**
 * GET /api/chat/models — list available models grouped by connected provider.
 */
export async function handleGetChatModels() {
  if (!isFeatureEnabled("assistant")) return featureNotFound();
  try {
    const credentialRepo = getCredentialRepo();
    const connectedKeys = await credentialRepo.listCredentialKeys();
    const connectedSet = new Set(connectedKeys);

    const providers = listProviders()
      .filter((p) => connectedSet.has(p.credentialKeyPrefix))
      .map((p) => ({
        id: p.id,
        name: p.name,
        defaultModel: p.defaultModel,
        models: p.models.map((m) => ({
          id: m.id,
          name: m.name,
          contextWindow: m.contextWindow,
          supportsTools: m.supportsTools,
        })),
      }));

    return NextResponse.json({ providers });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    log.error("Failed to list models", { error: err });
    return errorJson(500, `Failed to list models: ${detail}`);
  }
}
