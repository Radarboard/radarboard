/**
 * Database adapter interfaces for the Radarboard.
 *
 * Implement these interfaces to plug in any database backend
 * (SQLite, Supabase, PlanetScale, Turso, etc.).
 */

import type { DisplayCurrency } from "./dashboard";
import type { LogLevel } from "./logs";
import type {
  NewNotificationDelivery,
  NewNotificationDigest,
  NewNotificationEvent,
  NotificationEventQuery,
  NotificationEventRow,
  NotificationFeedItem,
  NotificationFeedQuery,
  NotificationPreferenceRow,
  NotificationRuleCondition,
  NotificationRuleRow,
  NotificationSeverity,
  NotificationSnoozeRow,
  PaginatedResult,
  WebhookEndpointRow,
} from "./notifications";
import type { DashboardPollingPreferences } from "./polling";
import type { ProjectContextMap } from "./project-context";
import type { AppShortcutPreferencesConfig } from "./shortcuts";

// --- Cache Repository ---

export interface CacheEntry {
  key: string;
  data: string; // JSON string
  fetchedAt: number; // unix timestamp (seconds)
  ttlSeconds: number;
}

export interface CacheRepository {
  /** Get a cache entry by key. Returns null if not found. */
  get(key: string): Promise<CacheEntry | null>;

  /** Upsert a cache entry. */
  set(entry: CacheEntry & { route: string }): Promise<void>;

  /** Delete a single cache entry by key. */
  delete(key: string): Promise<void>;

  /** Delete all cache entries. */
  clear(): Promise<void>;

  /** List all cache keys for a given route (for cron backup). */
  getKeysByRoute(route: string): Promise<string[]>;

  /** Delete all expired cache entries. Returns the number of rows removed. */
  deleteExpired(): Promise<number>;

  /** List all cache entries (for debug/observability). */
  listEntries(limit?: number): Promise<(CacheEntry & { route: string })[]>;
}

// --- GitHub Star History Repository ---

export type GitHubStarBackfillStatus = "pending" | "backfilling" | "complete" | "error";
export type GitHubStarEventAction = "created" | "deleted";
export type GitHubStarCoverageStatus = "full" | "range_before_tracking" | "gap";

export interface GitHubRepoStarDailyRow {
  repoKey: string;
  day: string; // YYYY-MM-DD in UTC
  totalStars: number;
  starsGained: number;
  source: string;
  updatedAt: number; // unix timestamp (seconds)
}

export interface GitHubRepoStarSyncStateRow {
  repoKey: string;
  backfillStatus: GitHubStarBackfillStatus;
  nextPage: number | null;
  oldestSeenStarredAt: string | null;
  lastSyncedAt: number | null; // unix timestamp (seconds)
  lastError: string | null;
  updatedAt: number; // unix timestamp (seconds)
}

export interface GitHubRepoStarEventRow {
  sourceEventId: string;
  repoKey: string;
  action: GitHubStarEventAction;
  userLogin: string | null;
  occurredAt: number; // unix timestamp (seconds)
  updatedAt: number; // unix timestamp (seconds)
}

export interface GitHubRepoStarTrackingRow {
  repoKey: string;
  trackingStartedAt: number | null; // unix timestamp (seconds)
  baselineStars: number | null;
  lastWebhookAt: number | null; // unix timestamp (seconds)
  updatedAt: number; // unix timestamp (seconds)
}

export interface GitHubRepoStarEventCountRow {
  repoKey: string;
  date: string; // YYYY-MM-DD in requested timezone
  count: number;
}

