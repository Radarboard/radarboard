/**
 * Declarative factory for REST/api-key integrations.
 *
 * Most integrations are "call an endpoint with an auth header, map the JSON".
 * `createRestIntegration` turns that into a config object and generates the
 * `IntegrationDescriptor` — including each data source's `fetch` (credential
 * resolve + auth header + error handling) and a credential test — so authors
 * write ~1 config instead of ~300 lines of near-identical boilerplate.
 *
 * It is intentionally opt-in: integrations with bespoke transforms, GraphQL,
 * websockets, or webhook-only flows keep hand-writing their descriptors.
 */
import type { ComponentType } from "react";
import type {
  CommonRouteParams,
  DataSourceContext,
  DataSourceDescriptor,
  IntegrationAuthField,
  IntegrationCapability,
  IntegrationCategory,
  IntegrationDescriptor,
} from "./types";

/** How a resolved credential secret becomes an Authorization header value. */
export type RestAuthScheme = "bearer" | "token" | "basic" | "none";

/** Build the Authorization header value for a scheme + token. */
export function authHeader(scheme: RestAuthScheme, token: string): string | undefined {
  switch (scheme) {
    case "bearer":
      return `Bearer ${token}`;
    case "token":
      return `token ${token}`;
    case "basic":
      // Basic with the token as the username and an empty password (common for API keys).
      return `Basic ${Buffer.from(`${token}:`).toString("base64")}`;
    default:
      return undefined;
  }
}

/** Declarative auth config for a REST integration built with the factory. */
export interface RestAuthConfig {
  /** Auth header scheme applied with the resolved token. Default "bearer". */
  scheme?: RestAuthScheme;
  /** Credential field holding the secret. Defaults to the first field's key, else "apiKey". */
  tokenField?: string;
  /** Credential input fields shown in the connect UI. Defaults to a single masked "apiKey" field. */
  fields?: IntegrationAuthField[];
  /** Path (relative to baseUrl) hit to validate credentials. */
  testPath?: string;
  /** Docs URL for obtaining credentials. */
  docsUrl?: string;
}

/** Declarative spec for one data source (endpoint) of a REST integration. */
export interface RestDataSourceSpec<TParams = Record<string, unknown>, TData = unknown> {
  /** Action slug used in the URL path, e.g. "summary". */
  action: string;
  description: string;
  cacheTtlSeconds: number;
  /** Endpoint path (relative to baseUrl), static or derived from params. */
  path: string | ((params: TParams & CommonRouteParams) => string);
  method?: "GET" | "POST";
  /** Query params appended to the URL (undefined values dropped). */
  query?: (
    params: TParams & CommonRouteParams
  ) => Record<string, string | number | boolean | undefined>;
  /** JSON body for POST requests. */
  body?: (params: TParams & CommonRouteParams) => unknown;
  /** Parse integration-specific params from the URL search params. */
  parseParams?: (searchParams: URLSearchParams) => Partial<TParams>;
  /** Map the raw JSON response into the data shape widgets consume. Defaults to identity. */
  map?: (json: unknown, params: TParams & CommonRouteParams) => TData;
  pollingSourceId?: DataSourceDescriptor["pollingSourceId"];
}

/** Full declarative config passed to `createRestIntegration`. */
export interface RestIntegrationConfig {
  id: string;
  name: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  category: IntegrationCategory;
  /**
   * Credential storage key / provider grouping. Defaults to `id`. Set to a
   * shared value so several integrations reuse one connected credential.
   */
  provider?: string;
  /** Base URL for all data-source paths, e.g. "https://api.example.com". */
  baseUrl: string;
  auth: RestAuthConfig;
  dataSources: RestDataSourceSpec[];
  apiDocsUrl?: string;
  defaultRssFeedUrl?: string;
  capabilities?: IntegrationCapability[];
}

const DEFAULT_FIELD: IntegrationAuthField = {
  key: "apiKey",
  label: "API Key",
  type: "password",
};

