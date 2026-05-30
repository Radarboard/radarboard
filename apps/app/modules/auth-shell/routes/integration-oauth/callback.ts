/* biome-ignore-all lint/style/useNamingConvention: OAuth token payload and response fields use snake_case protocol keys. */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCredentialRepo } from "@/db/repository";
import { parseSearchParams } from "@/lib/api";
import { getOAuthProvider } from "@/lib/oauth/providers";

interface OAuthStateCookie {
  providerId: string;
  codeVerifier: string;
  state: string;
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
}

const CallbackSearchSchema = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
});

/**
 * GET /api/auth/oauth/callback?code=...&state=...
 *
 * Handles the OAuth callback: validates state, exchanges the authorization
 * code for tokens, stores them as credentials, and redirects back to settings.
 */
export async function handleIntegrationOAuthCallback(request: Request) {
  const parsedSearch = parseSearchParams(new URL(request.url).searchParams, CallbackSearchSchema);
  if (!parsedSearch.ok) {
    return redirectToSettings(request, "Invalid callback parameters");
  }

  const { code, state, error, error_description: errorDescription } = parsedSearch.data;

  if (error) {
    const desc = errorDescription ?? error;
    return redirectToSettings(request, `OAuth error: ${desc}`);
  }

  if (!code || !state) {
    return redirectToSettings(request, "Missing code or state parameter");
  }

  const cookieStore = await cookies();
  const rawState = cookieStore.get("oauth_state")?.value;
  if (!rawState) {
    return redirectToSettings(request, "OAuth session expired. Please try again.");
  }

  let oauthState: OAuthStateCookie;
  try {
    oauthState = JSON.parse(rawState) as OAuthStateCookie;
  } catch {
    return redirectToSettings(request, "Invalid OAuth session");
  }

  if (state !== oauthState.state) {
    return redirectToSettings(request, "State mismatch — possible CSRF attack");
  }

  cookieStore.delete("oauth_state");

  const providerConfig = getOAuthProvider(oauthState.providerId);
  if (!providerConfig) {
    return redirectToSettings(request, "Unknown OAuth provider");
  }

  const tokenBody: Record<string, string> = {
    grant_type: "authorization_code",
    code,
    redirect_uri: oauthState.redirectUri,
    client_id: oauthState.clientId,
    code_verifier: oauthState.codeVerifier,
  };

  if (oauthState.clientSecret) {
    tokenBody.client_secret = oauthState.clientSecret;
  }

  const tokenResponse = await fetch(providerConfig.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(tokenBody).toString(),
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

  const credentialRepo = getCredentialRepo();
  const credKey = `llm::${oauthState.providerId}`;

  await credentialRepo.setCredential(credKey, {
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

  return redirectToSettings(request, null, oauthState.providerId);
}

function redirectToSettings(request: Request, error: string | null, providerId?: string) {
  const params = new URLSearchParams();
  params.set("settings", "ai");
  if (error) params.set("oauth_error", error);
  if (providerId) params.set("oauth_success", providerId);
  const origin = new URL(request.url).origin;
  return NextResponse.redirect(new URL(`/?${params.toString()}`, origin));
}