export interface GitHubStarHistoryRepository {
  listRepoKeys(): Promise<string[]>;
  getDaily(
    repoKeys: string[],
    options?: { fromDay?: string | null; toDay?: string | null }
  ): Promise<GitHubRepoStarDailyRow[]>;
  upsertDaily(rows: GitHubRepoStarDailyRow[]): Promise<void>;
  getSyncStates(repoKeys: string[]): Promise<GitHubRepoStarSyncStateRow[]>;
  upsertSyncState(row: GitHubRepoStarSyncStateRow): Promise<void>;
  getStarEvents(
    repoKeys: string[],
    options?: {
      actions?: GitHubStarEventAction[];
      occurredAfter?: number | null;
      occurredBefore?: number | null;
    }
  ): Promise<GitHubRepoStarEventRow[]>;
  upsertStarEvents(rows: GitHubRepoStarEventRow[]): Promise<void>;
  getTrackingStates(repoKeys: string[]): Promise<GitHubRepoStarTrackingRow[]>;
  upsertTrackingState(row: GitHubRepoStarTrackingRow): Promise<void>;
  clearAll(): Promise<void>;
}

// --- Layout Definitions ---

/** A single cell in a grid layout, occupying one or more positions in the base grid. */
export interface LayoutCell {
  /** Unique cell identifier (e.g., "cell-1"). */
  id: string;
  /** Top-left row index in the grid. */
  rowStart: number;
  /** Top-left column index in the grid. */
  colStart: number;
  /** Number of rows this cell spans. */
  rowSpan: number;
  /** Number of columns this cell spans. */
  colSpan: number;
}

/** A named grid layout definition composed of cells that tile the grid exactly. */
export interface LayoutDefinition {
  /** Unique layout identifier ("basic-3x3" for the default, UUID for custom). */
  id: string;
  /** User-given display name. */
  name: string;
  /** The cells that make up this layout. Must cover every track position exactly once. */
  cells: LayoutCell[];
  /**
   * Column widths as percentages, must sum to 100.
   * Track count is inferred from the array length when present.
   */
  colSizes?: number[];
  /**
   * Row heights as percentages, must sum to 100.
   * Track count is inferred from the array length when present.
   * Retained as compatibility data and as a fallback seed for old layouts.
   */
  rowSizes?: number[];
  /**
   * Per-column row heights as percentages.
   * Outer array length must match the column count, and each inner array must
   * match the row count and sum to 100.
   */
  columnRowSizes?: number[][];
}

// --- Widget Layout Config ---

/**
 * A single named dashboard page within a project or the aggregate "__all__" owner.
 * Widget configs remain global; pages only control layout choice and slot assignments.
 */
export interface DashboardPageConfig {
  /** User-facing page name shown in the dashboard nav and settings. */
  name: string;
  /** Stable per-owner slug used for URL state. */
  slug: string;
  /** ID of the LayoutDefinition to use for this page. */
  layoutId?: string;
  /** Maps layout IDs to widget-per-slot assignments for this page. */
  widgetLayouts?: Record<string, Record<string, string | null>>;
}

/**
 * Per-owner dashboard config. Owners are project slugs plus the aggregate "__all__" view.
 */
export interface ProjectLayoutConfig {
  /** Ordered dashboard pages for this owner. */
  pages?: DashboardPageConfig[];
  /** @deprecated Legacy single-page layout selection kept only for migration. */
  layoutId?: string;
  /** @deprecated Legacy single-layout override kept only for migration. */
  layout?: Record<string, string | null>;
  /** @deprecated Legacy single-page widget assignments kept only for migration. */
  widgetLayouts?: Record<string, Record<string, string | null>>;
}

// --- Appearance ---

/** User-selectable font scale tier. */
export type FontScale = "sm" | "md" | "lg";

/** Activity ticker scroll speed. */
export type TickerSpeed = "slow" | "normal" | "fast";

/** Which shipping sources appear in the ticker. */
export interface TickerSourceConfig {
  github: boolean;
  linear: boolean;
  vercel: boolean;
  manual: boolean;
}

/** Ticker display and behaviour settings. */
export interface TickerConfig {
  /** Show the activity ticker at the bottom of the dashboard. Defaults to true. */
  enabled: boolean;
  /** Scroll animation speed. Defaults to "normal". */
  speed: TickerSpeed;
  /** Which data sources are shown. Defaults to all enabled. */
  sources: TickerSourceConfig;
  /** Show the red DOWN badge when a health monitor is down. Defaults to true. */
  showHealthAlerts: boolean;
}

