import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const userSettings = sqliteTable("user_settings", {
  id: text("id").primaryKey(), // "default" for single-user (will become auth user ID when auth is added)
  projectOrder: text("project_order"), // JSON: string[] of project slugs
  widgetLayout: text("widget_layout"), // JSON: WidgetLayoutConfig (per-project, per-layout widget placement)
  projectIntegrations: text("project_integrations"), // JSON: Record<projectSlug, Record<platformId, PlatformIntegrations>>
  integrationConnections: text("integration_connections"), // JSON: IntegrationConnectionsConfig
  projectContextMap: text("project_context_map"), // JSON: ProjectContextMap (goals, priorities, notes per project)
  llmConfig: text("llm_config"), // JSON: LlmConfig (identity prompt, extraction prompt, skill overrides)
  debugConfig: text("debug_config"), // JSON: DebugConfig (promotion rules)
  routingConfig: text("routing_config"), // JSON: RoutingConfig (shared notifications + ticker rules)
  workflows: text("workflows"), // JSON: Record<string, Workflow> (persisted automation workflows)
  featurePreferences: text("feature_preferences"), // JSON: Record<string, boolean> (user feature toggles)
  userPlan: text("user_plan"), // "free" | "pro" | "enterprise" — subscription plan tier
  licenseKey: text("license_key"), // Signed JWT for offline plan validation (desktop/self-hosted)
  updatedAt: integer("updated_at"), // Unix timestamp in seconds
});

export const widgetCredentials = sqliteTable("widget_credentials", {
  key: text("key").primaryKey(), // Service-level key, e.g. "sentry", "vercel", "linear"
  encryptedData: text("encrypted_data").notNull(), // AES-256-GCM encrypted JSON
  updatedAt: integer("updated_at").notNull(), // Unix timestamp in seconds
});

export const apiCache = sqliteTable(
  "api_cache",
  {
    key: text("key").primaryKey(), // "revenue:goshuin-atlas:30d:USD"
    route: text("route").notNull(), // "/api/revenue" (for cron queries)
    data: text("data").notNull(), // JSON response blob
    fetchedAt: integer("fetched_at").notNull(), // unix timestamp (seconds)
    ttlSeconds: integer("ttl_seconds").notNull(), // freshness window
  },
  (table) => [index("api_cache_route_idx").on(table.route)]
);

// ---------------------------------------------------------------------------
// Installed extensions — tracks externally installed extensions from GitHub
// ---------------------------------------------------------------------------

export const installedExtensions = sqliteTable("installed_extensions", {
  id: text("id").primaryKey(), // Extension repo identifier, e.g. "acme/radarboard-notion"
  githubUrl: text("github_url").notNull(), // Full GitHub URL used to install
  commitSha: text("commit_sha"), // HEAD commit SHA at install time
  extensionTypes: text("extension_types").notNull(), // JSON: string[] e.g. ["integration","plugin"]
  installedAt: integer("installed_at").notNull(), // Unix timestamp in seconds
  updatedAt: integer("updated_at").notNull(), // Unix timestamp in seconds
});

// ---------------------------------------------------------------------------
// Extension usage analytics — lightweight mount/interaction tracking
// ---------------------------------------------------------------------------

export const extensionUsage = sqliteTable(
  "extension_usage",
  {
    extensionId: text("extension_id").notNull(), // e.g. "tasks", "github", "analytics"
    extensionType: text("extension_type").notNull(), // "integration" | "plugin" | "widget"
    day: text("day").notNull(), // ISO date "2026-03-28"
    mountCount: integer("mount_count").notNull().default(0),
    errorCount: integer("error_count").notNull().default(0),
    totalRenderMs: integer("total_render_ms").notNull().default(0),
  },
  (table) => [
    uniqueIndex("extension_usage_pk").on(table.extensionId, table.extensionType, table.day),
    index("extension_usage_day_idx").on(table.day),
  ]
);

// ---------------------------------------------------------------------------
// LLM tables — conversations, messages, memory, custom skills
// ---------------------------------------------------------------------------

export const llmConversations = sqliteTable(
  "llm_conversations",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    projectSlug: text("project_slug"),
    createdAt: text("created_at").notNull(), // ISO 8601
    updatedAt: text("updated_at").notNull(), // ISO 8601
  },
  (table) => [index("llm_conversations_project_idx").on(table.projectSlug)]
);

