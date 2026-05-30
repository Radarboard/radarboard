/**
 * Authentication helpers for the relay poll endpoint.
 *
 * Uses SHA-256 hashing + constant-time comparison to prevent timing attacks.
 * Hashing normalizes both inputs to the same length, eliminating the
 * length-leaking side-channel that a raw XOR comparison would have.
 */

import { createHash, timingSafeEqual } from "node:crypto";
import { getRelayEnv, RELAY_ENV_KEYS } from "./env.js";

/**
 * Verify the Authorization header against the configured poll secret(s).
 *
 * Supports zero-downtime rotation: set a comma-separated list
 * (e.g. `RELAY_POLL_SECRET=new-secret,old-secret`) and verification
 * will try each key until one matches.
 */
export function verifyPollAuth(authHeader: string | undefined): boolean {
  if (!authHeader) return false;

  const prefix = "Bearer ";
  if (!authHeader.startsWith(prefix)) return false;

  const token = authHeader.slice(prefix.length);
  const raw = getRelayEnv(RELAY_ENV_KEYS.auth.pollSecret);
  if (!raw) return false;

  const secrets = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return secrets.some((secret) => safeCompare(token, secret));
}

/**
 * Constant-time string comparison using SHA-256 + crypto.timingSafeEqual.
 * Hashing both inputs ensures equal length regardless of original strings,
 * preventing length-based timing side-channels.
 */
function safeCompare(a: string, b: string): boolean {
  const hashA = createHash("sha256").update(a).digest();
  const hashB = createHash("sha256").update(b).digest();
  return timingSafeEqual(hashA, hashB);
}
