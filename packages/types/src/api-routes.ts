/**
 * Centralized API route paths for Radarboard.
 *
 * Keep all app-shell routes and the shared integration/plugin route builders
 * here so callers do not reintroduce stringly-typed `/api/...` paths across
 * the workspace.
 */

declare const apiRouteBrand: unique symbol;
declare const apiRoutePatternBrand: unique symbol;

type BrandedApiRoute<T extends string> = T & {
  readonly [apiRouteBrand]: "ApiRoute";
};

type BrandedApiRoutePattern<T extends string> = T & {
  readonly [apiRoutePatternBrand]: "ApiRoutePattern";
};

export type QueryValue = string | number | boolean | null | undefined;
export type IntegrationActionRoute<
  TIntegration extends string = string,
  TAction extends string = string,
> = `/api/integrations/${TIntegration}/${TAction}`;
export type PluginActionRoute<
  TPlugin extends string = string,
  TAction extends string = string,
> = `/api/plugins/${TPlugin}/${TAction}`;

function defineApiRoute<const T extends `/api/${string}`>(path: T): BrandedApiRoute<T> {
  return path as BrandedApiRoute<T>;
}

function defineApiRoutePattern<const T extends `/api/${string}`>(
  path: T
): BrandedApiRoutePattern<T> {
  return path as BrandedApiRoutePattern<T>;
}

function encodePathSegment(value: string): string {
  return encodeURIComponent(value);
}

function encodePluginDataKey(value: string): string {
  return encodeURIComponent(value).replaceAll("%3A", ":");
}

function withQuery(baseRoute: string, params: Record<string, QueryValue>): string {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") continue;
    searchParams.set(key, String(value));
  }

  const query = searchParams.toString();
  return query.length > 0 ? `${baseRoute}?${query}` : baseRoute;
}

export function buildApiRoute(baseRoute: string, params: Record<string, QueryValue>): string {
  return withQuery(baseRoute, params);
}

