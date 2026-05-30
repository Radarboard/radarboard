/* biome-ignore-all lint/style/useNamingConvention: OAuth token payloads and form fields use snake_case by spec. */
/**
 * Token refresh logic for OAuth providers.
 *
 * Called automatically when a token is expired before making an API call.
 */
import type { CredentialRepository } from "@radarboard/types/database";
import { getOAuthProvider } from "./providers";

interface OAuthCredential {
  apiKey: string;
  refreshToken: string | null;
  clientId: string;
  clientSecret: string | null;
  tokenType: string;
  expiresAt: string | null;
  authMethod: string;
}

/** Check if a credential is an OAuth token and if it's expired. */
export function isExpiredOAuthToken(cred: Record<string, unknown>): boolean {
  if (cred.authMethod !== "oauth") return false;
  if (!cred.expiresAt) return false;
  return new Date(cred.expiresAt as string) < new Date();
}

/** Refresh an expired OAuth token. Returns the new access token. */
export async function refreshOAuthToken(
  providerId: string,
  cred: OAuthCredential,
  credentialRepo: CredentialRepository
): Promise<string> {
  if (!cred.refreshToken) {
    throw new Error(`No refresh token available for ${providerId}`);
  }

  const provider = getOAuthProvider(providerId);
  if (!provider) {
    throw new Error(`OAuth not supported for ${providerId}`);
  }

  const body: Record<string, string> = {
    grant_type: "refresh_token",
    refresh_token: cred.refreshToken,
    client_id: cred.clientId,
  };

  if (cred.clientSecret) {
    body.client_secret = cred.clientSecret;
  }

  const response = await fetch(provider.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token refresh failed for ${providerId}: ${text}`);
  }

  const tokenData = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };

  // Update stored credential with new tokens
  const credKey = `llm::${providerId}`;
  await credentialRepo.setCredential(credKey, {
    apiKey: tokenData.access_token,
    refreshToken: tokenData.refresh_token ?? cred.refreshToken ?? "",
    clientId: cred.clientId,
    clientSecret: cred.clientSecret ?? "",
    tokenType: cred.tokenType,
    authMethod: cred.authMethod,
    expiresAt: tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : "",
  });

  return tokenData.access_token;
}
