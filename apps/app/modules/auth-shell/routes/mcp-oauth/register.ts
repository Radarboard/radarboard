/* biome-ignore-all lint/style/useNamingConvention: OAuth protocol fields intentionally use snake_case response keys. */
import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { errorJson, parseBody } from "@/lib/api";
import { isAllowedRedirectUri, storeOAuthClient } from "@/lib/mcp-oauth";

const oauthRegisterSchema = z.object({
  redirect_uris: z.array(z.string()).min(1),
  client_name: z.string().optional(),
});

export async function handleOAuthRegister(request: Request) {
  const parsed = await parseBody(request, oauthRegisterSchema);
  if (!parsed.ok) {
    return errorJson(400, "invalid_request");
  }

  const uris = parsed.data.redirect_uris;
  const invalidUri = uris.find((u) => !isAllowedRedirectUri(u));
  if (invalidUri) {
    return errorJson(400, "invalid_redirect_uri", {
      error_description: `Redirect URI not allowed: ${invalidUri}`,
    });
  }

  const clientId = `mcp_${randomBytes(16).toString("hex")}`;
  const clientSecret = randomBytes(32).toString("hex");
  const clientName = parsed.data.client_name ?? "ChatGPT Connector";

  await storeOAuthClient({ clientId, clientName, clientSecret, redirectUris: uris });

  return NextResponse.json(
    {
      client_id: clientId,
      client_secret: clientSecret,
      client_name: clientName,
      redirect_uris: uris,
      token_endpoint_auth_method: "client_secret_post",
      grant_types: ["authorization_code"],
      response_types: ["code"],
    },
    { status: 201 }
  );
}
