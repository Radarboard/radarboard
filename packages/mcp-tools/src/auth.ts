/**
 * Bearer token authentication for the MCP HTTP endpoint.
 *
 * Tokens are user-generated and stored in the credential repository
 * under the key "mcp-api-token". External LLMs include the token
 * in the Authorization header: `Bearer <token>`.
 */

/** Extract bearer token from an Authorization header value. */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();
  return token ? token : null;
}

/** Constant-time string comparison to prevent timing attacks. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);

  let result = 0;
  for (let i = 0; i < bufA.length; i++) {
    result |= (bufA[i] ?? 0) ^ (bufB[i] ?? 0);
  }
  return result === 0;
}

/**
 * Validate a bearer token against the stored MCP API token.
 * Returns true if the token is valid.
 */
export function validateToken(providedToken: string, storedToken: string): boolean {
  if (!providedToken || !storedToken) return false;
  return timingSafeEqual(providedToken, storedToken);
}
