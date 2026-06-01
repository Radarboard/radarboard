import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getBrokerUrl, getGoogleClientCredentials } from "@/lib/env";
import { deleteRecord, getRecord, setRecord } from "@/lib/storage";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const HANDOFF_TTL_MS = 10 * 60 * 1000;

type GoogleCodeTokenResponse = {
  // biome-ignore lint/style/useNamingConvention: Google OAuth token payloads use snake_case.
  access_token?: string;
  // biome-ignore lint/style/useNamingConvention: Google OAuth token payloads use snake_case.
  refresh_token?: string;
};

type GoogleRefreshTokenResponse = {
  // biome-ignore lint/style/useNamingConvention: Google OAuth token payloads use snake_case.
  access_token?: string;
  // biome-ignore lint/style/useNamingConvention: Google OAuth token payloads use snake_case.
  expires_in?: number;
};

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256Base64Url(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}

export function brokerHandoffKey(handoffId: string): string {
  return `oauth-broker-handoff::${handoffId}`;
}

export function brokerCredentialKey(token: string): string {
  return `oauth-broker-credential::${sha256Base64Url(token)}`;
}

export function isAllowedReturnOrigin(origin: string): boolean {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }

  if (url.protocol !== "https:") return false;
  if (url.hostname === "radarboard.app" || url.hostname.endsWith(".radarboard.app")) return true;
  if (
    url.hostname === "localhost" ||
    url.hostname.endsWith(".localhost") ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "::1" ||
    url.hostname === "[::1]"
  ) {
    return true;
  }

  return false;
}

export function isExpired(expiresAt: string | undefined): boolean {
  if (!expiresAt) return true;
  return Number.isNaN(Date.parse(expiresAt)) || Date.parse(expiresAt) < Date.now();
}

export function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function errorJson(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

export function getBrokerRedirectUri() {
  return `${getBrokerUrl()}/api/auth/google/callback`;
}

export function buildGoogleAuthorizationUrl({ state, scopes }: { state: string; scopes: string }) {
  const { clientId } = getGoogleClientCredentials();
  const authUrl = new URL(GOOGLE_AUTH_URL);
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", getBrokerRedirectUri());
  authUrl.searchParams.set("scope", scopes);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  return authUrl;
}

export async function exchangeGoogleCode(code: string) {
  const { clientId, clientSecret } = getGoogleClientCredentials();
  const headers = new Headers();
  headers.set("Content-Type", "application/x-www-form-urlencoded");
  headers.set("Accept", "application/json");
  const body = new URLSearchParams();
  body.set("code", code);
  body.set("client_id", clientId);
  body.set("client_secret", clientSecret);
  body.set("redirect_uri", getBrokerRedirectUri());
  body.set("grant_type", "authorization_code");

  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers,
    body,
  });

  if (!tokenRes.ok) return null;
  return (await tokenRes.json()) as GoogleCodeTokenResponse;
}

export async function refreshGoogleAccessToken(refreshToken: string) {
  const { clientId, clientSecret } = getGoogleClientCredentials();
  const headers = new Headers();
  headers.set("Content-Type", "application/x-www-form-urlencoded");
  headers.set("Accept", "application/json");
  const body = new URLSearchParams();
  body.set("grant_type", "refresh_token");
  body.set("refresh_token", refreshToken);
  body.set("client_id", clientId);
  body.set("client_secret", clientSecret);

  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers,
    body,
  });

  if (!tokenRes.ok) return null;
  return (await tokenRes.json()) as GoogleRefreshTokenResponse;
}

export async function persistBrokerCredential({
  handoffId,
  challenge,
  returnOrigin,
  credKey,
  refreshToken,
  accessToken,
}: {
  handoffId: string;
  challenge: string;
  returnOrigin: string;
  credKey: string;
  refreshToken: string;
  accessToken?: string;
}) {
  const { clientId, clientSecret } = getGoogleClientCredentials();
  const brokerCredentialToken = randomToken(48);
  const expiresAt = new Date(Date.now() + HANDOFF_TTL_MS).toISOString();

  await setRecord(brokerCredentialKey(brokerCredentialToken), {
    provider: "google",
    credKey,
    clientId,
    clientSecret,
    refreshToken,
    accessToken: accessToken ?? "",
    createdAt: new Date().toISOString(),
  });

  await setRecord(brokerHandoffKey(handoffId), {
    challenge,
    returnOrigin,
    provider: "google",
    credKey,
    brokerCredentialToken,
    expiresAt,
  });
}

export async function redeemBrokerCredential(handoffId: string, verifier: string) {
  const handoff = await getRecord(brokerHandoffKey(handoffId));
  if (handoff?.provider !== "google" || isExpired(handoff.expiresAt)) return null;

  if (!handoff.challenge || !safeEqual(handoff.challenge, sha256Base64Url(verifier))) {
    return null;
  }

  await deleteRecord(brokerHandoffKey(handoffId));
  return handoff;
}
