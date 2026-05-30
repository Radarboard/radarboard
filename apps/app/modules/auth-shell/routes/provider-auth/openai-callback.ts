/* biome-ignore-all lint/style/useNamingConvention: OAuth token payload and response fields use snake_case protocol keys. */

import { createLogger } from "@radarboard/logger/logger";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCredentialRepo } from "@/db/repository";
import { parseSearchParams } from "@/lib/api";
import { getOAuthProvider } from "@/lib/oauth/providers";

const log = createLogger("api/auth/providers/openai/oauth/callback");

interface OAuthStateCookie {
  providerId: string;
  codeVerifier: string;
  state: string;
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
}

const openAiCallbackQuerySchema = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
});

function redirectToSettings(request: Request, error: string | null, providerId?: string) {
  const params = new URLSearchParams();
  params.set("settings", "ai");
  if (error) params.set("oauth_error", error);
  if (providerId) params.set("oauth_success", providerId);
  const origin = new URL(request.url).origin;
  return NextResponse.redirect(new URL(`/?${params.toString()}`, origin));
}

export async function handleOpenAiOAuthCallback(request: Request) {
  const parsed = parseSearchParams(new URL(request.url).searchParams, openAiCallbackQuerySchema);
  if (!parsed.ok) return redirectToSettings(request, "Invalid callback parameters");
  const { code, state, error } = parsed.data;

  if (error) return redirectToSettings(request, `OAuth error: ${error}`);
  if (!code || !state) return redirectToSettings(request, "Missing code or state parameter");

  const cookieStore = await cookies();
  const rawState = cookieStore.get("provider_auth_state")?.value;
  if (!rawState) return redirectToSettings(request, "OAuth session expired. Please try again.");

  let oauthState: OAuthStateCookie;
  try {
    oauthState = JSON.parse(rawState) as OAuthStateCookie;
  } catch (error) {
    log.error("Failed to parse OpenAI OAuth state cookie", { error });
    return redirectToSettings(request, "Invalid OAuth session");
  }

  if (state !== oauthState.state) {
    return redirectToSettings(request, "State mismatch");
  }

  cookieStore.delete("provider_auth_state");

  const provider = getOAuthProvider("openai");
  if (!provider) return redirectToSettings(request, "OpenAI OAuth is not configured");

  const body: Record<string, string> = {
    grant_type: "authorization_code",
    code,
    redirect_uri: oauthState.redirectUri,
    client_id: oauthState.clientId,
    code_verifier: oauthState.codeVerifier,
  };
  if (oauthState.clientSecret) body.client_secret = oauthState.clientSecret;

  const tokenResponse = await fetch(provider.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });

  if (!tokenResponse.ok) {
    const text = await tokenResponse.text();
    return redirectToSettings(request, `Token exchange failed: ${text}`);
  }

  const tokenData = (await tokenResponse.json()) as {
    access_token: string;
    refresh_token?: string;
    token_type?: string;
    expires_in?: number;
  };

  await getCredentialRepo().setCredential("llm::openai", {
    apiKey: tokenData.access_token,
    refreshToken: tokenData.refresh_token ?? "",
    clientId: oauthState.clientId,
    clientSecret: oauthState.clientSecret ?? "",
    tokenType: tokenData.token_type ?? "bearer",
    expiresAt: tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : "",
    authMethod: "oauth",
  });

  return redirectToSettings(request, null, "openai");
}