export const llmMessages = sqliteTable(
  "llm_messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id").notNull(),
    role: text("role").notNull(), // "user" | "assistant" | "tool"
    parts: text("parts").notNull(), // JSON: LlmMessagePart[]
    createdAt: text("created_at").notNull(), // ISO 8601
  },
  (table) => [index("llm_messages_conv_idx").on(table.conversationId)]
);

export const llmMemory = sqliteTable(
  "llm_memory",
  {
    id: text("id").primaryKey(),
    key: text("key").notNull(),
    value: text("value").notNull(),
    embedding: text("embedding"), // JSON: number[] | null
    projectSlug: text("project_slug"),
    createdAt: text("created_at").notNull(), // ISO 8601
    updatedAt: text("updated_at").notNull(), // ISO 8601
  },
  (table) => [uniqueIndex("llm_memory_key_idx").on(table.key, table.projectSlug)]
);

export const embeddings = sqliteTable(
  "embeddings",
  {
    id: text("id").primaryKey(),
    source: text("source").notNull(), // e.g. "gsc", "github-issues", "linear"
    sourceId: text("source_id").notNull(), // original item ID within source
    text: text("text").notNull(), // the embedded text
    embedding: text("embedding").notNull(), // JSON: number[]
    modelId: text("model_id").notNull(), // e.g. "text-embedding-3-small"
    dimensions: integer("dimensions").notNull(),
    projectSlug: text("project_slug"),
    metadata: text("metadata"), // JSON: Record<string, unknown>
    createdAt: text("created_at").notNull(), // ISO 8601
    updatedAt: text("updated_at").notNull(), // ISO 8601
  },
  (table) => [
    uniqueIndex("embeddings_source_id_idx").on(table.source, table.sourceId),
    index("embeddings_source_idx").on(table.source),
    index("embeddings_project_idx").on(table.projectSlug),
  ]
);

export const llmSkills = sqliteTable("llm_skills", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  instructions: text("instructions").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(), // ISO 8601
  updatedAt: text("updated_at").notNull(), // ISO 8601
});

export const llmArtifacts = sqliteTable(
  "llm_artifacts",
  {
    id: text("id").primaryKey(),
    projectSlug: text("project_slug"),
    mode: text("mode").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    body: text("body").notNull(),
    contentType: text("content_type").notNull().default("markdown"),
    status: text("status").notNull(),
    sourceConversationId: text("source_conversation_id"),
    createdAt: text("created_at").notNull(), // ISO 8601
    nextMode: text("next_mode"),
    nextReason: text("next_reason"),
    evidenceRefs: text("evidence_refs").notNull().default("[]"),
  },
  (table) => [
    index("llm_artifacts_created_idx").on(table.createdAt),
    index("llm_artifacts_project_idx").on(table.projectSlug, table.createdAt),
    index("llm_artifacts_mode_idx").on(table.mode, table.createdAt),
    index("llm_artifacts_conv_idx").on(table.sourceConversationId, table.createdAt),
  ]
);

// ---------------------------------------------------------------------------
// Plugin data — namespaced key-value store for plugin persistence
// ---------------------------------------------------------------------------

export const pluginData = sqliteTable(
  "plugin_data",
  {
    pluginId: text("plugin_id").notNull(),
    key: text("key").notNull(),
    value: text("value").notNull(),
    updatedAt: integer("updated_at").notNull(), // Unix timestamp in seconds
  },
  (table) => [uniqueIndex("plugin_data_pk").on(table.pluginId, table.key)]
);

export const notificationEvents = sqliteTable(
  "notification_events",
  {
    id: text("id").primaryKey(),
    source: text("source").notNull(),
    sourceEventId: text("source_event_id"),
    type: text("type").notNull(),
    severity: text("severity").notNull(),
    projectSlug: text("project_slug"),
    title: text("title").notNull(),
    body: text("body"),
    metadata: text("metadata").notNull(),
    occurredAt: integer("occurred_at").notNull(),
    ingestedAt: integer("ingested_at").notNull(),
    batchId: text("batch_id"),
  },
  (table) => [
    index("notification_events_source_type_idx").on(table.source, table.type),
    index("notification_events_severity_idx").on(table.severity),
    index("notification_events_project_idx").on(table.projectSlug),
    index("notification_events_occurred_idx").on(table.occurredAt),
    uniqueIndex("notification_events_source_event_idx").on(table.source, table.sourceEventId),
  ]
);

