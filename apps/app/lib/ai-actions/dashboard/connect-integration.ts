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
  /** Skip the post-create dry-run fetch (only runs for no-auth integrations). */
  verifyEndpoint?: boolean;
}

export interface CreateIntegrationResult {
  created: boolean;
  id: string;
  updated?: boolean;
  dataSourceActions?: string[];
  /** For no-auth integrations: whether the dry-run fetch of the first action succeeded. */
  verified?: boolean;
  /**
   * Dot-paths of the fields in the sample response (e.g. "stats.users",
   * "items.0.name"). Use these directly as the `field` values in show_rest_data
   * so mappings are accurate instead of guessed.
   */
  sampleFields?: string[];
  /** Why the dry-run failed, if it did (non-blocking — the integration is still created). */
  verifyError?: string;
  error?: string;
}

/** Walk a JSON response and collect dot-paths to leaf values (bounded). */
function collectFieldPaths(value: unknown, prefix = "", out: string[] = [], depth = 0): string[] {
  if (out.length >= 40 || depth > 3) return out;
  if (Array.isArray(value)) {
    if (prefix) out.push(prefix);
    if (value.length > 0) collectFieldPaths(value[0], `${prefix}.0`, out, depth + 1);
    return out;
  }
  if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (nested !== null && typeof nested === "object") {
        collectFieldPaths(nested, path, out, depth + 1);
      } else {
        out.push(path);
      }
      if (out.length >= 40) break;
    }
    return out;
  }
  if (prefix) out.push(prefix);
  return out;
}

/**
 * For a no-auth integration, fetch the first data source once so we can confirm
 * it works and hand back the real response's field paths (for accurate mapping).
 * Non-blocking: any failure is reported but the integration stays created.
 */
async function dryRunNoAuthIntegration(
  integrationId: string,
  action: string
): Promise<{ verified: boolean; sampleFields?: string[]; verifyError?: string }> {
  try {
    const { findDataSource } = await import("@radarboard/integration-sdk/registry");
    const { buildDataSourceContext } = await import("@/lib/assistant/core/data-source-context");
    const source = findDataSource(integrationId, action);
    if (!source) return { verified: false, verifyError: `No data source "${action}".` };
    const data = await source.fetch(
      { projectSlug: null, range: "30d", timeZone: "UTC", forceRefresh: false },
      buildDataSourceContext()
    );
    return { verified: true, sampleFields: collectFieldPaths(data).slice(0, 40) };
  } catch (error) {
    return {
      verified: false,
      verifyError: error instanceof Error ? error.message : "Fetch failed",
    };
  }
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

  const base: CreateIntegrationResult = {
    created: true,
    id: result.id,
    updated: result.updated,
    dataSourceActions: result.dataSourceActions,
  };

  // Only public (no-auth) integrations can be dry-run here — authed ones have no
  // credential yet, so leave `verified` undefined for them.
  const isNoAuth = (params.auth?.scheme ?? undefined) === "none";
  const firstAction = params.dataSources[0]?.action;
  if (isNoAuth && params.verifyEndpoint !== false && firstAction) {
    return { ...base, ...(await dryRunNoAuthIntegration(result.id, firstAction)) };
  }
  return base;
}

// ---------------------------------------------------------------------------
// List / remove user-defined REST integrations
// ---------------------------------------------------------------------------

export interface UserIntegrationSummary {
  id: string;
  name: string;
  category: string;
  baseUrl: string;
  dataSourceActions: string[];
}

/** List the user-created REST integrations (id, name, and exposed actions). */
export async function executeListUserIntegrations(): Promise<{
  integrations: UserIntegrationSummary[];
}> {
  const { loadUserIntegrationConfigs } = await import(
    "@/lib/integrations/user-integrations-registry"
  );
  const configs = await loadUserIntegrationConfigs();
  const integrations = configs
    .filter((config): config is UserRestIntegrationConfig => Boolean(config?.id))
    .map((config) => ({
      id: config.id,
      name: config.name,
      category: config.category,
      baseUrl: config.baseUrl,
      dataSourceActions: (config.dataSources ?? []).map((ds) => ds.action),
    }));
  return { integrations };
}

export interface RemoveIntegrationResult {
  removed: boolean;
  id: string;
  /** True when no user integration with that id existed (nothing to remove). */
  notFound?: boolean;
  error?: string;
}

/**
 * Delete a user-created REST integration and its dedicated widget. Built-in
 * integrations cannot be removed this way (only ids in the user store match).
 */
export async function executeRemoveIntegration(params: {
  id: string;
}): Promise<RemoveIntegrationResult> {
  const { removeUserIntegration } = await import("@/lib/integrations/user-integrations-registry");
  const result = await removeUserIntegration(params.id);
  if (!result.ok) {
    return { removed: false, id: result.id, error: result.error };
  }
  return { removed: Boolean(result.removed), id: result.id, notFound: result.removed === false };
}
