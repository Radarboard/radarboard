import { NextResponse } from "next/server";
import { brokerCredentialKey, errorJson, refreshGoogleAccessToken } from "@/lib/oauth";
import { getRecord } from "@/lib/storage";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    brokerCredentialToken?: string;
  } | null;
  if (!body?.brokerCredentialToken) return errorJson(400, "Missing broker credential token");

  const credential = await getRecord(brokerCredentialKey(body.brokerCredentialToken));
  if (credential?.provider !== "google" || !credential.refreshToken) {
    return errorJson(404, "OAuth broker credential not found");
  }

  const tokens = await refreshGoogleAccessToken(credential.refreshToken);
  if (!tokens?.access_token) return errorJson(502, "OAuth broker token refresh failed");

  return NextResponse.json({
    accessToken: tokens.access_token,
    expiresIn: tokens.expires_in ?? 3600,
  });
}