export const notificationDigests = sqliteTable(
  "notification_digests",
  {
    id: text("id").primaryKey(),
    source: text("source").notNull(),
    type: text("type").notNull(),
    severity: text("severity").notNull(),
    projectSlug: text("project_slug"),
    title: text("title").notNull(),
    body: text("body"),
    metadata: text("metadata").notNull(),
    eventCount: integer("event_count").notNull(),
    windowStart: integer("window_start").notNull(),
    windowEnd: integer("window_end").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("notification_digests_source_type_idx").on(table.source, table.type),
    index("notification_digests_created_idx").on(table.createdAt),
  ]
);

export const notificationDeliveries = sqliteTable(
  "notification_deliveries",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id"),
    digestId: text("digest_id"),
    channel: text("channel").notNull(),
    status: text("status").notNull(),
    deliveredAt: integer("delivered_at"),
    readAt: integer("read_at"),
    retryCount: integer("retry_count").notNull().default(0),
    lastAttemptAt: integer("last_attempt_at"),
    metadata: text("metadata").notNull(),
  },
  (table) => [
    index("notification_deliveries_event_idx").on(table.eventId),
    index("notification_deliveries_digest_idx").on(table.digestId),
    index("notification_deliveries_channel_status_idx").on(table.channel, table.status),
  ]
);

export const notificationRules = sqliteTable(
  "notification_rules",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    source: text("source"),
    eventType: text("event_type"),
    severity: text("severity"),
    projectSlug: text("project_slug"),
    condition: text("condition"),
    channels: text("channels").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [index("notification_rules_project_idx").on(table.projectSlug)]
);

export const notificationPreferences = sqliteTable("notification_preferences", {
  id: text("id").primaryKey(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  preset: text("preset").notNull(),
  digestWindow: integer("digest_window").notNull().default(300),
  channels: text("channels").notNull(),
  quietHours: text("quiet_hours"),
  sounds: text("sounds"),
  updatedAt: integer("updated_at").notNull(),
});

export const webhookEndpoints = sqliteTable("webhook_endpoints", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  secret: text("secret").notNull(),
  events: text("events").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at").notNull(),
});

export const notificationSnoozes = sqliteTable("notification_snoozes", {
  source: text("source").primaryKey(),
  snoozedAt: integer("snoozed_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
});

export const llmTraces = sqliteTable(
  "llm_traces",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id"),
    providerId: text("provider_id").notNull(),
    modelId: text("model_id").notNull(),
    promptTokens: integer("prompt_tokens").notNull().default(0),
    completionTokens: integer("completion_tokens").notNull().default(0),
    totalTokens: integer("total_tokens").notNull().default(0),
    durationMs: integer("duration_ms").notNull().default(0),
    rating: integer("rating"), // 1 = positive, -1 = negative, null = unrated
    createdAt: text("created_at").notNull(), // ISO 8601
  },
  (table) => [index("llm_traces_conv_idx").on(table.conversationId)]
);

export const debugEvents = sqliteTable(
  "debug_events",
  {
    id: text("id").primaryKey(),
    occurredAt: text("occurred_at").notNull(),
    ingestedAt: text("ingested_at").notNull(),
    level: text("level").notNull(),
    source: text("source").notNull(),
    eventType: text("event_type").notNull(),
    message: text("message").notNull(),
    projectSlug: text("project_slug"),
    traceId: text("trace_id"),
    requestId: text("request_id"),
    sessionId: text("session_id"),
    conversationId: text("conversation_id"),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    status: text("status"),
    durationMs: integer("duration_ms"),
    metadata: text("metadata").notNull(),
  },
  (table) => [
    index("debug_events_occurred_idx").on(table.occurredAt),
    index("debug_events_project_idx").on(table.projectSlug, table.occurredAt),
    index("debug_events_source_idx").on(table.source, table.occurredAt),
    index("debug_events_type_idx").on(table.eventType, table.occurredAt),
    index("debug_events_trace_idx").on(table.traceId, table.occurredAt),
    index("debug_events_conv_idx").on(table.conversationId, table.occurredAt),
    index("debug_events_entity_idx").on(table.entityType, table.entityId, table.occurredAt),
  ]
);
