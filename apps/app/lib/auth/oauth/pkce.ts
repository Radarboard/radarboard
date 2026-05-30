/**
 * PKCE (Proof Key for Code Exchange) utilities for OAuth 2.0.
 * Used by Anthropic and OpenAI OAuth flows.
 */
import { createHash, randomBytes } from "node:crypto";

/** Generate a random code verifier (43-128 characters, unreserved chars only). */
export function generateCodeVerifier(): string {
  return randomBytes(32).toString("base64url");
}

/** Generate the S256 code challenge from a code verifier. */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const hash = createHash("sha256").update(verifier).digest();
  return hash.toString("base64url");
}

/** Generate a random state parameter to prevent CSRF. */
export function generateState(): string {
  return randomBytes(24).toString("base64url");
}
