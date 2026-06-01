import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCredentialRepo } from "@/db/repository";
import { errorJson, parseSearchParams } from "@/lib/api";
import { getOAuthBrokerOrigin } from "./broker";
import { buildIntegrationSettingsRedirectUrl } from "./provider-callback";

const querySchema = z.object({
  handoffId: z.string().min(32),
});

const HANDOFF_ID_COOKIE = "oauth_broker_handoff_id";
const HANDOFF_VERIFIER_COOKIE = "oauth_broker_verifier";
const HANDOFF_CRED_KEY_COOKIE = "oauth_broker_cred_key";

export function getBrokerLocalCookieNames() {
  return {
    handoffId: HANDOFF_ID_COOKIE,
    verifier: HANDOFF_VERIFIER_COOKIE,
    credKey: HANDOFF_CRED_KEY_COOKIE,
  };
}

export async function handleBrokerLocalCallback(request: Request, provider: string) {
  const parsed = parseSearchParams(new URL(request.url).searchParams, querySchema);
  if (!parsed.ok) return parsed.response;

  const cookieStore = await cookies();
  const storedHandoffId = cookieStore.get(HANDOFF_ID_COOKIE)?.value;
  const verifier = cookieStore.get(HANDOFF_VERIFIER_COOKIE)?.value;
  const credKey = cookieStore.get(HANDOFF_CRED_KEY_COOKIE)?.value;

  cookieStore.delete(HANDOFF_ID_COOKIE);
  cookieStore.delete(HANDOFF_VERIFIER_COOKIE);
  cookieStore.delete(HANDOFF_CRED_KEY_COOKIE);

  const origin = new URL(request.url).origin;
  if (!storedHandoffId || !verifier || !credKey || storedHandoffId !== parsed.data.handoffId) {
    return NextResponse.redirect(
      buildIntegrationSettingsRedirectUrl({
        origin,
        provider,
        status: "error",
        credKey,
        error: "OAuth broker session mismatch. Please try again.",
      })
    );
  }

  const brokerOrigin = getOAuthBrokerOrigin();
  const redeemRes = await fetch(`${brokerOrigin}/api/auth/broker/${provider}/redeem`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ handoffId: storedHandoffId, verifier }),
  });

  if (!redeemRes.ok) {
    return errorJson(502, "OAuth broker redeem failed");
  }

  const brokerCredential = (await redeemRes.json()) as {
    brokerUrl?: string;
    brokerCredentialToken?: string;
    authMethod?: string;
  };

  if (!brokerCredential.brokerUrl || !brokerCredential.brokerCredentialToken) {
    return errorJson(502, "OAuth broker returned an invalid credential");
  }

  await getCredentialRepo().setCredential(credKey, {
    authMethod: "oauth_broker",
    brokerUrl: brokerCredential.brokerUrl,
    brokerCredentialToken: brokerCredential.brokerCredentialToken,
  });

  return NextResponse.redirect(
    buildIntegrationSettingsRedirectUrl({
      origin,
      provider,
      status: "success",
      credKey,
    })
  );
}
