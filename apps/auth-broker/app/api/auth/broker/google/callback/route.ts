import { NextResponse } from "next/server";
import { brokerHandoffKey, errorJson, isAllowedReturnOrigin, isExpired } from "@/lib/oauth";
import { getRecord } from "@/lib/storage";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const handoffId = url.searchParams.get("handoffId");
  if (!handoffId) return errorJson(400, "Missing handoffId");

  const handoff = await getRecord(brokerHandoffKey(handoffId));
  if (handoff?.provider !== "google" || isExpired(handoff.expiresAt)) {
    return errorJson(400, "OAuth broker session expired");
  }
  if (!handoff.returnOrigin || !isAllowedReturnOrigin(handoff.returnOrigin)) {
    return errorJson(400, "OAuth broker return origin is not allowed");
  }

  const redirectUrl = new URL("/api/auth/google/broker-callback", handoff.returnOrigin);
  redirectUrl.searchParams.set("handoffId", handoffId);
  return NextResponse.redirect(redirectUrl);
}
