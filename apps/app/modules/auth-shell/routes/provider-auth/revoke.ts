/* biome-ignore-all lint/style/useNamingConvention: OAuth revocation payload fields use provider-defined snake_case keys. */
import { NextResponse } from "next/server";
import { getCredentialRepo } from "@/db/repository";
import { errorJson } from "@/lib/api";
import { getWebEnv, WEB_ENV_KEYS } from "@/lib/env";
import { getOAuthProvider } from "@/lib/oauth/providers";

export async function handleRevokeProviderOAuth(providerId: string) {
  const oauthProvider = getOAuthProvider(providerId);
  if (!oauthProvider) {
    return errorJson(400, `Provider "${providerId}" does not support OAuth`);
  }

  const repo = getCredentialRepo();
  const credKey = `llm::${providerId}`;

  let credential: Record<string, string> | null = null;
  try {
    credential = await repo.getCredential(credKey);
  } catch {
    // Credential may not exist — still attempt cleanup
  }

  if (credential?.refreshToken && oauthProvider.revocationEndpoint) {
    const clientId = getWebEnv(WEB_ENV_KEYS.oauth.openaiClientId) ?? "";
    const clientSecret = getWebEnv(WEB_ENV_KEYS.oauth.openaiClientSecret) ?? "";

    try {
      const body: Record<string, string> = {
        token: credential.refreshToken,
        token_type_hint: "refresh_token",
        client_id: clientId,
      };
      if (clientSecret) body.client_secret = clientSecret;

      await fetch(oauthProvider.revocationEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(body).toString(),
      });
    } catch {
      // Swallow — local cleanup happens regardless
    }
  }

  try {
    await repo.deleteCredential(credKey);
  } catch {
    return errorJson(500, "Failed to delete credential");
  }

  return NextResponse.json({ success: true });
}
