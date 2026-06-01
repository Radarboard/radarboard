import { NextResponse } from "next/server";
import { getBrokerUrl } from "@/lib/env";
import { errorJson, redeemBrokerCredential } from "@/lib/oauth";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    handoffId?: string;
    verifier?: string;
  } | null;
  if (!body?.handoffId || !body.verifier) return errorJson(400, "Missing broker redeem payload");

  const handoff = await redeemBrokerCredential(body.handoffId, body.verifier);
  if (!handoff?.brokerCredentialToken) return errorJson(403, "OAuth broker verifier mismatch");

  return NextResponse.json({
    brokerUrl: getBrokerUrl(),
    brokerCredentialToken: handoff.brokerCredentialToken,
    provider: "google",
    credKey: handoff.credKey,
    authMethod: "oauth_broker",
  });
}
