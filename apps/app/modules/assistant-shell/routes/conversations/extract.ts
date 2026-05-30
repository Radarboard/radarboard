import { getProvider, listProviders } from "@radarboard/llm/providers/registry";
import { createEmbedFn } from "@radarboard/llm-adapter-vercel/adapter";
import { createLogger } from "@radarboard/logger/logger";
import type { CredentialRepository } from "@radarboard/types/database";
import { NextResponse } from "next/server";
import { getCredentialRepo, getLlmRepo, getSettingsRepo } from "@/db/repository";
import { extractConversationMemories } from "@/lib/conversation-extractor";
import { featureNotFound, isFeatureEnabled } from "@/lib/features";
import { isExpiredOAuthToken, refreshOAuthToken } from "@/lib/oauth/refresh";

const log = createLogger("api/chat/conversations/extract");

async function extractApiKey(
  providerId: string,
  credObj: Record<string, unknown>,
  credentialRepo: CredentialRepository
): Promise<string | null> {
  if (isExpiredOAuthToken(credObj) && credObj.refreshToken) {
    try {
      return await refreshOAuthToken(
        providerId,
        credObj as unknown as Parameters<typeof refreshOAuthToken>[1],
        credentialRepo
      );
    } catch {
      return null;
    }
  }
  if ("baseUrl" in credObj && typeof credObj.baseUrl === "string") return credObj.baseUrl;
  if ("apiKey" in credObj && typeof credObj.apiKey === "string") return credObj.apiKey;
  return null;
}

async function resolveCredentials(
  credentialRepo: CredentialRepository
): Promise<{ providerId: string; apiKey: string; modelId: string } | null> {
  for (const provider of listProviders()) {
    const cred = await credentialRepo.getCredential(provider.credentialKeyPrefix);
    if (!cred || typeof cred !== "object") continue;

    const apiKey = await extractApiKey(
      provider.id,
      cred as Record<string, unknown>,
      credentialRepo
    );
    if (!apiKey) continue;

    const providerDesc = getProvider(provider.id);
    return {
      providerId: provider.id,
      apiKey,
      modelId: providerDesc?.defaultModel ?? "gpt-4o-mini",
    };
  }
  return null;
}

export async function handleExtractConversationMemories(id: string) {
  if (!isFeatureEnabled("assistant")) return featureNotFound();
  try {
    const credentialRepo = getCredentialRepo();
    const resolved = await resolveCredentials(credentialRepo);
    if (!resolved) {
      return NextResponse.json({ skipped: true, reason: "no provider configured" });
    }

    const { providerId, apiKey, modelId } = resolved;
    const llmRepo = getLlmRepo();
    const embedFn = createEmbedFn({ providerId, apiKey });
    const settingsRepo = getSettingsRepo();
    const llmConfig = await settingsRepo
      .getLlmConfig()
      .catch(() => ({}) as import("@radarboard/types/database").LlmConfig);

    const result = await extractConversationMemories(
      id,
      llmRepo,
      providerId,
      apiKey,
      modelId,
      embedFn,
      llmConfig.extractionPrompt
    );

    return NextResponse.json(result);
  } catch (err) {
    log.error("Conversation extraction failed", { error: err });
    return NextResponse.json({ extracted: 0, skipped: true, reason: "error" });
  }
}
