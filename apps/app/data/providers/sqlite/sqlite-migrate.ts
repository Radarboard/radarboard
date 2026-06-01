/**
 * SQLite auto-migration SQL — shared between client.ts (auto-migrate on first run)
 * and the /api/database/migrate route.
 *
 * Uses CREATE TABLE IF NOT EXISTS so it's safe to run repeatedly.
 *
 * ## Versioned migrations
 *
 * We use SQLite's PRAGMA user_version to track which migrations have been applied.
 * - Version 0: brand-new DB (no tables exist) — run full CREATE TABLE suite
 * - Version 1+: existing DB — run incremental ALTER TABLE / CREATE TABLE / CREATE INDEX
 *
 * When adding schema changes:
 * 1. Add a new entry to INCREMENTAL_MIGRATIONS with the next version number
 * 2. Bump LATEST_SCHEMA_VERSION to match
 * 3. The migration runs automatically on next app startup
 *
 * IMPORTANT: Migrations must be idempotent — they may run against DBs that
 * already have the change (e.g., fresh installs always create the latest schema).
 */
import type { Client } from "@libsql/client";

/** Current schema version. Bump this when adding a new incremental migration. */
export const LATEST_SCHEMA_VERSION = 1;

/**
 * Incremental migrations keyed by target version.
 * Each migration is an array of SQL statements that upgrade from (version - 1) to version.
 * Migrations MUST be idempotent (safe to re-run).
 */
export const INCREMENTAL_MIGRATIONS: Record<number, string[]> = {
  // Version 1: baseline — installed_extensions + extension_usage tables
  // (added after initial release, may be missing on older DBs)
  1: [
    "CREATE TABLE IF NOT EXISTS installed_extensions (id TEXT PRIMARY KEY, github_url TEXT NOT NULL, commit_sha TEXT, extension_types TEXT NOT NULL DEFAULT '[]', installed_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)",
    "CREATE TABLE IF NOT EXISTS extension_usage (id TEXT PRIMARY KEY, extension_id TEXT NOT NULL, action TEXT NOT NULL, metadata TEXT, created_at INTEGER NOT NULL)",
    "CREATE INDEX IF NOT EXISTS extension_usage_ext_idx ON extension_usage(extension_id)",
  ],
};

/**
 * Run versioned migrations on an existing SQLite database.
 * Reads PRAGMA user_version, runs any pending migrations, updates the version.
 */
export async function runVersionedMigrations(client: Client): Promise<void> {
  const result = await client.execute("PRAGMA user_version");
  const currentVersion = Number(result.rows[0]?.[0] ?? 0);

  if (currentVersion >= LATEST_SCHEMA_VERSION) return;

  for (let v = currentVersion + 1; v <= LATEST_SCHEMA_VERSION; v++) {
    const statements = INCREMENTAL_MIGRATIONS[v];
    if (!statements?.length) continue;
    for (const sql of statements) {
      await client.execute(sql);
    }
  }

  await client.execute(`PRAGMA user_version = ${LATEST_SCHEMA_VERSION}`);
}

