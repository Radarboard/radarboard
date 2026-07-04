/**
 * Assistant actions for the integration lifecycle:
 * - `executeConnectIntegration` — validate + test + persist api-key credentials.
 * - `executeCreateIntegration` — create a no-code REST integration (validate +
 *   persist + live-register).
 *
 * OAuth integrations are intentionally deferred to the Settings UI: a tool can't
 * complete a browser redirect.
 */
import { getIntegration } from "@radarboard/integration-sdk/registry";
import type {
  UserRestDataSourceConfig,
  UserRestIntegrationConfig,
} from "@/lib/integrations/user-rest-integration";

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

// ---------------------------------------------------------------------------
// Create a no-code REST integration
// ---------------------------------------------------------------------------

export interface CreateIntegrationParams {
  id: string;
  name: string;
  description: string;
  category: UserRestIntegrationConfig["category"];
  baseUrl: string;
  icon?: string;
  provider?: string;
  apiDocsUrl?: string;
  auth?: {
    scheme?: UserRestIntegrationConfig["auth"]["scheme"];
    tokenField?: string;
    fields?: UserRestIntegrationConfig["auth"]["fields"];
    testPath?: string;
    docsUrl?: string;
  };
  dataSources: UserRestDataSourceConfig[];
}

export interface CreateIntegrationResult {
  created: boolean;
  id: string;
  updated?: boolean;
  dataSourceActions?: string[];
  error?: string;
}

/**
 * Validate, persist, and live-register a user-defined REST integration so its
 * data sources are usable immediately (no restart).
 */
export async function executeCreateIntegration(
  params: CreateIntegrationParams
): Promise<CreateIntegrationResult> {
  const config: UserRestIntegrationConfig = {
    id: params.id,
    name: params.name,
    description: params.description,
    category: params.category,
    baseUrl: params.baseUrl,
    icon: params.icon,
    provider: params.provider,
    apiDocsUrl: params.apiDocsUrl,
    auth: params.auth ?? {},
    dataSources: params.dataSources,
  };

  const { saveUserIntegration } = await import("@/lib/integrations/user-integrations-registry");
  const result = await saveUserIntegration(config);

  if (!result.ok) {
    return { created: false, id: result.id, error: result.error };
  }
  return {
    created: true,
    id: result.id,
    updated: result.updated,
    dataSourceActions: result.dataSourceActions,
  };
}