/** Dashboard-wide preferences that affect date-sensitive behavior. */
export interface DashboardPreferencesConfig {
  /**
   * IANA timezone identifier used for global time-range calculations.
   * Use "auto" to resolve from the browser timezone.
   */
  timezone?: string;
  /**
   * BCP 47 locale used for user-facing date and time formatting.
   * Use "auto" to resolve from the browser/system locale.
   */
  locale?: string;
  /** Per-source polling overrides in milliseconds. */
  polling?: DashboardPollingPreferences;
  /**
   * Active display currencies. The currency toggle in the top bar is only
   * shown when more than one currency is configured. Defaults to `["USD"]`.
   */
  currencies?: DisplayCurrency[];
  /**
   * When true, widgets return pre-built mock data instead of fetching real APIs.
   * Set during onboarding when user chooses "Start with demo data".
   */
  demoMode?: boolean;
  /**
   * Whether the user has completed the onboarding wizard.
   * Used to determine if the wizard should be shown on next visit.
   */
  onboardingCompleted?: boolean;
  /**
   * User profile selection from onboarding. Used to personalize
   * integration suggestions, default layouts, and AI assistant context.
   */
  userProfile?: UserProfile | null;
  /**
   * Integration service IDs selected during onboarding but not yet configured.
   * Dashboard shows their widgets with "Connect" prompts.
   */
  intendedIntegrations?: string[];
  /**
   * Cell→widget mapping from the applied blueprint. Used to show "Connect"
   * CTAs on empty cells whose intended widget needs an unconfigured integration.
   */
  blueprintWidgetMap?: Record<string, string>;
  /**
   * User overrides for core app shortcuts. Defaults come from the app registry.
   */
  shortcuts?: AppShortcutPreferencesConfig;
}

/**
 * User profile types for personalizing the dashboard experience.
 * Extensible — add new profiles as Radarboard grows.
 */
export type UserProfile =
  | "fullstack"
  | "frontend"
  | "backend"
  | "mobile"
  | "opensource"
  | "indie"
  | "team-lead"
  | "devops"
  | "seo"
  | "marketing"
  | "content-creator"
  | "data";

/** Global appearance preferences persisted alongside the widget layout. */
export interface AppearanceConfig {
  /** Global widget font scale. Defaults to "md" when absent. */
  fontScale: FontScale;
  /** Selected theme family. Defaults to the built-in Radarboard family. */
  themeFamilyId?: string;
  /** Selected theme mode. Defaults to "dark" when absent. */
  themeMode?: "light" | "dark" | "system";
  /** Activity ticker settings. All defaults applied when absent. */
  ticker?: Partial<TickerConfig>;
}

/** Canonical widget modal sizes shared by detail dialogs, config dialogs, and expanded overlays. */
export type WidgetModalSize = import("./ui").ModalSize;

/** Persisted widget modal size preferences keyed by widget ID, then modal ID. */
export type WidgetModalPrefs = Record<string, Record<string, WidgetModalSize>>;

export interface WidgetLayoutConfig {
  /** @deprecated Legacy global widget layout kept only for migration. */
  layout?: Record<string, string | null>;
  /** Per-widget config overrides, keyed by widget ID. */
  configs: Record<string, Record<string, unknown>>;
  /** Persisted per-widget modal size preferences keyed by widget ID, then modal ID. */
  modalPrefs?: WidgetModalPrefs;
  /** Saved layout definitions. Bootstrapped with Basic 3×3 if missing. */
  layouts?: LayoutDefinition[];
  /** Per-project dashboard configs, keyed by project slug (including __all__). */
  projectLayouts?: Record<string, ProjectLayoutConfig>;
  /** Dashboard-wide preferences such as timezone selection. */
  preferences?: DashboardPreferencesConfig;
  /** Global appearance preferences (font scale, etc.). */
  appearance?: AppearanceConfig;
}

// --- Credential Repository ---