function resolveTokenField(auth: RestAuthConfig): string {
  if (auth.tokenField) return auth.tokenField;
  return auth.fields?.[0]?.key ?? DEFAULT_FIELD.key;
}

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

function applyQuery(
  url: string,
  query: Record<string, string | number | boolean | undefined> | undefined
): string {
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}${url.includes("?") ? "&" : "?"}${qs}` : url;
}

/**
 * Build a credential-test function that hits `testPath` with the auth header and
 * treats a 2xx as valid. Returned in the shape the shared test route expects.
 */
export function createHttpCredentialTest(config: {
  baseUrl: string;
  testPath: string;
  scheme: RestAuthScheme;
  tokenField: string;
}): (values: Record<string, string>) => Promise<{ ok: boolean; error?: string }> {
  return async (values) => {
    const token = values[config.tokenField];
    if (!token) return { ok: false, error: `Missing ${config.tokenField}` };
    const header = authHeader(config.scheme, token);
    const headers = new Headers();
    if (header) headers.set("Authorization", header);
    try {
      const res = await fetch(joinUrl(config.baseUrl, config.testPath), { headers });
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Request failed" };
    }
  };
}

/** Turn a declarative REST spec into a full IntegrationDescriptor. */
export function createRestIntegration(config: RestIntegrationConfig): IntegrationDescriptor {
  const provider = config.provider ?? config.id;
  const scheme = config.auth.scheme ?? "bearer";
  const tokenField = resolveTokenField(config.auth);
  // "none" is for public/no-auth APIs — no credential is required or requested.
  const noAuth = scheme === "none";
  const fields = config.auth.fields ?? (noAuth ? [] : [DEFAULT_FIELD]);

  const dataSources: DataSourceDescriptor[] = config.dataSources.map((spec) => ({
    action: spec.action,
    description: spec.description,
    cacheTtlSeconds: spec.cacheTtlSeconds,
    pollingSourceId: spec.pollingSourceId,
    parseParams: spec.parseParams,
    fetch: async (params: Record<string, unknown> & CommonRouteParams, ctx: DataSourceContext) => {
      let header: string | undefined;
      if (!noAuth) {
        const creds = await ctx.resolveCredential(provider);
        if (!creds) throw new Error(`Missing ${config.name} credentials`);
        const token = creds[tokenField];
        if (!token) throw new Error(`Missing ${config.name} ${tokenField}`);
        header = authHeader(scheme, token);
      }

      const path = typeof spec.path === "function" ? spec.path(params) : spec.path;
      const url = applyQuery(joinUrl(config.baseUrl, path), spec.query?.(params));
      const method = spec.method ?? "GET";

      const headers = new Headers();
      if (header) headers.set("Authorization", header);
      if (spec.body) headers.set("Content-Type", "application/json");

      const res = await fetch(url, {
        method,
        headers,
        body: spec.body ? JSON.stringify(spec.body(params)) : undefined,
      });
      if (!res.ok) {
        throw new Error(`${config.name} ${spec.action} failed: HTTP ${res.status}`);
      }
      const json = (await res.json()) as unknown;
      return spec.map ? spec.map(json, params) : json;
    },
  }));

  return {
    id: config.id,
    name: config.name,
    description: config.description,
    icon: config.icon,
    category: config.category,
    apiDocsUrl: config.apiDocsUrl,
    defaultRssFeedUrl: config.defaultRssFeedUrl,
    capabilities: config.capabilities,
    auth: {
      id: provider,
      provider,
      name: config.name,
      type: noAuth ? "none" : "api_key",
      fields,
      testEndpoint: noAuth || !config.auth.testPath ? undefined : "/api/credentials/test",
      credentialTest:
        noAuth || !config.auth.testPath
          ? undefined
          : createHttpCredentialTest({
              baseUrl: config.baseUrl,
              testPath: config.auth.testPath,
              scheme,
              tokenField,
            }),
      docsUrl: config.auth.docsUrl,
    },
    dataSources,
  };
}
