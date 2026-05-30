import type { GitHubStarHistoryRepository } from "@radarboard/types/database";
import type { ExtensionMeta, IntegrationCapability } from "@radarboard/types/extension";
import type { McpTransportType } from "@radarboard/types/mcp-server";
import type { PollingSourceId } from "@radarboard/types/polling";
import type { ComponentType } from "react";
import type { z } from "zod";

/** Time range for dashboard queries. Duplicated to avoid circular dep on @radarboard/types. */
export type TimeRange = "today" | "7d" | "15d" | "30d" | "3m" | "1y" | "all";

/** Integration category for grouping in the settings UI. */
export type IntegrationCategory =
  | "revenue"
  | "deployment"
  | "analytics"
  | "monitoring"
  | "communication";

/** OAuth-specific config for providers that need the redirect flow. */
export interface IntegrationOAuthConfig {
  /** Provider key used in route paths (e.g., "github", "google"). */
  provider: string;
  /** Scopes to request during authorization. */
  scopes: string[];
  /** Instructions for creating the OAuth app, shown above client credential fields. Use {origin} as placeholder. */
  setupInstructions?: string;
  /**
   * Whether to normalize *.localhost subdomains to plain localhost when building the callback URL
   * shown in setup instructions. Set true for Google (rejects custom subdomains), false/omit for
   * GitHub (accepts *.localhost as-is).
   */
  normalizeOrigin?: boolean;
}

/** A single credential input field in the integration's Connection section. */
export interface IntegrationAuthField {
  /** Storage key within the credential record (e.g., "authToken"). */
  key: string;
  /** Display label (e.g., "Auth Token"). */
  label: string;
  /** Whether the field is optional in the generic save/test UI. */
  optional?: boolean;
  /** "password" = masked, "text" = visible, "textarea" = multi-line, "file" = file upload. */
  type: "text" | "password" | "textarea" | "file";
  /** Placeholder text. */
  placeholder?: string;
  /** Help text below the input. */
  helpText?: string;
  /** Accepted file extensions for type "file" (e.g., ".p8,.pem"). */
  accept?: string;
}

/** How an integration authenticates with its external API. */
export interface IntegrationAuth {
  /** Unique service identifier used as credential storage key. */
  id: string;
  /** Display name for this service (e.g., "Vercel", "Linear"). */
  name: string;
  /** Auth method: "api_key" = manual token entry, "oauth" = OAuth redirect flow, "none" = no auth. */
  type: "api_key" | "oauth" | "none";
  /** For api_key and oauth: fields to show in the credential input UI (client ID/secret for OAuth). */
  fields?: IntegrationAuthField[];
  /** API route path to test credentials (POST with { key, values }). */
  testEndpoint?: string;
  /** URL to the service's docs for obtaining credentials. */
  docsUrl?: string;
  /** OAuth-specific config. Required when type === "oauth". */
  oauth?: IntegrationOAuthConfig;
}

/** Maps a saved integration credential field to an MCP server auth mechanism. */
export interface IntegrationMcpCredentialBinding {
  /** Saved integration credential field to reuse, e.g. "accessToken". */
  sourceField: string;
  /** MCP target field that receives the resolved value. */
  target: { type: "authHeader" } | { type: "env"; key: string };
  /** Optional template applied after resolution. Use "{{value}}" as the placeholder. */
  template?: string;
}

/** Base type for MCP transport presets. */
export interface IntegrationMcpTransportPresetBase {
  type: McpTransportType;
}

/** MCP transport preset for Streamable HTTP servers. */
export interface IntegrationMcpHttpTransportPreset extends IntegrationMcpTransportPresetBase {
  type: "streamable-http";
  url: string;
}

/** MCP transport preset for stdio-based servers (local process). */
export interface IntegrationMcpStdioTransportPreset extends IntegrationMcpTransportPresetBase {
  type: "stdio";
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
}

