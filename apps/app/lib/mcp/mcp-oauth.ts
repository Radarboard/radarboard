/**
 * OAuth server helpers for the ChatGPT MCP connector.
 *
 * Implements the server side of OpenAI Apps SDK authentication:
 * Dynamic Client Registration (DCR), authorization code flow, and JWT minting.
 *
 * All OAuth state is persisted via the credential repo under namespaced keys:
 *   mcp::oauth::client::{client_id}  — DCR-registered clients
 *   mcp::oauth::code::{code}         — Short-lived auth codes (5 min TTL)
 *   mcp::oauth::approved             — Owner approval flag
 */
import { createHash, randomBytes } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { getCredentialRepo } from "@/data/core/repository";
import { getWebEnv, WEB_ENV_KEYS } from "@/lib/system/runtime/env";

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------

export function getAppUrl(): string {
  const url = getWebEnv(WEB_ENV_KEYS.mcp.appUrl);
  if (!url) throw new Error("NEXT_PUBLIC_APP_URL environment variable is not set");
  return url.replace(/\/$/, "");
}

function getApiSecret(): Uint8Array {
  const secret = getWebEnv(WEB_ENV_KEYS.mcp.apiSecret);
  if (!secret) throw new Error("RADARBOARD_API_SECRET environment variable is not set");
  return new TextEncoder().encode(secret);
}

// ---------------------------------------------------------------------------
// Allowed redirect URI patterns (OpenAI Apps SDK)
// ---------------------------------------------------------------------------

const ALLOWED_REDIRECT_PATTERNS = [
  /^https:\/\/chatgpt\.com\/connector\/oauth\//,
  /^https:\/\/platform\.openai\.com\/apps-manage\/oauth$/,
];

export function isAllowedRedirectUri(uri: string): boolean {
  return ALLOWED_REDIRECT_PATTERNS.some((p) => p.test(uri));
}

// ---------------------------------------------------------------------------
// DCR client store
// ---------------------------------------------------------------------------

export interface OAuthClient {
  clientId: string;
  clientName: string;
  clientSecret: string;
  redirectUris: string[];
}

function clientKey(clientId: string) {
  return `mcp::oauth::client::${clientId}`;
}

export async function storeOAuthClient(client: OAuthClient): Promise<void> {
  await getCredentialRepo().setCredential(clientKey(client.clientId), {
    clientId: client.clientId,
    clientName: client.clientName,
    clientSecret: client.clientSecret,
    redirectUris: JSON.stringify(client.redirectUris),
  });
}

export async function getOAuthClient(clientId: string): Promise<OAuthClient | null> {
  const data = await getCredentialRepo().getCredential(clientKey(clientId));
  if (!data) return null;
  return {
    clientId: data.clientId ?? "",
    clientName: data.clientName ?? "",
    clientSecret: data.clientSecret ?? "",
    redirectUris: JSON.parse(data.redirectUris ?? "[]") as string[],
  };
}

// ---------------------------------------------------------------------------
// Auth code store
// ---------------------------------------------------------------------------

interface StoredAuthCode {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  expiresAt: string;
}

function codeKey(code: string) {
  return `mcp::oauth::code::${code}`;
}

export function generateAuthCode(): string {
  return randomBytes(24).toString("base64url");
}

export async function storeAuthCode(code: string, data: StoredAuthCode): Promise<void> {
  await getCredentialRepo().setCredential(codeKey(code), {
    clientId: data.clientId,
    redirectUri: data.redirectUri,
    codeChallenge: data.codeChallenge,
    expiresAt: data.expiresAt,
  });
}

export async function getAuthCode(code: string): Promise<StoredAuthCode | null> {
  const data = await getCredentialRepo().getCredential(codeKey(code));
  if (!data) return null;
  if (new Date(data.expiresAt ?? "") < new Date()) {
    await deleteAuthCode(code);
    return null;
  }
  return {
    clientId: data.clientId ?? "",
    redirectUri: data.redirectUri ?? "",
    codeChallenge: data.codeChallenge ?? "",
    expiresAt: data.expiresAt ?? "",
  };
}

export async function deleteAuthCode(code: string): Promise<void> {
  try {
    await getCredentialRepo().deleteCredential(codeKey(code));
  } catch {
    // Non-critical
  }
}

// ---------------------------------------------------------------------------
// PKCE verification
// ---------------------------------------------------------------------------

export function verifyCodeChallenge(verifier: string, challenge: string): boolean {
  const computed = createHash("sha256").update(verifier).digest("base64url");
  return computed === challenge;
}

// ---------------------------------------------------------------------------
// Approval flag
// ---------------------------------------------------------------------------

const APPROVED_KEY = "mcp::oauth::approved";

export async function isApproved(): Promise<boolean> {
  try {
    const data = await getCredentialRepo().getCredential(APPROVED_KEY);
    return data?.approved === "true";
  } catch {
    return false;
  }
}

export async function setApproved(): Promise<void> {
  await getCredentialRepo().setCredential(APPROVED_KEY, { approved: "true" });
}

// ---------------------------------------------------------------------------
// JWT helpers
// ---------------------------------------------------------------------------

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 365; // 1 year

export async function mintMcpToken(clientId: string): Promise<string> {
  const appUrl = getAppUrl();
  const secret = getApiSecret();
  // biome-ignore lint/style/useNamingConvention: JWT claim names use snake_case by spec
  return new SignJWT({ client_id: clientId, scope: "read" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(appUrl)
    .setAudience(appUrl)
    .setSubject("chatgpt-connector")
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL_SECONDS}s`)
    .sign(secret);
}

export async function verifyMcpToken(token: string): Promise<boolean> {
  try {
    const appUrl = getAppUrl();
    const secret = getApiSecret();
    await jwtVerify(token, secret, { issuer: appUrl, audience: appUrl });
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// CSRF helpers for the approve form
// ---------------------------------------------------------------------------

export function signFormState(state: string): string {
  const secret = getWebEnv(WEB_ENV_KEYS.mcp.apiSecret) ?? "";
  return createHash("sha256").update(`csrf:${state}:${secret}`).digest("hex");
}

export function verifyFormState(state: string, sig: string): boolean {
  return signFormState(state) === sig;
}
