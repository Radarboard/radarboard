import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCredentialRepo } from "@/db/repository";
import { errorJson, parseSearchParams } from "@/lib/api";
import { OAUTH_PROVIDERS } from "@/lib/auth/oauth-providers";
import { normalizeOAuthOrigin } from "@/lib/auth/oauth-redirect";

const providerRedirectQuerySchema = z.object({
  credKey: z.string().optional(),
  scopes: z.string().optional(),
  debug: z.string().optional(),
});

export async function handleIntegrationProviderRedirect(request: Request, provider: string) {
  const providerConfig = OAUTH_PROVIDERS[provider];

  if (!providerConfig) {
    return errorJson(400, `Unknown provider: ${provider}`);
  }

  const parsed = parseSearchParams(new URL(request.url).searchParams, providerRedirectQuerySchema);
  if (!parsed.ok) return parsed.response;
  const { credKey, scopes = "", debug } = parsed.data;

  if (!credKey) {
    return errorJson(400, "Missing credKey param");
  }

  const repo = getCredentialRepo();
  const creds = await repo.getCredential(credKey);
  const clientId = creds?.clientId;

  if (!clientId) {
    return errorJson(400, "Client credentials not configured. Save client ID and secret first.");
  }

  const state = randomBytes(32).toString("hex");
  const isSecure = new URL(request.url).protocol === "https:";

  const cookieStore = await cookies();
  cookieStore.set("oauth_state", state, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    maxAge: 300,
    path: "/",
  });
  cookieStore.set("oauth_cred_key", credKey, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    maxAge: 300,
    path: "/",
  });

  const url = new URL(request.url);
  const referer = request.headers.get("referer");
  const refererOrigin = referer ? new URL(referer).origin : null;
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const hostHeader = forwardedHost ?? request.headers.get("host");
  const effectiveOrigin =
    refererOrigin ?? (hostHeader ? `${forwardedProto}://${hostHeader}` : url.origin);
  const origin = providerConfig.normalizeOrigin
    ? normalizeOAuthOrigin(effectiveOrigin)
    : effectiveOrigin;
  const redirectUri = `${origin}/api/auth/${provider}/callback`;

  cookieStore.set("oauth_origin", origin, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    maxAge: 300,
    path: "/",
  });

  const authUrl = new URL(providerConfig.authorizationUrl);
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", scopes);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("response_type", "code");

  if (providerConfig.authParams) {
    for (const [key, value] of Object.entries(providerConfig.authParams)) {
      authUrl.searchParams.set(key, value);
    }
  }

  if (debug === "1") {
    return NextResponse.json({
      redirectUri,
      clientId: `${clientId.slice(0, 20)}...`,
      scopes,
      authUrl: authUrl.toString(),
    });
  }

  return NextResponse.redirect(authUrl.toString());
}