/** Union of supported MCP transport presets. */
export type IntegrationMcpTransportPreset =
  | IntegrationMcpHttpTransportPreset
  | IntegrationMcpStdioTransportPreset;

/** Configuration for connecting an integration to an MCP server. */
export interface IntegrationMcpConnectionConfig {
  /** Canonical MCP server name stored as `mcp::<serverName>`. */
  serverName: string;
  /** Optional alternate stored names that should also map back to this integration. */
  aliases?: string[];
  /** URL to server docs or homepage for assistant access setup. */
  docsUrl?: string;
  /** Default server transport and non-secret fields. */
  transport: IntegrationMcpTransportPreset;
  /** Saved credential bindings applied to auth headers or env vars at runtime. */
  credentialBindings?: IntegrationMcpCredentialBinding[];
}

/** MCP tool definition for an integration. */
export interface IntegrationMcpToolRoute {
  /** Route action under `/api/integrations/<integration>/<action>`. */
  action: string;
  /** Optional route integration override for virtual or delegated integrations. */
  integrationId?: string;
  /** Optional query-string builder for validated tool arguments. */
  buildParams?: (params: Record<string, unknown>) => Record<string, string> | undefined;
}

/** MCP tool definition for an integration. */
export interface IntegrationMcpTool {
  /** Public MCP tool name. Integrations own their tool naming. */
  name: string;
  /** Description shown to LLMs — must be clear and actionable. */
  description: string;
  /** Zod schema for validated input parameters. */
  parameters: z.ZodType;
  /** Route-backed execution metadata for the app MCP server. */
  route?: IntegrationMcpToolRoute;
  /** Optional custom executor for non-route-backed integration tools. */
  execute?: (params: unknown) => Promise<unknown>;
}

// ---------------------------------------------------------------------------
// Notification contracts — implemented per-integration in webhook.ts / delta.ts
// ---------------------------------------------------------------------------

/**
 * A notification event produced by a webhook or delta detector.
 * Matches EmitNotificationInput from @radarboard/types/notifications without the
 * circular dependency.
 */
export interface IntegrationEvent {
  source: string;
  sourceEventId?: string | null;
  type: string;
  severity: "critical" | "warning" | "info" | "success";
  projectSlug?: string | null;
  title: string;
  body?: string | null;
  /**
   * Arbitrary JSON. For in-app notification deep links, include an `http(s)` URL under
   * `url`, `permalink`, `html_url`, or any nested key whose name contains `url` / `link` /
   * `href` / `permalink`. Plain URLs in `body` or `title` are also detected.
   */
  metadata?: Record<string, unknown>;
  occurredAt?: number;
}

/**
 * Inbound webhook handler — lives in each integration's webhook.ts.
 * The web app's generic `/api/webhooks/[integration]` route delegates to this.
 */
export interface WebhookHandler {
  /** Verify the request signature. Return false to reject with 401. */
  verifySignature(request: Request, secret: string): Promise<boolean>;
  /** Parse the raw payload into zero or more notification events. */
  parsePayload(request: Request): Promise<IntegrationEvent[]>;
}

/**
 * Delta detector — lives in each integration's delta.ts.
 * Called from API route handlers after fresh data is fetched.
 * Returns events for items that are new or changed since last call.
 */
export interface DeltaDetector<TData> {
  detect(current: TData, projectSlug?: string | null): IntegrationEvent[];
}

// ---------------------------------------------------------------------------
// Data-source contracts — implemented per-integration in data-sources.ts
// ---------------------------------------------------------------------------

/**
 * Standard query params every integration data route receives.
 *
 * @example
 * ```ts
 * // At runtime, params look like:
 * const params: CommonRouteParams = {
 *   projectSlug: "my-saas",
 *   range: "30d",
 *   timeZone: "America/New_York",
 *   forceRefresh: false,
 * };
 * ```
 */
