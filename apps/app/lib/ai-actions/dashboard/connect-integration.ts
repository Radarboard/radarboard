/**
 * Assistant action: connect an api-key integration — validate required fields,
 * run the integration's credential test, then persist the credential under its
 * provider key (so all integrations sharing that provider light up).
 *
 * OAuth integrations are intentionally deferred to the Settings UI: a tool can't
 * complete a browser redirect.
 */
import { getIntegration } from "@radarboard/integration-sdk/registry";

export interface ConnectIntegrationParams {
  integrationId: string;
  values: Record<string, string>;
}

export interface ConnectIntegrationResult {
  connected: boolean;
  integrationId: string;
  /** Credential key the secret was stored under (provider ?? id). */
  provider?: string;
  /** Whether the integration's credential test actually ran. */
  tested?: boolean;
  error?: string;
}

export async function executeConnectIntegration(
  params: ConnectIntegrationParams
): Promise<ConnectIntegrationResult> {
  const descriptor = getIntegration(params.integrationId);
  if (!descriptor) {
    return {
      connected: false,
      integrationId: params.integrationId,
      error: `Unknown integration "${params.integrationId}".`,
    };
  }

  const { auth } = descriptor;

  if (auth.type === "oauth") {
    return {
      connected: false,
      integrationId: params.integrationId,
      error: `"${descriptor.name}" uses OAuth — connect it from Settings → Integrations (an assistant tool can't complete the redirect).`,
    };
  }

  const key = auth.provider ?? auth.id;

  if (auth.type === "none") {
    return { connected: true, integrationId: params.integrationId, provider: key, tested: false };
  }

  // api_key: require all non-optional fields.
  const missing = (auth.fields ?? [])
    .filter((f) => !f.optional)
    .map((f) => f.key)
    .filter((k) => !params.values[k]?.trim());
  if (missing.length > 0) {
    return {
      connected: false,
      integrationId: params.integrationId,
      error: `Missing required field(s): ${missing.join(", ")}.`,
    };
  }

  let tested = false;
  if (auth.credentialTest) {
    const result = await auth.credentialTest(params.values);
    tested = true;
    if (!result.ok) {
      return {
        connected: false,
        integrationId: params.integrationId,
        tested,
        error: result.error ?? "Credential test failed.",
      };
    }
  }

  const { getCredentialRepo } = await import("@/data/core/repository");
  await getCredentialRepo().setCredential(key, params.values);
  return { connected: true, integrationId: params.integrationId, provider: key, tested };
}