export const API_ROUTES = {
  settings: defineApiRoute("/api/system/settings"),
  integrationConnections: defineApiRoute("/api/system/integration-connections"),

  chat: defineApiRoute("/api/assistant/chat"),
  chatProjects: defineApiRoute("/api/assistant/chat/projects"),
  chatSkills: defineApiRoute("/api/assistant/chat/skills"),
  chatSkillsImport: defineApiRoute("/api/assistant/chat/skills/import"),
  chatPresets: defineApiRoute("/api/assistant/chat/presets"),
  chatModels: defineApiRoute("/api/assistant/chat/models"),
  chatArtifacts: defineApiRoute("/api/assistant/chat/artifacts"),
  chatConversations: defineApiRoute("/api/assistant/chat/conversations"),
  chatConversationSearch: defineApiRoute("/api/assistant/chat/conversations/search"),
  chatMemory: defineApiRoute("/api/assistant/chat/memory"),
  chatFeedback: defineApiRoute("/api/assistant/chat/feedback"),

  knowledgeHealthSummary: defineApiRoute("/api/assistant/knowledge-health/summary"),
  knowledgeHealthItems: defineApiRoute("/api/assistant/knowledge-health/items"),
  knowledgeHealthItemBase: defineApiRoute("/api/assistant/knowledge-health/items"),
  knowledgeHealthProjectsBase: defineApiRoute("/api/assistant/knowledge-health/projects"),

  credentials: defineApiRoute("/api/system/credentials"),
  credentialsTest: defineApiRoute("/api/system/credentials/test"),

  mcpServers: defineApiRoute("/api/mcp/servers"),
  mcpServersTest: defineApiRoute("/api/mcp/servers/test"),

  analyticsData: defineApiRoute("/api/analytics/data"),
  databaseConfigLegacy: defineApiRoute("/api/database/config"),
  databaseConfig: defineApiRoute("/api/system/database/config"),
  databaseTest: defineApiRoute("/api/system/database/test"),
  databaseMigrate: defineApiRoute("/api/system/database/migrate"),
  databaseExport: defineApiRoute("/api/system/database/export"),
  databaseImport: defineApiRoute("/api/system/database/import"),

  backup: defineApiRoute("/api/system/backup"),
  backupExport: defineApiRoute("/api/system/backup/export"),
  backupManifest: defineApiRoute("/api/system/backup/manifest"),

  configExport: defineApiRoute("/api/system/config/export"),
  configImport: defineApiRoute("/api/system/config/import"),

  alertsSend: defineApiRoute("/api/notifications/send"),
  workflows: defineApiRoute("/api/assistant/workflows"),
  briefing: defineApiRoute("/api/assistant/briefing"),
  embeddings: defineApiRoute("/api/assistant/embeddings"),

  debugReports: defineApiRoute("/api/dev/debug/reports"),
  debugSpans: defineApiRoute("/api/dev/debug/spans"),
  debugCache: defineApiRoute("/api/dev/debug/cache"),
  debugMemories: defineApiRoute("/api/dev/debug/memories"),
  debugTraces: defineApiRoute("/api/dev/debug/traces"),
  debugWebhookRelay: defineApiRoute("/api/dev/debug/webhook-relay"),
  debugEvents: defineApiRoute("/api/dev/debug/events"),
  debugEventsTimeline: defineApiRoute("/api/dev/debug/events/timeline"),

  notifications: defineApiRoute("/api/notifications"),
  notificationsStream: defineApiRoute("/api/notifications/stream"),
  notificationEmit: defineApiRoute("/api/notifications/emit"),
  notificationPreferences: defineApiRoute("/api/notifications/preferences"),
  notificationSounds: defineApiRoute("/api/notifications/sounds"),
  notificationWebhooks: defineApiRoute("/api/notifications/webhooks"),
  notificationWebhooksTest: defineApiRoute("/api/notifications/webhooks/test"),
  notificationRules: defineApiRoute("/api/notifications/rules"),

  pluginData: defineApiRoute("/api/plugins/data"),
  pluginDataList: defineApiRoute("/api/plugins/data/list"),
  pluginToken: defineApiRoute("/api/plugins/token"),

  githubRepos: defineApiRoute("/api/integrations/github/repos"),
  githubContents: defineApiRoute("/api/integrations/github/contents"),
  githubStarTracking: defineApiRoute("/api/integrations/github/star-tracking"),

  statusPageProjectHealth: defineApiRoute("/api/plugins/status-page/project-health"),
  relayPoll: defineApiRoute("/api/plugins/webhook-relay/poll"),
  eventsStream: defineApiRoute("/api/dev/events/stream"),
  healthIntegrations: defineApiRoute("/api/dev/health/integrations"),
  demoSeed: defineApiRoute("/api/dev/demo/seed"),
  demoWipe: defineApiRoute("/api/dev/demo/wipe"),
  license: defineApiRoute("/api/system/license"),
  authGwsImport: defineApiRoute("/api/auth/import/gws"),
  providerAuthMethods: defineApiRoute("/api/auth/providers/methods"),
  extensionsUsage: defineApiRoute("/api/extensions/usage"),
  extensionsInstall: defineApiRoute("/api/extensions/install"),

  logs: defineApiRoute("/api/dev/logs"),
  logsStream: defineApiRoute("/api/dev/logs/stream"),

  // Auth
  authIntegrationsOAuth: defineApiRoute("/api/auth/integrations/oauth"),
  authMcpAuthorize: defineApiRoute("/api/auth/mcp/authorize"),
  authMcpRegister: defineApiRoute("/api/auth/mcp/register"),
  authMcpToken: defineApiRoute("/api/auth/mcp/token"),
  authOpenAiAuthorize: defineApiRoute("/api/auth/providers/openai/oauth/authorize"),
  authOpenAiCallback: defineApiRoute("/api/auth/providers/openai/oauth/callback"),

  // Credentials
  credentials1password: defineApiRoute("/api/system/credentials/1password"),

  // MCP
  mcp: defineApiRoute("/api/mcp"),

  // System
  billingPortal: defineApiRoute("/api/system/billing/portal"),
  licenseAdmin: defineApiRoute("/api/system/license/admin"),

  // Extensions
  extensionsHealthScore: defineApiRoute("/api/extensions/health-score"),
  extensionsCatalog: defineApiRoute("/api/extensions/catalog"),
  extensionsUpdates: defineApiRoute("/api/extensions/updates"),
  extensionsValidate: defineApiRoute("/api/extensions/validate"),
  extensionsRecommendations: defineApiRoute("/api/extensions/recommendations"),
  extensionsDependencyGraph: defineApiRoute("/api/extensions/dependency-graph"),

  // Dev
  e2eState: defineApiRoute("/api/dev/e2e/state"),

  // Auth
  authIntegrationsOAuthCallback: defineApiRoute("/api/auth/integrations/oauth/callback"),

  // Integrations
  lemonsqueezyWebhook: defineApiRoute("/api/integrations/lemonsqueezy/webhook"),
} as const;