export interface CommonRouteParams {
  projectSlug: string | null;
  range: TimeRange;
  timeZone: string;
  forceRefresh: boolean;
}

/**
 * App-level services injected into data-source fetch functions.
 * Avoids circular deps between packages/integrations and apps/app.
 */
export interface DataSourceContext {
  /**
   * Resolve stored credentials by service key.
   * Returns a flat record of credential fields (e.g. `{ authToken: "sk-..." }`), or `null`
   * if no credential is saved for the given key.
   */
  resolveCredential: (key: string) => Promise<Record<string, string> | null>;
  /**
   * Returns all project integration configs, keyed by `projectSlug -> integrationId -> configKey -> value`.
   *
   * @example
   * ```ts
   * const integrations = await ctx.getProjectIntegrations();
   * // { "my-saas": { "vercel": { "projectId": "prj_abc" } } }
   * ```
   */
  getProjectIntegrations: () => Promise<Record<string, Record<string, Record<string, unknown>>>>;
  getAllProjects: () => Promise<
    Array<{
      slug: string;
      name: string;
      color: string;
      platforms: Array<{
        id: string;
        name: string;
        integrations: Record<string, unknown>;
      }>;
      [k: string]: unknown;
    }>
  >;
  getMcpClient?: (
    url: string,
    authHeader?: string
  ) => { callToolJson: <T>(tool: string, args: Record<string, unknown>) => Promise<T> };
  listMcpToolsByName?: (
    name: string
  ) => Promise<Array<{ name: string; inputSchema?: Record<string, unknown> | null }>>;
  callMcpToolJsonByName?: <T>(
    name: string,
    tool: string,
    args: Record<string, unknown>
  ) => Promise<T>;
  getGitHubStarHistoryRepo?: () => GitHubStarHistoryRepository;
}

/** Declares a fetchable endpoint for an integration. */
export interface DataSourceDescriptor<TParams = Record<string, unknown>, TData = unknown> {
  /** Action slug used in the URL path, e.g. "data", "projects", "open-issues". */
  action: string;
  /** Human-readable description of this data source. */
  description: string;
  /** Cache TTL in seconds for withCache. */
  cacheTtlSeconds: number;
  /** Optional shared polling family used to resolve configurable TTLs. */
  pollingSourceId?: PollingSourceId;
  /** Optional prefix for in-memory cache eviction on force refresh. */
  evictPrefixes?: string[];
  /** Build the cache key from params. Defaults to `<integration>:<action>:<projectSlug>:<range>:<timeZone>`. */
  buildCacheKey?: (params: TParams & CommonRouteParams) => string;
  /** Parse integration-specific params from the URL search params. */
  parseParams?: (searchParams: URLSearchParams) => Partial<TParams>;
  /**
   * Fetch the data. Receives merged common + integration-specific params plus injected context.
   *
   * @example
   * ```ts
   * fetch: async (params, ctx) => {
   *   const creds = await ctx.resolveCredential("vercel");
   *   if (!creds) throw new Error("Missing Vercel credentials");
   *   const res = await fetch(`https://api.vercel.com/v6/deployments?projectId=${params.projectId}&limit=20`, {
   *     headers: { Authorization: `Bearer ${creds.authToken}` },
   *   });
   *   return res.json();
   * },
   * ```
   */
  fetch: (params: TParams & CommonRouteParams, ctx: DataSourceContext) => Promise<TData>;
  /** Optional delta detection on fresh data. */
  delta?: {
    extractData: (data: TData) => unknown;
    detector: DeltaDetector<TData>;
    shouldDetect?: (data: TData) => boolean;
  };
}

/**
 * Describes an integration in the registry.
 *
 * @example
 * ```ts
 * import { GitHubIcon } from "./icon";
 *
 * const descriptor: IntegrationDescriptor = {
 *   id: "github",
 *   name: "GitHub",
 *   description: "Repositories, pull requests, and CI status",
 *   icon: GitHubIcon,
 *   category: "deployment",
 *   auth: { id: "github", name: "GitHub", type: "oauth", oauth: { provider: "github", scopes: ["repo"] } },
 *   dataSources: [openIssuesSource, pullRequestsSource],
 * };
 * ```
 */
