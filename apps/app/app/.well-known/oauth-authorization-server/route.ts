import { NextResponse } from "next/server";
import { getAppUrl } from "@/lib/mcp-oauth";

/**
 * GET /.well-known/oauth-authorization-server
 * RFC 8414 authorization server metadata — required by the OpenAI Apps SDK.
 * Tells ChatGPT where to register, authorize, and exchange tokens.
 */
export async function GET() {
  const appUrl = getAppUrl();
  return NextResponse.json(
    {
      issuer: appUrl,
      // biome-ignore lint/style/useNamingConvention: RFC 8414
      authorization_endpoint: `${appUrl}/api/oauth/authorize`,
      // biome-ignore lint/style/useNamingConvention: RFC 8414
      token_endpoint: `${appUrl}/api/oauth/token`,
      // biome-ignore lint/style/useNamingConvention: RFC 8414
      registration_endpoint: `${appUrl}/api/oauth/register`,
      // biome-ignore lint/style/useNamingConvention: RFC 8414
      scopes_supported: ["read"],
      // biome-ignore lint/style/useNamingConvention: RFC 8414
      response_types_supported: ["code"],
      // biome-ignore lint/style/useNamingConvention: RFC 8414
      grant_types_supported: ["authorization_code"],
      // biome-ignore lint/style/useNamingConvention: RFC 8414
      code_challenge_methods_supported: ["S256"],
      // biome-ignore lint/style/useNamingConvention: RFC 8414
      token_endpoint_auth_methods_supported: ["client_secret_post"],
    },
    {
      headers: { "Cache-Control": "no-store" },
    }
  );
}
