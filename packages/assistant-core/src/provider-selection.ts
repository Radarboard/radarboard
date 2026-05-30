import { getProvider, listProviders } from "@radarboard/llm/providers/registry";
import type { CredentialRepository } from "@radarboard/types/database";

export interface OAuthRefreshDependencies {
  isExpiredOAuthToken: (cred: Record<string, unknown>) => boolean;
  refreshOAuthToken: (
    providerId: string,
    cred: unknown,
    credentialRepo: CredentialRepository
  ) => Promise<string>;
}

export async function resolveProviderCredentials(
  providerId: string,
  credentialRepo: CredentialRepository,
  deps: OAuthRefreshDependencies
): Promise<{ providerId: string; apiKey: string } | null> {
  const provider = getProvider(providerId);
  if (!provider) return null;

  const cred = await credentialRepo.getCredential(provider.credentialKeyPrefix);
  if (!cred || typeof cred !== "object") return null;
  const credObj = cred as Record<string, unknown>;

  if (deps.isExpiredOAuthToken(credObj) && credObj.refreshToken) {
    try {
      const newToken = await deps.refreshOAuthToken(providerId, credObj, credentialRepo);
      return { providerId, apiKey: newToken };
    } catch {
      return null;
    }
  }

  if ("baseUrl" in credObj && typeof credObj.baseUrl === "string") {
    return { providerId, apiKey: credObj.baseUrl };
  }

  if ("apiKey" in credObj && typeof credObj.apiKey === "string") {
    return { providerId, apiKey: credObj.apiKey };
  }

  return null;
}

export async function resolveProvider(
  credentialRepo: CredentialRepository,
  deps: OAuthRefreshDependencies
) {
  for (const provider of listProviders()) {
    const resolved = await resolveProviderCredentials(provider.id, credentialRepo, deps);
    if (resolved) return resolved;
  }
  return null;
}

export async function resolveModelSelection(
  requestedModel: string | null,
  fallback: { providerId: string; apiKey: string },
  credentialRepo: CredentialRepository,
  deps: OAuthRefreshDependencies
): Promise<{ providerId: string; apiKey: string; modelId: string }> {
  if (!requestedModel?.includes(":")) {
    const provider = getProvider(fallback.providerId);
    const modelId = provider?.defaultModel ?? "gpt-4o-mini";
    return {
      providerId: fallback.providerId,
      apiKey: fallback.apiKey,
      modelId,
    };
  }

  const [requestedProvider, requestedModelId] = requestedModel.split(":", 2);
  if (!requestedProvider || !requestedModelId) {
    const provider = getProvider(fallback.providerId);
    const modelId = provider?.defaultModel ?? "gpt-4o-mini";
    return {
      providerId: fallback.providerId,
      apiKey: fallback.apiKey,
      modelId,
    };
  }

  const resolved = await resolveProviderCredentials(requestedProvider, credentialRepo, deps);
  if (!resolved) {
    const provider = getProvider(fallback.providerId);
    const modelId = provider?.defaultModel ?? "gpt-4o-mini";
    return {
      providerId: fallback.providerId,
      apiKey: fallback.apiKey,
      modelId,
    };
  }

  return {
    providerId: requestedProvider,
    apiKey: resolved.apiKey,
    modelId: requestedModelId,
  };
}
