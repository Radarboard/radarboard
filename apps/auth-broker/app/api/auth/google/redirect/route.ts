import { NextResponse } from "next/server";
import {
  buildGoogleAuthorizationUrl,
  errorJson,
  isAllowedReturnOrigin,
  randomToken,
} from "@/lib/oauth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const credKey = url.searchParams.get("credKey");
  const scopes = url.searchParams.get("scopes") ?? "";
  const handoffId = url.searchParams.get("handoffId");
  const handoffChallenge = url.searchParams.get("handoffChallenge");
  const returnOrigin = url.searchParams.get("returnOrigin");

  if (!credKey || !handoffId || !handoffChallenge || !returnOrigin) {
    return errorJson(400, "Incomplete OAuth broker handoff");
  }
  if (!isAllowedReturnOrigin(returnOrigin)) {
    return errorJson(400, "OAuth broker return origin is not allowed");
  }

  const state = randomToken();
  const response = NextResponse.redirect(buildGoogleAuthorizationUrl({ state, scopes }));
  const cookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    maxAge: 600,
    path: "/",
  };

  response.cookies.set("oauth_state", state, cookieOptions);
  response.cookies.set("oauth_cred_key", credKey, cookieOptions);
  response.cookies.set("oauth_broker_handoff_id", handoffId, cookieOptions);
  response.cookies.set("oauth_broker_challenge", handoffChallenge, cookieOptions);
  response.cookies.set("oauth_broker_return_origin", returnOrigin, cookieOptions);

  return response;
}
