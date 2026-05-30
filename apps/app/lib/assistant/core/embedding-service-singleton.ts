/**
 * Lazy-initialized singleton for the EmbeddingService.
 *
 * The EmbeddingService needs the LlmRepository and an embed function,
 * both of which depend on the user's configured LLM provider and database.
 * This module resolves those dependencies lazily on first access.
 *
 * Supports provider override — embeddings can use a different provider
 * than the global chat provider (e.g., Ollama for embeddings, OpenAI for chat).
 */

import {
  type OAuthRefreshDependencies,
  resolveProvider,
  resolveProviderCredentials,
} from "@radarboard/assistant-core/provider-selection";
import { EmbeddingService } from "@radarboard/embedding-service";
import type { EmbeddingModelId } from "@radarboard/llm/types";
import { createBatchEmbedFn, createEmbedFn } from "@radarboard/llm-adapter-vercel/adapter";
import { createLogger } from "@radarboard/logger/logger";
import { getCredentialRepo, getLlmRepo } from "@/data/core/repository";
import { isExpiredOAuthToken, refreshOAuthToken } from "@/lib/auth/oauth/refresh";

const log = createLogger("embedding-service");

const OAUTH_DEPS: OAuthRefreshDependencies = {
  isExpiredOAuthToken,
  refreshOAuthToken: (providerId, cred, credentialRepo) =>
    refreshOAuthToken(providerId, cred as Parameters<typeof refreshOAuthToken>[1], credentialRepo),
};

let cachedService: EmbeddingService | null = null;
let cachedCacheKey: string | null = null;

export interface EmbeddingServiceOptions {
  modelId?: EmbeddingModelId;
  /** "auto" = use global chat provider. Otherwise a specific provider ID. */
  providerId?: string;
  dimensions?: number;
}

/**
 * Get or create the EmbeddingService singleton.
 *
 * Re-creates the service if model, provider, or dimensions change.
 * Returns null if no LLM provider is configured.
 */
export async function getEmbeddingService(
  modelIdOrOptions?: EmbeddingModelId | EmbeddingServiceOptions
): Promise<EmbeddingService | null> {
  // Normalize args
  const options: EmbeddingServiceOptions =
    typeof modelIdOrOptions === "string" ? { modelId: modelIdOrOptions } : (modelIdOrOptions ?? {});

  const effectiveModelId = options.modelId ?? "text-embedding-3-small";
  const effectiveProvider = options.providerId ?? "auto";
  const effectiveDimensions = options.dimensions ?? undefined;
  const cacheKey = `${effectiveProvider}:${effectiveModelId}:${effectiveDimensions ?? "default"}`;

  // Return cached if nothing changed
  if (cachedService && cachedCacheKey === cacheKey) {
    return cachedService;
  }

  try {
    const credentialRepo = getCredentialRepo();

    // Resolve provider: specific override or auto (first available)
    let selection: { providerId: string; apiKey: string } | null = null;
    if (effectiveProvider !== "auto") {
      selection = await resolveProviderCredentials(effectiveProvider, credentialRepo, OAUTH_DEPS);
    }
    if (!selection) {
      selection = await resolveProvider(credentialRepo, OAUTH_DEPS);
    }
    if (!selection) {
      log.warn("No LLM provider configured — embedding service unavailable");
      return null;
    }

    const repo = getLlmRepo();
    const embedFn = createEmbedFn({
      providerId: selection.providerId,
      apiKey: selection.apiKey,
      modelId: effectiveModelId,
      dimensions: effectiveDimensions,
    });
    const batchEmbedFn = createBatchEmbedFn({
      providerId: selection.providerId,
      apiKey: selection.apiKey,
      modelId: effectiveModelId,
      dimensions: effectiveDimensions,
    });

    cachedService = new EmbeddingService({
      repo,
      embedFn,
      batchEmbedFn,
      modelId: effectiveModelId,
      dimensions: effectiveDimensions,
    });
    cachedCacheKey = cacheKey;

    log.info("EmbeddingService initialized", {
      modelId: effectiveModelId,
      provider: selection.providerId,
      dimensions: effectiveDimensions ?? "default",
    });
    return cachedService;
  } catch (error) {
    log.error("Failed to initialize EmbeddingService", { error });
    return null;
  }
}

/** Invalidate the cached service (e.g., when settings change). */
export function invalidateEmbeddingService(): void {
  cachedService = null;
  cachedCacheKey = null;
}
