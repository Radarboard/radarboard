import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCredentialRepo } from "@/db/repository";
import { errorJson, parseSearchParams } from "@/lib/api";
import { OAUTH_PROVIDERS } from "@/lib/auth/oauth-providers";
import {
  getOAuthBrokerOrigin,
  isAllowedBrokerReturnOrigin,
  isBrokerOrigin,
  randomToken,
  resolveBrokerGoogleClientCredentials,
  resolveRequestOrigin,
  sha256Base64Url,
} from "./broker";
import { getBrokerLocalCookieNames } from "./broker-local-callback";

const providerRedirectQuerySchema = z.object({
  credKey: z.string().optional(),
  scopes: z.string().optional(),
  debug: z.string().optional(),
  handoffId: z.string().optional(),
  handoffChallenge: z.string().optional(),
  returnOrigin: z.string().optional(),
  desktopReturnScheme: z.enum(["radarboard", "radarboard-dev"]).optional(),
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

  const url = new URL(request.url);
  const referer = request.headers.get("referer");
  const refererOrigin = referer ? new URL(referer).origin : null;
  const requestOrigin = resolveRequestOrigin(request);
  const effectiveOrigin = refererOrigin ?? requestOrigin;
  const brokerOrigin = getOAuthBrokerOrigin();
  const shouldUseBroker = provider === "google" && !isBrokerOrigin(effectiveOrigin);

  if (shouldUseBroker) {
    const handoffId = randomToken();
    const verifier = randomToken();
    const challenge = sha256Base64Url(verifier);
    const cookieStore = await cookies();
    const isSecure = url.protocol === "https:";
    const names = getBrokerLocalCookieNames();

    cookieStore.set(names.handoffId, handoffId, {
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });
    cookieStore.set(names.verifier, verifier, {
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });
    cookieStore.set(names.credKey, credKey, {
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });
    if (parsed.data.desktopReturnScheme) {
      cookieStore.set(names.desktopReturnScheme, parsed.data.desktopReturnScheme, {
        httpOnly: true,
        secure: isSecure,
        sameSite: "lax",
        maxAge: 600,
        path: "/",
      });
    }

    const brokerUrl = new URL(`/api/auth/${provider}/redirect`, brokerOrigin);
    brokerUrl.searchParams.set("credKey", credKey);
    brokerUrl.searchParams.set("scopes", scopes);
    brokerUrl.searchParams.set("handoffId", handoffId);
    brokerUrl.searchParams.set("handoffChallenge", challenge);
    brokerUrl.searchParams.set("returnOrigin", effectiveOrigin);
    return NextResponse.redirect(brokerUrl.toString());
  }

  const handoffId = parsed.data.handoffId;
  const handoffChallenge = parsed.data.handoffChallenge;
  const returnOrigin = parsed.data.returnOrigin;
  const isBrokerHandoff = Boolean(handoffId || handoffChallenge || returnOrigin);
  if (isBrokerHandoff) {
    if (!handoffId || !handoffChallenge || !returnOrigin) {
      return errorJson(400, "Incomplete OAuth broker handoff");
    }
    if (!isAllowedBrokerReturnOrigin(returnOrigin)) {
      return errorJson(400, "OAuth broker return origin is not allowed");
    }
  }

  const repo = getCredentialRepo();
  const brokerGoogleCreds =
    provider === "google" ? await resolveBrokerGoogleClientCredentials(credKey) : null;
  const storedCreds = brokerGoogleCreds ? null : await repo.getCredential(credKey);
  const clientId = brokerGoogleCreds?.clientId ?? storedCreds?.clientId;
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

  const origin = effectiveOrigin;
  const redirectUri = `${origin}/api/auth/${provider}/callback`;

  cookieStore.set("oauth_origin", origin, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    maxAge: 300,
    path: "/",
  });
  if (isBrokerHandoff) {
    cookieStore.set("oauth_broker_handoff_id", handoffId!, {
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });
    cookieStore.set("oauth_broker_challenge", handoffChallenge!, {
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });
    cookieStore.set("oauth_broker_return_origin", returnOrigin!, {
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });
  }

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