export interface CredentialRepository {
  /** Get decrypted credentials for a widget/service. Returns null if not stored. */
  getCredential(key: string): Promise<Record<string, string> | null>;

  /** Store encrypted credentials for a widget/service. */
  setCredential(key: string, values: Record<string, string>): Promise<void>;

  /** Delete stored credentials for a widget/service. */
  deleteCredential(key: string): Promise<void>;

  /** Get all stored credential keys (without values). */
  listCredentialKeys(): Promise<string[]>;
}

// --- Feature Preferences ---

export type FeaturePreferencesConfig = Record<string, boolean>;

// --- Settings Repository ---

/** Per-project integration overrides saved from settings UI. */
export type ProjectIntegrationsConfig = Record<string, Record<string, Record<string, unknown>>>;

export interface IntegrationConnectionCapability {
  id: string;
  enabled: boolean;
  config?: Record<string, unknown>;
  resources?: Record<string, unknown>;
}

export interface IntegrationConnection {
  id: string;
  provider: string;
  name: string;
  credentialKey: string;
  enabled: boolean;
  isDefault: boolean;
  source: "explicit" | "legacy";
  capabilities: IntegrationConnectionCapability[];
  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export type IntegrationConnectionsConfig = IntegrationConnection[];

/**
 * User-editable LLM configuration.
 * All fields are optional — omitting a field falls back to the built-in default.
 */
export interface AssistantPresetConfig {
  id: string;
  name: string;
  prompt: string;
  mode: AssistantMode;
  modelId?: string | null;
  description?: string;
}

export interface LlmConfig {
  /** Override the AI identity/persona paragraph at the top of every system prompt. */
  identityPrompt?: string;
  /** Override the system prompt used for post-conversation memory extraction. */
  extractionPrompt?: string;
  /**
   * Per-skill instruction overrides keyed by skill ID (e.g. "prioritization").
   * Applies to both built-in and custom skills.
   */
  skillOverrides?: Record<string, string>;
  /** User-defined assistant presets shown in the chat composer and settings. */
  assistantPresets?: AssistantPresetConfig[];
}

export type AssistantMode = "default" | "explore" | "plan" | "review" | "qa";

export type AssistantArtifactStatus = "draft" | "completed" | "blocked" | "needs_input" | "failed";

export interface DebugNotificationPromotionRule {
  id: string;
  enabled: boolean;
  sourcePattern?: string | null;
  eventTypePattern?: string | null;
  level?: LogLevel | null;
  severity: NotificationSeverity;
}

export interface DebugConfig {
  promotionEnabled?: boolean;
  promotionRules?: DebugNotificationPromotionRule[];
  metadataRedactionEnabled?: boolean;
  additionalRedactedKeys?: string[];
  metadataMaxBytes?: number;
  retentionDays?: number;
}

export type RoutingSurface = "notifications" | "ticker";

export type RoutingAction = "inherit" | "allow" | "deny";

export interface RoutingRule {
  id: string;
  name: string;
  enabled: boolean;
  source: string | null;
  eventType: string | null;
  /** Minimum severity required for this rule to match. */
  severity: NotificationSeverity | null;
  projectSlug: string | null;
  condition: NotificationRuleCondition | null;
  notifications: RoutingAction;
  ticker: RoutingAction;
  createdAt: number;
  updatedAt: number;
}

export interface RoutingConfig {
  rules: RoutingRule[];
}

export interface SettingsRepository {
  /** Get the saved project tab order. Returns empty array if not set. */
  getProjectOrder(): Promise<string[]>;

  /** Save the project tab order. */
  setProjectOrder(order: string[]): Promise<void>;

  /** Get the saved widget layout config. Returns null if not set. */
  getWidgetLayout(): Promise<WidgetLayoutConfig | null>;

  /** Save the widget layout config. */
  setWidgetLayout(config: WidgetLayoutConfig): Promise<void>;

  /** Get per-project integration overrides (e.g., GitHub repo assignments). */
  getProjectIntegrations(): Promise<ProjectIntegrationsConfig>;

