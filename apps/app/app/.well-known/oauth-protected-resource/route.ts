import { NextResponse } from "next/server";
import { getAppUrl } from "@/lib/mcp-oauth";

/**
 * GET /.well-known/oauth-protected-resource
 * Required by the OpenAI Apps SDK OAuth discovery flow.
 * Tells ChatGPT where to find the authorization server for this MCP resource.
 */
export async function GET() {
  const appUrl = getAppUrl();
  return NextResponse.json(
    {
      resource: appUrl,
      // biome-ignore lint/style/useNamingConvention: RFC 9470 requires snake_case JSON keys
      authorization_servers: [appUrl],
      // biome-ignore lint/style/useNamingConvention: RFC 9470
      scopes_supported: ["read"],
      // biome-ignore lint/style/useNamingConvention: RFC 9470
      resource_documentation: `${appUrl}/docs`,
    },
    {
      headers: { "Cache-Control": "no-store" },
    }
  );
}
