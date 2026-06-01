/* biome-ignore-all lint/style/useNamingConvention: OAuth broker payload fields use protocol names. */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCredentialRepo } from "@/db/repository";
import { errorJson, parseBody, parseSearchParams } from "@/lib/api";
import { OAUTH_PROVIDERS } from "@/lib/auth/oauth-providers";
import { getWebEnv, WEB_ENV_KEYS } from "@/lib/env";

const DEFAULT_BROKER_ORIGIN = "https://app.radarboard.app";
const HANDOFF_TTL_MS = 10 * 60 * 1000;

const brokerCallbackQuerySchema = z.object({
  handoffId: z.string().min(32),
});

const brokerRedeemBodySchema = z.object({
  handoffId: z.string().min(32),
  verifier: z.string().min(32),
});

const brokerAccessTokenBodySchema = z.object({
  brokerCredentialToken: z.string().min(32),
});

export function getOAuthBrokerOrigin(): string {
  return (getWebEnv(WEB_ENV_KEYS.oauth.brokerUrl) ?? DEFAULT_BROKER_ORIGIN).replace(/\/+$/u, "");
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256Base64Url(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}

function brokerHandoffKey(handoffId: string): string {
  return `oauth-broker-handoff::${handoffId}`;
}

function brokerCredentialKey(token: string): string {
  return `oauth-broker-credential::${sha256Base64Url(token)}`;
}

function isExpired(expiresAt: string | undefined): boolean {
  if (!expiresAt) return true;
  return Number.isNaN(Date.parse(expiresAt)) || Date.parse(expiresAt) < Date.now();
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function resolveRequestOrigin(request: Request): string {
  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const hostHeader = forwardedHost ?? request.headers.get("host");
  return hostHeader ? `${forwardedProto}://${hostHeader}` : url.origin;
}

export function isBrokerOrigin(origin: string): boolean {
  return origin === getOAuthBrokerOrigin();
}

export function isAllowedBrokerReturnOrigin(origin: string): boolean {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }

  if (url.protocol !== "https:") return false;
  if (url.origin === getOAuthBrokerOrigin()) return true;
  if (url.protocol === "https:" && url.hostname.endsWith(".radarboard.app")) return true;

  const isLoopback =
    url.hostname === "localhost" ||
    url.hostname.endsWith(".localhost") ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "::1" ||
    url.hostname === "[::1]";

  return isLoopback;
}

export async function resolveBrokerGoogleClientCredentials(
  fallbackCredKey = "google-search-console"
): Promise<{ clientId: string; clientSecret: string } | null> {
  const envClientId = getWebEnv(WEB_ENV_KEYS.oauth.googleClientId);
  const envClientSecret = getWebEnv(WEB_ENV_KEYS.oauth.googleClientSecret);
  if (envClientId && envClientSecret) {
    return { clientId: envClientId, clientSecret: envClientSecret };
  }

  const creds = await getCredentialRepo().getCredential(fallbackCredKey);
  if (creds?.clientId && creds.clientSecret) {
    return { clientId: creds.clientId, clientSecret: creds.clientSecret };
  }

  return null;
}

export async function persistBrokerHandoffCredential({
  handoffId,
  challenge,
  returnOrigin,
  provider,
  credKey,
  clientId,
  clientSecret,
  refreshToken,
  accessToken,
}: {
  handoffId: string;
  challenge: string;
  returnOrigin: string;
  provider: string;
  credKey: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  accessToken?: string;
}) {
  const brokerCredentialToken = randomToken(48);
  const expiresAt = new Date(Date.now() + HANDOFF_TTL_MS).toISOString();
  const repo = getCredentialRepo();

  await repo.setCredential(brokerCredentialKey(brokerCredentialToken), {
    provider,
    credKey,
    clientId,
    clientSecret,
    refreshToken,
    accessToken: accessToken ?? "",
    createdAt: new Date().toISOString(),
  });

  await repo.setCredential(brokerHandoffKey(handoffId), {
    challenge,
    returnOrigin,
    provider,
    credKey,
    brokerCredentialToken,
    expiresAt,
  });
}

export async function handleBrokerCallback(request: Request, provider: string) {
  const parsed = parseSearchParams(new URL(request.url).searchParams, brokerCallbackQuerySchema);
  if (!parsed.ok) return parsed.response;
  const { handoffId } = parsed.data;

  const repo = getCredentialRepo();
  const handoff = await repo.getCredential(brokerHandoffKey(handoffId));
  if (!handoff || handoff.provider !== provider || isExpired(handoff.expiresAt)) {
    return errorJson(400, "OAuth broker session expired");
  }

  if (!handoff.returnOrigin || !isAllowedBrokerReturnOrigin(handoff.returnOrigin)) {
    return errorJson(400, "OAuth broker return origin is not allowed");
  }

  const redirectUrl = new URL(`/api/auth/${provider}/broker-callback`, handoff.returnOrigin);
  redirectUrl.searchParams.set("handoffId", handoffId);
  return NextResponse.redirect(redirectUrl.toString());
}

export async function handleBrokerRedeem(request: Request, provider: string) {
  const parsed = await parseBody(request, brokerRedeemBodySchema);
  if (!parsed.ok) return parsed.response;
  const { handoffId, verifier } = parsed.data;

  const repo = getCredentialRepo();
  const handoff = await repo.getCredential(brokerHandoffKey(handoffId));
  if (!handoff || handoff.provider !== provider || isExpired(handoff.expiresAt)) {
    return errorJson(400, "OAuth broker session expired");
  }

  const expectedChallenge = sha256Base64Url(verifier);
  if (!handoff.challenge || !safeEqual(handoff.challenge, expectedChallenge)) {
    return errorJson(403, "OAuth broker verifier mismatch");
  }

  await repo.deleteCredential(brokerHandoffKey(handoffId));

  return NextResponse.json({
    brokerUrl: getOAuthBrokerOrigin(),
    brokerCredentialToken: handoff.brokerCredentialToken,
    provider,
    credKey: handoff.credKey,
    authMethod: "oauth_broker",
  });
}

export async function handleBrokerAccessToken(request: Request, provider: string) {
  const parsed = await parseBody(request, brokerAccessTokenBodySchema);
  if (!parsed.ok) return parsed.response;

  const repo = getCredentialRepo();
  const credential = await repo.getCredential(
    brokerCredentialKey(parsed.data.brokerCredentialToken)
  );
  if (!credential || credential.provider !== provider || !credential.refreshToken) {
    return errorJson(404, "OAuth broker credential not found");
  }
  if (!credential.clientId || !credential.clientSecret) {
    return errorJson(500, "OAuth broker credential is missing client credentials");
  }

  const providerConfig = OAUTH_PROVIDERS[provider];
  if (!providerConfig) return errorJson(400, `Unknown provider: ${provider}`);

  const tokenRes = await fetch(providerConfig.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: credential.refreshToken,
      client_id: credential.clientId,
      client_secret: credential.clientSecret,
    }),
  });

  if (!tokenRes.ok) {
    return errorJson(502, "OAuth broker token refresh failed");
  }

  const tokenData = (await tokenRes.json()) as { access_token?: string; expires_in?: number };
  if (!tokenData.access_token) {
    return errorJson(502, "OAuth broker token refresh returned no access token");
  }

  return NextResponse.json({
    accessToken: tokenData.access_token,
    expiresIn: tokenData.expires_in ?? 3600,
  });
}