export interface IntegrationDescriptor extends ExtensionMeta {
  /** Unique identifier (kebab-case). Should match the key in PlatformIntegrations where applicable. */
  id: string;
  /** Display name (e.g., "GitHub", "Vercel"). */
  name: string;
  /** Short description of what this integration provides. */
  description: string;
  /** Icon component for the settings UI. */
  icon: ComponentType<{ className?: string }>;
  /** Category for grouping in the settings panel. */
  category: IntegrationCategory;
  /** Auth configuration for this integration's API. */
  auth: IntegrationAuth;
  /** Optional MCP connection metadata for integrations that can use either API or MCP. */
  mcp?: IntegrationMcpConnectionConfig;
  /** Suggested public provider status page URL. Can be overridden in settings. */
  defaultStatusPageUrl?: string;
  /** Suggested public RSS/Atom feed URL. Users may override this in settings. */
  defaultRssFeedUrl?: string;
  /** URL to the upstream API reference documentation. */
  apiDocsUrl?: string;
  /** MCP tools provided by this integration. */
  mcpTools?: IntegrationMcpTool[];
  /** Capability actions exposed by this integration for canonical widget ownership and audits. */
  capabilities?: IntegrationCapability[];
  /** Data sources exposed by this integration for the unified /api/integrations/[id]/[action] route. */
  dataSources?: DataSourceDescriptor<Record<string, unknown>, unknown>[];
  /** Inbound webhook handler for this integration (signature verification + payload parsing). */
  webhookHandler?: WebhookHandler;
  /**
   * Optional guided setup flow for this integration.
   *
   * Config Flow defines a sequence of steps that walk the user through
   * configuring this integration — similar to Home Assistant's config_flow.
   * Each step can collect input, validate credentials, or confirm settings.
   *
   * When present, the settings UI renders a step-by-step wizard instead of
   * the default auth form.
   *
   * @example
   * ```ts
   * configFlow: {
   *   steps: [
   *     {
   *       id: "credentials",
   *       title: "Enter API credentials",
   *       description: "You can find your API key at https://example.com/settings",
   *       fields: [{ key: "apiKey", label: "API Key", type: "password" }],
   *     },
   *     {
   *       id: "select-org",
   *       title: "Select organization",
   *       description: "Choose which organization to connect",
   *       dependsOn: "credentials",
   *     },
   *   ],
   * }
   * ```
   */
  configFlow?: IntegrationConfigFlow;
}

// ---------------------------------------------------------------------------
// Config Flow — guided setup wizard
// ---------------------------------------------------------------------------

/**
 * A single step in the integration config flow.
 *
 * Steps are rendered sequentially. A step can collect form input,
 * run a validation function, or present a confirmation screen.
 */
export interface ConfigFlowStep {
  /** Unique step identifier. */
  id: string;
  /** Step title shown in the wizard header. */
  title: string;
  /** Optional description or instructions shown below the title. */
  description?: string;
  /** Form fields to collect in this step. Omit for confirmation-only steps. */
  fields?: IntegrationAuthField[];
  /** Step ID that must complete before this step is available. */
  dependsOn?: string;
  /**
   * Optional async validation function run after the user submits this step.
   * Return `{ valid: true }` to proceed or `{ valid: false, error }` to show an error.
   */
  validate?: (values: Record<string, string>) => Promise<{ valid: boolean; error?: string }>;
}

/** Guided setup flow for an integration. */
export interface IntegrationConfigFlow {
  /** Ordered list of setup steps. */
  steps: ConfigFlowStep[];
}

export type { IntegrationCapability } from "@radarboard/types/extension";