  /** Save per-project integration overrides. */
  setProjectIntegrations(config: ProjectIntegrationsConfig): Promise<void>;

  /** Get integration connection-instance metadata. */
  getIntegrationConnections(): Promise<IntegrationConnectionsConfig>;

  /** Save integration connection-instance metadata. */
  setIntegrationConnections(config: IntegrationConnectionsConfig): Promise<void>;

  /** Get project context (goals, priorities, notes) for all projects. */
  getProjectContextMap(): Promise<ProjectContextMap>;

  /** Save project context for all projects. */
  setProjectContextMap(ctx: ProjectContextMap): Promise<void>;

  /** Get user-editable LLM config (prompts, skill overrides). */
  getLlmConfig(): Promise<LlmConfig>;

  /** Save user-editable LLM config. */
  setLlmConfig(config: LlmConfig): Promise<void>;

  /** Get user-editable debug configuration (promotion rules, filters). */
  getDebugConfig(): Promise<DebugConfig>;

  /** Save user-editable debug configuration. */
  setDebugConfig(config: DebugConfig): Promise<void>;

  /** Get cross-surface event routing configuration. */
  getRoutingConfig(): Promise<RoutingConfig>;

  /** Save cross-surface event routing configuration. */
  setRoutingConfig(config: RoutingConfig): Promise<void>;

  /** Get persisted automation workflows. Returns empty record if not set. */
  getWorkflows(): Promise<Record<string, unknown>>;

  /** Save automation workflows. */
  setWorkflows(workflows: Record<string, unknown>): Promise<void>;

  /** Get user feature preferences. Returns empty record if not set. */
  getFeaturePreferences(): Promise<FeaturePreferencesConfig>;

  /** Save user feature preferences. */
  setFeaturePreferences(prefs: FeaturePreferencesConfig): Promise<void>;

  /** Get the user's subscription plan tier. Returns null if not set (use env default). */
  getUserPlan(): Promise<string | null>;

  /** Save the user's subscription plan tier. */
  setUserPlan(plan: string): Promise<void>;

  /** Get the stored license key (for offline plan validation). Returns null if not set. */
  getLicenseKey(): Promise<string | null>;

