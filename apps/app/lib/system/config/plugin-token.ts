/**
 * Plugin token signing and verification.
 *
 * Issues short-lived HMAC-SHA256 tokens scoped to a specific pluginId.
 * The token prevents cross-plugin data access by binding the pluginId into
 * a signed payload that the plugin data API routes verify before execution.
 *
 * Token format: `<base64url-payload>.<hex-signature>`
 * Payload: `{ pid: string; exp: number }`
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { getWebEnv, WEB_ENV_KEYS } from "@/lib/env";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function getSecret(): string {
  const secret = getWebEnv(WEB_ENV_KEYS.mcp.apiSecret);
  if (!secret) {
    throw new Error("RADARBOARD_API_SECRET is not configured");
  }
  return secret;
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input).toString("base64url");
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, "base64url").toString("utf-8");
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/** Create a signed token scoped to a specific pluginId. */
export function signPluginToken(pluginId: string): string {
  const secret = getSecret();
  const payload = base64UrlEncode(
    JSON.stringify({ pid: pluginId, exp: Date.now() + TOKEN_TTL_MS })
  );
  const signature = sign(payload, secret);
  return `${payload}.${signature}`;
}

/**
 * Verify a plugin token and check that it matches the expected pluginId.
 * Returns `true` if the token is valid, not expired, and scoped to the given pluginId.
 */
export function verifyPluginToken(token: string | null, expectedPluginId: string): boolean {
  if (!token) return false;

  const dotIndex = token.indexOf(".");
  if (dotIndex === -1) return false;

  const payload = token.slice(0, dotIndex);
  const receivedSig = token.slice(dotIndex + 1);

  let secret: string;
  try {
    secret = getSecret();
  } catch {
    return false;
  }

  // Constant-time signature comparison
  const expectedSig = sign(payload, secret);
  const sigA = Buffer.from(receivedSig, "hex");
  const sigB = Buffer.from(expectedSig, "hex");
  if (sigA.length !== sigB.length) return false;
  if (!timingSafeEqual(sigA, sigB)) return false;

  // Decode and validate payload
  try {
    const data = JSON.parse(base64UrlDecode(payload)) as {
      pid?: string;
      exp?: number;
    };
    if (data.pid !== expectedPluginId) return false;
    if (typeof data.exp !== "number" || data.exp < Date.now()) return false;
    return true;
  } catch {
    return false;
  }
}