export const API_ROUTE_PATTERNS = {
  integrationAction: defineApiRoutePattern("/api/integrations/:integration/:action"),
  integrationWebhook: defineApiRoutePattern("/api/integrations/:integration/webhook"),
  pluginAction: defineApiRoutePattern("/api/plugins/:plugin/:action"),
  authProviderCallback: defineApiRoutePattern("/api/auth/:provider/callback"),
  authProviderRedirect: defineApiRoutePattern("/api/auth/:provider/redirect"),
  authProviderOAuthRevoke: defineApiRoutePattern("/api/auth/providers/:provider/oauth/revoke"),
  chatArtifactDetail: defineApiRoutePattern("/api/assistant/chat/artifacts/:id"),
  chatConversationDetail: defineApiRoutePattern("/api/assistant/chat/conversations/:id"),
  chatConversationExtract: defineApiRoutePattern("/api/assistant/chat/conversations/:id/extract"),
  knowledgeHealthItem: defineApiRoutePattern("/api/assistant/knowledge-health/items/:id"),
  knowledgeHealthProject: defineApiRoutePattern("/api/assistant/knowledge-health/projects/:slug"),
  devReport: defineApiRoutePattern("/api/dev/reports/:id"),
} as const;

export function integrationRoute<const TIntegration extends string, const TAction extends string>(
  integration: TIntegration,
  action: TAction
): IntegrationActionRoute<TIntegration, TAction> {
  return `/api/integrations/${encodePathSegment(integration)}/${encodePathSegment(action)}` as IntegrationActionRoute<
    TIntegration,
    TAction
  >;
}

export function pluginRoute<const TPlugin extends string, const TAction extends string>(
  plugin: TPlugin,
  action: TAction
): PluginActionRoute<TPlugin, TAction> {
  return `/api/plugins/${encodePathSegment(plugin)}/${encodePathSegment(action)}` as PluginActionRoute<
    TPlugin,
    TAction
  >;
}

export function pluginDataRoute(pluginId: string, key: string): string {
  return `${API_ROUTES.pluginData}?pluginId=${encodeURIComponent(pluginId)}&key=${encodePluginDataKey(key)}`;
}

export function pluginDataListRoute(pluginId: string, prefix?: string): string {
  if (!prefix) {
    return `${API_ROUTES.pluginDataList}?pluginId=${encodeURIComponent(pluginId)}`;
  }

  return `${API_ROUTES.pluginDataList}?pluginId=${encodeURIComponent(pluginId)}&prefix=${encodePluginDataKey(prefix)}`;
}

export function chatConversationRoute(conversationId: string): string {
  return `${API_ROUTES.chatConversations}/${encodePathSegment(conversationId)}`;
}

export function chatConversationExtractRoute(conversationId: string): string {
  return `${chatConversationRoute(conversationId)}/extract`;
}

export function knowledgeHealthItemRoute(itemId: string): string {
  return `${API_ROUTES.knowledgeHealthItemBase}/${encodePathSegment(itemId)}`;
}

export function knowledgeHealthProjectRoute(projectSlug: string): string {
  return `${API_ROUTES.knowledgeHealthProjectsBase}/${encodePathSegment(projectSlug)}`;
}

export function reportRoute(reportId: string): string {
  return `/api/dev/reports/${encodePathSegment(reportId)}`;
}

export function providerOAuthAuthorizeRoute(provider: string): string {
  return `/api/auth/providers/${encodePathSegment(provider)}/oauth/authorize`;
}

export function providerOAuthRevokeRoute(provider: string): string {
  return `/api/auth/providers/${encodePathSegment(provider)}/oauth/revoke`;
}

export function eventStreamRoute(channels?: string[]): string {
  return channels && channels.length > 0
    ? buildApiRoute(API_ROUTES.eventsStream, { channels: channels.join(",") })
    : API_ROUTES.eventsStream;
}

export type ApiRoute = (typeof API_ROUTES)[keyof typeof API_ROUTES];
export type ApiRoutePattern = (typeof API_ROUTE_PATTERNS)[keyof typeof API_ROUTE_PATTERNS];
export type RouteTarget = ApiRoute | ApiRoutePattern;
