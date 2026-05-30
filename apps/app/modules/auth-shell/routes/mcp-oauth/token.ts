/* biome-ignore-all lint/style/useNamingConvention: OAuth token response fields intentionally use snake_case keys. */
import { NextResponse } from "next/server";
import { z } from "zod";
import { errorJson, parseBody, parseUrlEncodedBody } from "@/lib/api";
import {
  deleteAuthCode,
  getAuthCode,
  getOAuthClient,
  mintMcpToken,
  verifyCodeChallenge,
} from "@/lib/mcp-oauth";

const oauthTokenJsonSchema = z.record(z.string(), z.string());

export async function handleOAuthToken(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  let params: Record<string, string>;

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const parsed = await parseUrlEncodedBody(request, oauthTokenJsonSchema);
    if (!parsed.ok) return parsed.response;
    params = parsed.data;
  } else {
    const parsed = await parseBody(request, oauthTokenJsonSchema);
    if (!parsed.ok) return parsed.response;
    params = parsed.data;
  }

  const { grant_type, code, redirect_uri, client_id, client_secret, code_verifier } = params;

  if (grant_type !== "authorization_code") {
    return errorJson(400, "unsupported_grant_type");
  }
  if (!code || !redirect_uri || !client_id || !client_secret || !code_verifier) {
    return errorJson(400, "invalid_request");
  }

  const client = await getOAuthClient(client_id);
  if (!client || client.clientSecret !== client_secret) {
    return errorJson(401, "invalid_client");
  }

  const storedCode = await getAuthCode(code);
  if (!storedCode || storedCode.clientId !== client_id || storedCode.redirectUri !== redirect_uri) {
    return errorJson(400, "invalid_grant");
  }

  if (!verifyCodeChallenge(code_verifier, storedCode.codeChallenge)) {
    return errorJson(400, "invalid_grant", { error_description: "PKCE verification failed" });
  }

  await deleteAuthCode(code);

  const accessToken = await mintMcpToken(client_id);
  const Ttl = 60 * 60 * 24 * 365;

  return NextResponse.json({
    access_token: accessToken,
    token_type: "bearer",
    expires_in: Ttl,
    scope: "read",
  });
}
