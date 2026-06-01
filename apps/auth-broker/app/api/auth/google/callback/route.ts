import { NextResponse } from "next/server";
import { errorJson, exchangeGoogleCode, persistBrokerCredential } from "@/lib/oauth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookieMap = new Map(
    cookieHeader.split(";").map((cookie) => {
      const [key, ...value] = cookie.trim().split("=");
      return [key, decodeURIComponent(value.join("="))];
    })
  );

  if (!code || !state || cookieMap.get("oauth_state") !== state) {
    return errorJson(400, "OAuth state mismatch");
  }

  const credKey = cookieMap.get("oauth_cred_key");
  const handoffId = cookieMap.get("oauth_broker_handoff_id");
  const challenge = cookieMap.get("oauth_broker_challenge");
  const returnOrigin = cookieMap.get("oauth_broker_return_origin");
  if (!credKey || !handoffId || !challenge || !returnOrigin) {
    return errorJson(400, "OAuth broker session missing");
  }

  const tokens = await exchangeGoogleCode(code);
  if (!tokens?.refresh_token) {
    return errorJson(502, "Google OAuth returned no refresh token");
  }

  await persistBrokerCredential({
    handoffId,
    challenge,
    returnOrigin,
    credKey,
    refreshToken: tokens.refresh_token,
    accessToken: tokens.access_token,
  });

  const response = NextResponse.redirect(
    new URL(
      `/api/auth/broker/google/callback?handoffId=${encodeURIComponent(handoffId)}`,
      url.origin
    )
  );
  response.cookies.delete("oauth_state");
  response.cookies.delete("oauth_cred_key");
  response.cookies.delete("oauth_broker_handoff_id");
  response.cookies.delete("oauth_broker_challenge");
  response.cookies.delete("oauth_broker_return_origin");
  return response;
}