export const SQLITE_CORE_MIGRATION_SQL = [
  "CREATE TABLE IF NOT EXISTS user_settings (id TEXT PRIMARY KEY, project_order TEXT, widget_layout TEXT, project_integrations TEXT, integration_connections TEXT, project_context_map TEXT, llm_config TEXT, debug_config TEXT, routing_config TEXT, workflows TEXT, feature_preferences TEXT, user_plan TEXT, license_key TEXT, updated_at INTEGER)",
  "CREATE TABLE IF NOT EXISTS api_cache (key TEXT PRIMARY KEY, route TEXT NOT NULL, data TEXT NOT NULL, fetched_at INTEGER NOT NULL, ttl_seconds INTEGER NOT NULL)",
  "CREATE INDEX IF NOT EXISTS api_cache_route_idx ON api_cache(route)",
  "CREATE TABLE IF NOT EXISTS widget_credentials (key TEXT PRIMARY KEY, encrypted_data TEXT NOT NULL, updated_at INTEGER NOT NULL)",
  "CREATE TABLE IF NOT EXISTS llm_conversations (id TEXT PRIMARY KEY, title TEXT NOT NULL, project_slug TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS llm_messages (id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, role TEXT NOT NULL, parts TEXT NOT NULL, created_at TEXT NOT NULL)",
  "CREATE INDEX IF NOT EXISTS llm_messages_conv_idx ON llm_messages(conversation_id)",
  "CREATE TABLE IF NOT EXISTS llm_memory (id TEXT PRIMARY KEY, key TEXT NOT NULL, value TEXT NOT NULL, embedding TEXT, project_slug TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
  "CREATE UNIQUE INDEX IF NOT EXISTS llm_memory_key_idx ON llm_memory(key, project_slug)",
  "CREATE TABLE IF NOT EXISTS llm_skills (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL, instructions TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS llm_artifacts (id TEXT PRIMARY KEY, project_slug TEXT, mode TEXT NOT NULL, title TEXT NOT NULL, summary TEXT NOT NULL, body TEXT NOT NULL, content_type TEXT NOT NULL DEFAULT 'markdown', status TEXT NOT NULL, source_conversation_id TEXT, created_at TEXT NOT NULL, next_mode TEXT, next_reason TEXT, evidence_refs TEXT NOT NULL DEFAULT '[]')",
  "CREATE INDEX IF NOT EXISTS llm_artifacts_created_idx ON llm_artifacts(created_at)",
  "CREATE INDEX IF NOT EXISTS llm_artifacts_project_idx ON llm_artifacts(project_slug, created_at)",
  "CREATE INDEX IF NOT EXISTS llm_artifacts_mode_idx ON llm_artifacts(mode, created_at)",
  "CREATE INDEX IF NOT EXISTS llm_artifacts_conv_idx ON llm_artifacts(source_conversation_id, created_at)",
  "CREATE TABLE IF NOT EXISTS llm_traces (id TEXT PRIMARY KEY, conversation_id TEXT, provider_id TEXT NOT NULL, model_id TEXT NOT NULL, prompt_tokens INTEGER NOT NULL DEFAULT 0, completion_tokens INTEGER NOT NULL DEFAULT 0, total_tokens INTEGER NOT NULL DEFAULT 0, duration_ms INTEGER NOT NULL DEFAULT 0, rating INTEGER, created_at TEXT NOT NULL)",
  "CREATE INDEX IF NOT EXISTS llm_traces_conv_idx ON llm_traces(conversation_id)",
  "CREATE TABLE IF NOT EXISTS debug_events (id TEXT PRIMARY KEY, occurred_at TEXT NOT NULL, ingested_at TEXT NOT NULL, level TEXT NOT NULL, source TEXT NOT NULL, event_type TEXT NOT NULL, message TEXT NOT NULL, project_slug TEXT, trace_id TEXT, request_id TEXT, session_id TEXT, conversation_id TEXT, entity_type TEXT, entity_id TEXT, status TEXT, duration_ms INTEGER, metadata TEXT NOT NULL)",
  "CREATE INDEX IF NOT EXISTS debug_events_occurred_idx ON debug_events(occurred_at)",
  "CREATE INDEX IF NOT EXISTS debug_events_project_idx ON debug_events(project_slug, occurred_at)",
  "CREATE INDEX IF NOT EXISTS debug_events_source_idx ON debug_events(source, occurred_at)",
  "CREATE INDEX IF NOT EXISTS debug_events_type_idx ON debug_events(event_type, occurred_at)",
  "CREATE INDEX IF NOT EXISTS debug_events_trace_idx ON debug_events(trace_id, occurred_at)",
  "CREATE INDEX IF NOT EXISTS debug_events_conv_idx ON debug_events(conversation_id, occurred_at)",
  "CREATE INDEX IF NOT EXISTS debug_events_entity_idx ON debug_events(entity_type, entity_id, occurred_at)",
  "CREATE TABLE IF NOT EXISTS plugin_data (plugin_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, updated_at INTEGER NOT NULL)",
  "CREATE UNIQUE INDEX IF NOT EXISTS plugin_data_pk ON plugin_data(plugin_id, key)",
  "CREATE TABLE IF NOT EXISTS notification_events (id TEXT PRIMARY KEY, source TEXT NOT NULL, source_event_id TEXT, type TEXT NOT NULL, severity TEXT NOT NULL, project_slug TEXT, title TEXT NOT NULL, body TEXT, metadata TEXT NOT NULL, occurred_at INTEGER NOT NULL, ingested_at INTEGER NOT NULL, batch_id TEXT)",
  "CREATE INDEX IF NOT EXISTS notification_events_source_type_idx ON notification_events(source, type)",
  "CREATE INDEX IF NOT EXISTS notification_events_severity_idx ON notification_events(severity)",
  "CREATE INDEX IF NOT EXISTS notification_events_project_idx ON notification_events(project_slug)",
  "CREATE INDEX IF NOT EXISTS notification_events_occurred_idx ON notification_events(occurred_at)",
  "CREATE UNIQUE INDEX IF NOT EXISTS notification_events_source_event_idx ON notification_events(source, source_event_id)",
  "CREATE TABLE IF NOT EXISTS notification_digests (id TEXT PRIMARY KEY, source TEXT NOT NULL, type TEXT NOT NULL, severity TEXT NOT NULL, project_slug TEXT, title TEXT NOT NULL, body TEXT, metadata TEXT NOT NULL, event_count INTEGER NOT NULL, window_start INTEGER NOT NULL, window_end INTEGER NOT NULL, created_at INTEGER NOT NULL)",
  "CREATE INDEX IF NOT EXISTS notification_digests_source_type_idx ON notification_digests(source, type)",
  "CREATE INDEX IF NOT EXISTS notification_digests_created_idx ON notification_digests(created_at)",
  "CREATE TABLE IF NOT EXISTS notification_deliveries (id TEXT PRIMARY KEY, event_id TEXT, digest_id TEXT, channel TEXT NOT NULL, status TEXT NOT NULL, delivered_at INTEGER, read_at INTEGER, retry_count INTEGER NOT NULL DEFAULT 0, last_attempt_at INTEGER, metadata TEXT NOT NULL)",
  "CREATE INDEX IF NOT EXISTS notification_deliveries_event_idx ON notification_deliveries(event_id)",
  "CREATE INDEX IF NOT EXISTS notification_deliveries_digest_idx ON notification_deliveries(digest_id)",
  "CREATE INDEX IF NOT EXISTS notification_deliveries_channel_status_idx ON notification_deliveries(channel, status)",
  "CREATE TABLE IF NOT EXISTS notification_rules (id TEXT PRIMARY KEY, name TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, source TEXT, event_type TEXT, severity TEXT, project_slug TEXT, condition TEXT, channels TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)",
  "CREATE TABLE IF NOT EXISTS notification_preferences (id TEXT PRIMARY KEY, enabled INTEGER NOT NULL DEFAULT 1, preset TEXT NOT NULL, digest_window INTEGER NOT NULL DEFAULT 300, channels TEXT NOT NULL, quiet_hours TEXT, sounds TEXT, updated_at INTEGER NOT NULL)",
  "CREATE TABLE IF NOT EXISTS webhook_endpoints (id TEXT PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL, secret TEXT NOT NULL, events TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL)",
  "CREATE TABLE IF NOT EXISTS notification_snoozes (source TEXT PRIMARY KEY, snoozed_at INTEGER NOT NULL, expires_at INTEGER NOT NULL)",
  "CREATE TABLE IF NOT EXISTS embeddings (id TEXT PRIMARY KEY, source TEXT NOT NULL, source_id TEXT NOT NULL, text TEXT NOT NULL, embedding TEXT NOT NULL, model_id TEXT NOT NULL, dimensions INTEGER NOT NULL, project_slug TEXT, metadata TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
  "CREATE UNIQUE INDEX IF NOT EXISTS embeddings_source_id_idx ON embeddings(source, source_id)",
  "CREATE INDEX IF NOT EXISTS embeddings_source_idx ON embeddings(source)",
  "CREATE INDEX IF NOT EXISTS embeddings_project_idx ON embeddings(project_slug)",
  "CREATE INDEX IF NOT EXISTS llm_conversations_project_idx ON llm_conversations(project_slug)",
  "CREATE INDEX IF NOT EXISTS notification_rules_project_idx ON notification_rules(project_slug)",
].join(";\n");

export const SQLITE_MIGRATION_SQL = SQLITE_CORE_MIGRATION_SQL;