  /** Save a license key. */
  setLicenseKey(key: string): Promise<void>;
}

// --- Provider Configuration ---

export type DatabaseProvider = "sqlite" | "supabase" | "turso" | "planetscale";

export type SqliteConfig = Record<string, never>;

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export interface TursoConfig {
  url: string;
  authToken: string;
}

export interface PlanetscaleConfig {
  host: string;
  username: string;
  password: string;
}

export interface DatabaseConfig {
  provider: DatabaseProvider;
  sqlite?: SqliteConfig;
  supabase?: SupabaseConfig;
  turso?: TursoConfig;
  planetscale?: PlanetscaleConfig;
}

export interface RadarboardConfig {
  database: DatabaseConfig;
}

// --- Provider Metadata (for UI) ---

export interface ProviderInfo {
  id: DatabaseProvider;
  name: string;
  description: string;
  fields: ProviderField[];
  docsUrl: string;
}

export interface ProviderField {
  key: string;
  label: string;
  type: "text" | "password" | "url";
  placeholder: string;
  required: boolean;
  helpText?: string;
}

// --- LLM Repository ---

export interface LlmConversationRow {
  id: string;
  title: string;
  projectSlug: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LlmMessageRow {
  id: string;
  conversationId: string;
  role: string;
  /** JSON-serialized LlmMessagePart[]. */
  parts: string;
  createdAt: string;
}

export interface LlmMemoryRow {
  id: string;
  key: string;
  value: string;
  /** JSON-serialized number[] or null. */
  embedding: string | null;
  projectSlug: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Embeddings (generic vector storage for topic clustering, semantic search)
// ---------------------------------------------------------------------------

export interface EmbeddingRow {
  id: string;
  /** Source integration or plugin, e.g. "gsc", "github-issues", "linear". */
  source: string;
  /** Original item identifier within the source. */
  sourceId: string;
  /** The text that was embedded. */
  text: string;
  /** JSON-serialized number[] — the embedding vector. */
  embedding: string;
  /** Which embedding model produced this vector. */
  modelId: string;
  /** Number of dimensions in the vector. */
  dimensions: number;
  projectSlug: string | null;
  /** JSON-serialized Record<string, unknown> — extra context (URL, date, etc.). */
  metadata: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LlmSkillRow {
  id: string;
  name: string;
  description: string;
  instructions: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LlmMessageSearchResult {
  conversationId: string;
  conversationTitle: string;
  messageId: string;
  role: string;
  snippet: string;
}

export interface LlmTraceRow {
  id: string;
  conversationId: string | null;
  providerId: string;
  modelId: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  durationMs: number;
  /** Optional user rating: 1 = positive, -1 = negative, null = unrated */
  rating: number | null;
  /** Estimated cost in USD (calculated from token usage + model pricing). */
  costUsd?: number | null;
  createdAt: string; // ISO 8601
}

export type AssistantArtifactContentType = "markdown" | "html" | "mermaid";

export type AssistantEvidenceRefKind = "entity" | "page" | "query" | "repo" | "url";

export interface AssistantEvidenceRef {
  kind: AssistantEvidenceRefKind;
  label: string;
  url?: string;
}

export interface AssistantArtifactRow {
  id: string;
  projectSlug: string | null;
  mode: AssistantMode;
  title: string;
  summary: string;
  body: string;
  contentType: AssistantArtifactContentType;
  status: AssistantArtifactStatus;
  sourceConversationId: string | null;
  createdAt: string;
  nextMode: AssistantMode | null;
  nextReason: string | null;
  evidenceRefs: AssistantEvidenceRef[];
}

export interface AssistantArtifactQuery {
  projectSlug?: string;
  mode?: AssistantMode;
  sourceConversationId?: string;
  limit?: number;
}

export interface LlmRepository {
  // Conversations
  listConversations(): Promise<LlmConversationRow[]>;
  createConversation(id: string, title: string, projectSlug: string | null): Promise<void>;
  updateConversationTitle(id: string, title: string): Promise<void>;
  deleteConversation(id: string): Promise<void>;

  // Messages
  getMessages(conversationId: string): Promise<LlmMessageRow[]>;
  appendMessage(msg: LlmMessageRow): Promise<void>;
  searchMessages(query: string, limit?: number): Promise<LlmMessageSearchResult[]>;

  // Memory
  listMemory(projectSlug?: string): Promise<LlmMemoryRow[]>;
  upsertMemory(entry: LlmMemoryRow): Promise<void>;
  deleteMemory(id: string): Promise<void>;

  // Custom skills
  listSkills(): Promise<LlmSkillRow[]>;
  upsertSkill(skill: LlmSkillRow): Promise<void>;
  deleteSkill(id: string): Promise<void>;

  // Traces (observability)
  insertTrace(trace: LlmTraceRow): Promise<void>;
  listTraces(limit?: number): Promise<LlmTraceRow[]>;
  updateTraceRating(id: string, rating: number | null): Promise<void>;

  // Assistant workflow artifacts
  listArtifacts(query?: AssistantArtifactQuery): Promise<AssistantArtifactRow[]>;
  getArtifact(id: string): Promise<AssistantArtifactRow | null>;
  upsertArtifact(artifact: AssistantArtifactRow): Promise<void>;

  // Embeddings
  listEmbeddings(source?: string, projectSlug?: string): Promise<EmbeddingRow[]>;
  upsertEmbedding(row: EmbeddingRow): Promise<void>;
  upsertEmbeddings(rows: EmbeddingRow[]): Promise<void>;
  deleteEmbedding(id: string): Promise<void>;
  deleteEmbeddingsBySource(source: string, projectSlug?: string): Promise<void>;
}

// --- Debug Event Repository ---

export interface DebugEventRow {
  id: string;
  occurredAt: string; // ISO 8601
  ingestedAt: string; // ISO 8601
  level: LogLevel;
  source: string;
  eventType: string;
  message: string;
  projectSlug: string | null;
  traceId: string | null;
  requestId: string | null;
  sessionId: string | null;
  conversationId: string | null;
  entityType: string | null;
  entityId: string | null;
  status: string | null;
  durationMs: number | null;
  metadata: string; // JSON-serialized object
}

export interface DebugEventQuery {
  level?: LogLevel;
  source?: string;
  eventType?: string;
  projectSlug?: string;
  traceId?: string;
  requestId?: string;
  conversationId?: string;
  entityType?: string;
  entityId?: string;
  search?: string;
  after?: string; // ISO 8601
  before?: string; // ISO 8601
  limit?: number;
}

export interface DebugRepository {
  insertEvent(event: DebugEventRow): Promise<void>;
  listEvents(query?: DebugEventQuery): Promise<DebugEventRow[]>;
  pruneEvents(olderThan: string): Promise<number>;
}

// --- Plugin Data Repository ---

export interface PluginRepository {
  get(pluginId: string, key: string): Promise<string | null>;
  set(pluginId: string, key: string, value: string): Promise<void>;
  delete(pluginId: string, key: string): Promise<void>;
  list(pluginId: string, prefix: string): Promise<{ key: string; value: string }[]>;
}

// --- Notification Repository ---

export interface NotificationRepository {
  insertEvent(event: NewNotificationEvent): Promise<void>;
  insertEvents(events: NewNotificationEvent[]): Promise<void>;
  getEvents(query?: NotificationEventQuery): Promise<NotificationEventRow[]>;
  getEventById(id: string): Promise<NotificationEventRow | null>;
  isDuplicate(source: string, sourceEventId: string): Promise<boolean>;

  insertDigest(digest: NewNotificationDigest): Promise<void>;
  assignEventsToDigest(eventIds: string[], digestId: string): Promise<void>;

  insertDelivery(delivery: NewNotificationDelivery): Promise<void>;
  markRead(id: string): Promise<void>;
  markDismissed(id: string): Promise<void>;
  markAllRead(filter?: { source?: string; projectSlug?: string }): Promise<void>;
  getUnreadCount(): Promise<number>;

  getFeed(query?: NotificationFeedQuery): Promise<PaginatedResult<NotificationFeedItem>>;

  getRules(): Promise<NotificationRuleRow[]>;
  upsertRule(rule: NotificationRuleRow): Promise<void>;
  deleteRule(id: string): Promise<void>;

  getPreferences(): Promise<NotificationPreferenceRow[]>;
  getPreference(id: string): Promise<NotificationPreferenceRow | null>;
  upsertPreference(pref: NotificationPreferenceRow): Promise<void>;

  getWebhookEndpoints(): Promise<WebhookEndpointRow[]>;
  upsertWebhookEndpoint(endpoint: WebhookEndpointRow): Promise<void>;
  deleteWebhookEndpoint(id: string): Promise<void>;

  snoozeSource(source: string, durationMs: number): Promise<void>;
  unsnoozeSource(source: string): Promise<void>;
  getActiveSnoozes(now?: number): Promise<NotificationSnoozeRow[]>;

  pruneEvents(olderThan: number): Promise<number>;
}

// --- Database Adapter ---

export interface DatabaseAdapter {
  readonly provider: DatabaseProvider;
  cache: CacheRepository;
  githubStarHistory?: GitHubStarHistoryRepository;
  settings: SettingsRepository;
  credentials: CredentialRepository;
  /** LLM repository — optional, lazy-initialized when AI features are first used. */
  llm?: LlmRepository;
  /** Debug event repository — optional until each provider implements it. */
  debug?: DebugRepository;
  /** Plugin data repository — optional, lazy-initialized when plugins are first used. */
  plugins?: PluginRepository;
  /** Notification repository — optional until each provider implements it. */
  notifications?: NotificationRepository;
}
