import {
  PLANETSCALE_GITHUB_STARS_MIGRATION_SQL,
  SUPABASE_GITHUB_STARS_MIGRATION_SQL,
} from "@radarboard/integration-github/stars";
import { createLogger } from "@radarboard/logger/logger";
import { NextResponse } from "next/server";
import { z } from "zod";
import { SQLITE_MIGRATION_SQL } from "@/db/sqlite-migrate";
import { errorJson, parseBody } from "@/lib/api";

const log = createLogger("api/database/migrate");

const SQLITE_TURSO_SQL = SQLITE_MIGRATION_SQL;
const databaseMigrationSchema = z.object({
  provider: z.enum(["sqlite", "supabase", "turso", "planetscale"]),
  config: z.record(z.string(), z.string().optional()).default({}),
});

const SUPABASE_CORE_SQL = [
  "CREATE TABLE IF NOT EXISTS user_settings (id TEXT PRIMARY KEY, project_order TEXT, widget_layout TEXT, project_integrations TEXT, integration_connections TEXT, project_context_map TEXT, llm_config TEXT, debug_config TEXT, routing_config TEXT, updated_at BIGINT)",
  "CREATE TABLE IF NOT EXISTS api_cache (key TEXT PRIMARY KEY, route TEXT NOT NULL, data TEXT NOT NULL, fetched_at BIGINT NOT NULL, ttl_seconds INTEGER NOT NULL)",
  "CREATE INDEX IF NOT EXISTS api_cache_route_idx ON api_cache(route)",
  "CREATE TABLE IF NOT EXISTS widget_credentials (key TEXT PRIMARY KEY, encrypted_data TEXT NOT NULL, updated_at BIGINT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS llm_conversations (id TEXT PRIMARY KEY, title TEXT NOT NULL, project_slug TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS llm_messages (id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, role TEXT NOT NULL, parts TEXT NOT NULL, created_at TEXT NOT NULL)",
  "CREATE INDEX IF NOT EXISTS llm_messages_conv_idx ON llm_messages(conversation_id)",
  "CREATE TABLE IF NOT EXISTS llm_memory (id TEXT PRIMARY KEY, key TEXT NOT NULL, value TEXT NOT NULL, embedding TEXT, project_slug TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
  "CREATE UNIQUE INDEX IF NOT EXISTS llm_memory_key_idx ON llm_memory(key, project_slug)",
  "CREATE TABLE IF NOT EXISTS llm_skills (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL, instructions TEXT NOT NULL, enabled BOOLEAN NOT NULL DEFAULT TRUE, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
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

const SUPABASE_SQL = [SUPABASE_CORE_SQL, SUPABASE_GITHUB_STARS_MIGRATION_SQL]
  .filter(Boolean)
  .join(";\n");

const PLANETSCALE_CORE_SQL = [
  "CREATE TABLE IF NOT EXISTS user_settings (id VARCHAR(255) PRIMARY KEY, project_order TEXT, widget_layout TEXT, project_integrations TEXT, integration_connections TEXT, project_context_map TEXT, llm_config TEXT, debug_config TEXT, routing_config TEXT, updated_at BIGINT)",
  "CREATE TABLE IF NOT EXISTS api_cache (cache_key VARCHAR(512) PRIMARY KEY, route VARCHAR(255) NOT NULL, data LONGTEXT NOT NULL, fetched_at BIGINT NOT NULL, ttl_seconds INT NOT NULL, INDEX api_cache_route_idx (route))",
  "CREATE TABLE IF NOT EXISTS widget_credentials (cache_key VARCHAR(255) PRIMARY KEY, encrypted_data TEXT NOT NULL, updated_at BIGINT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS llm_conversations (id VARCHAR(255) PRIMARY KEY, title TEXT NOT NULL, project_slug VARCHAR(255), created_at VARCHAR(30) NOT NULL, updated_at VARCHAR(30) NOT NULL)",
  "CREATE TABLE IF NOT EXISTS llm_messages (id VARCHAR(255) PRIMARY KEY, conversation_id VARCHAR(255) NOT NULL, role VARCHAR(20) NOT NULL, parts LONGTEXT NOT NULL, created_at VARCHAR(30) NOT NULL, INDEX llm_messages_conv_idx (conversation_id))",
  "CREATE TABLE IF NOT EXISTS llm_memory (id VARCHAR(255) PRIMARY KEY, mem_key VARCHAR(255) NOT NULL, value TEXT NOT NULL, embedding LONGTEXT, project_slug VARCHAR(255), created_at VARCHAR(30) NOT NULL, updated_at VARCHAR(30) NOT NULL, UNIQUE INDEX llm_memory_key_idx (mem_key, project_slug))",
  "CREATE TABLE IF NOT EXISTS llm_skills (id VARCHAR(255) PRIMARY KEY, name VARCHAR(255) NOT NULL, description TEXT NOT NULL, instructions LONGTEXT NOT NULL, enabled TINYINT NOT NULL DEFAULT 1, created_at VARCHAR(30) NOT NULL, updated_at VARCHAR(30) NOT NULL)",
  "CREATE TABLE IF NOT EXISTS llm_artifacts (id VARCHAR(255) PRIMARY KEY, project_slug VARCHAR(255), mode VARCHAR(32) NOT NULL, title VARCHAR(255) NOT NULL, summary TEXT NOT NULL, body LONGTEXT NOT NULL, content_type VARCHAR(32) NOT NULL DEFAULT 'markdown', status VARCHAR(32) NOT NULL, source_conversation_id VARCHAR(255), created_at VARCHAR(30) NOT NULL, next_mode VARCHAR(32), next_reason TEXT, evidence_refs LONGTEXT NOT NULL, INDEX llm_artifacts_created_idx (created_at), INDEX llm_artifacts_project_idx (project_slug, created_at), INDEX llm_artifacts_mode_idx (mode, created_at), INDEX llm_artifacts_conv_idx (source_conversation_id, created_at))",
  "CREATE TABLE IF NOT EXISTS llm_traces (id VARCHAR(255) PRIMARY KEY, conversation_id VARCHAR(255), provider_id VARCHAR(255) NOT NULL, model_id VARCHAR(255) NOT NULL, prompt_tokens INT NOT NULL DEFAULT 0, completion_tokens INT NOT NULL DEFAULT 0, total_tokens INT NOT NULL DEFAULT 0, duration_ms INT NOT NULL DEFAULT 0, rating INT, created_at VARCHAR(30) NOT NULL, INDEX llm_traces_conv_idx (conversation_id))",
  "CREATE TABLE IF NOT EXISTS debug_events (id VARCHAR(255) PRIMARY KEY, occurred_at VARCHAR(30) NOT NULL, ingested_at VARCHAR(30) NOT NULL, level VARCHAR(16) NOT NULL, source VARCHAR(255) NOT NULL, event_type VARCHAR(255) NOT NULL, message TEXT NOT NULL, project_slug VARCHAR(255), trace_id VARCHAR(255), request_id VARCHAR(255), session_id VARCHAR(255), conversation_id VARCHAR(255), entity_type VARCHAR(255), entity_id VARCHAR(255), status VARCHAR(64), duration_ms INT, metadata LONGTEXT NOT NULL, INDEX debug_events_occurred_idx (occurred_at), INDEX debug_events_project_idx (project_slug, occurred_at), INDEX debug_events_source_idx (source, occurred_at), INDEX debug_events_type_idx (event_type, occurred_at), INDEX debug_events_trace_idx (trace_id, occurred_at), INDEX debug_events_conv_idx (conversation_id, occurred_at), INDEX debug_events_entity_idx (entity_type, entity_id, occurred_at))",
  "CREATE TABLE IF NOT EXISTS notification_events (id VARCHAR(255) PRIMARY KEY, source VARCHAR(255) NOT NULL, source_event_id VARCHAR(255), type VARCHAR(255) NOT NULL, severity VARCHAR(32) NOT NULL, project_slug VARCHAR(255), title TEXT NOT NULL, body TEXT, metadata LONGTEXT NOT NULL, occurred_at BIGINT NOT NULL, ingested_at BIGINT NOT NULL, batch_id VARCHAR(255), INDEX notification_events_source_type_idx (source, type), INDEX notification_events_severity_idx (severity), INDEX notification_events_project_idx (project_slug), INDEX notification_events_occurred_idx (occurred_at), UNIQUE INDEX notification_events_source_event_idx (source, source_event_id))",
  "CREATE TABLE IF NOT EXISTS notification_digests (id VARCHAR(255) PRIMARY KEY, source VARCHAR(255) NOT NULL, type VARCHAR(255) NOT NULL, severity VARCHAR(32) NOT NULL, project_slug VARCHAR(255), title TEXT NOT NULL, body TEXT, metadata LONGTEXT NOT NULL, event_count INT NOT NULL, window_start BIGINT NOT NULL, window_end BIGINT NOT NULL, created_at BIGINT NOT NULL, INDEX notification_digests_source_type_idx (source, type), INDEX notification_digests_created_idx (created_at))",
  "CREATE TABLE IF NOT EXISTS notification_deliveries (id VARCHAR(255) PRIMARY KEY, event_id VARCHAR(255), digest_id VARCHAR(255), channel VARCHAR(32) NOT NULL, status VARCHAR(32) NOT NULL, delivered_at BIGINT, read_at BIGINT, retry_count INT NOT NULL DEFAULT 0, last_attempt_at BIGINT, metadata LONGTEXT NOT NULL, INDEX notification_deliveries_event_idx (event_id), INDEX notification_deliveries_digest_idx (digest_id), INDEX notification_deliveries_channel_status_idx (channel, status))",
  "CREATE TABLE IF NOT EXISTS notification_rules (id VARCHAR(255) PRIMARY KEY, name VARCHAR(255) NOT NULL, enabled TINYINT NOT NULL DEFAULT 1, source VARCHAR(255), event_type VARCHAR(255), severity VARCHAR(32), project_slug VARCHAR(255), condition TEXT, channels TEXT NOT NULL, created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS notification_preferences (id VARCHAR(255) PRIMARY KEY, enabled TINYINT NOT NULL DEFAULT 1, preset VARCHAR(32) NOT NULL, digest_window INT NOT NULL DEFAULT 300, channels TEXT NOT NULL, quiet_hours TEXT, sounds TEXT, updated_at BIGINT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS webhook_endpoints (id VARCHAR(255) PRIMARY KEY, name VARCHAR(255) NOT NULL, url TEXT NOT NULL, secret VARCHAR(255) NOT NULL, events TEXT NOT NULL, enabled TINYINT NOT NULL DEFAULT 1, createdAt BIGINT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS notification_snoozes (source VARCHAR(255) PRIMARY KEY, snoozed_at BIGINT NOT NULL, expires_at BIGINT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS embeddings (id VARCHAR(255) PRIMARY KEY, source VARCHAR(255) NOT NULL, source_id VARCHAR(255) NOT NULL, text LONGTEXT NOT NULL, embedding LONGTEXT NOT NULL, model_id VARCHAR(255) NOT NULL, dimensions INT NOT NULL, project_slug VARCHAR(255), metadata LONGTEXT, created_at VARCHAR(30) NOT NULL, updated_at VARCHAR(30) NOT NULL, UNIQUE INDEX embeddings_source_id_idx (source, source_id), INDEX embeddings_source_idx (source), INDEX embeddings_project_idx (project_slug))",
  "CREATE INDEX IF NOT EXISTS llm_conversations_project_idx ON llm_conversations(project_slug)",
  "CREATE INDEX IF NOT EXISTS notification_rules_project_idx ON notification_rules(project_slug)",
].join(";\n");

const PLANETSCALE_SQL = [PLANETSCALE_CORE_SQL, PLANETSCALE_GITHUB_STARS_MIGRATION_SQL]
  .filter(Boolean)
  .join(";\n");

export async function handleRunDatabaseMigrations(request: Request) {
  try {
    const parsed = await parseBody(request, databaseMigrationSchema);
    if (!parsed.ok) return parsed.response;
    const { provider, config } = parsed.data;

    switch (provider) {
      case "sqlite": {
        const { getDb } = await import("@/db/client");
        const db = getDb();
        const statements = SQLITE_TURSO_SQL.split(";").filter((statement) => statement.trim());
        for (const statement of statements) {
          await db.run(/*sql*/ `${statement.trim()}`);
        }

        return NextResponse.json({ success: true, executed: true });
      }

      case "turso": {
        const url = config?.url;
        const authToken = config?.authToken;

        if (!url || !authToken) {
          return errorJson(400, "Missing url or authToken");
        }

        const { createClient } = await import("@libsql/client");
        const client = createClient({ url, authToken });
        const statements = SQLITE_TURSO_SQL.split(";").filter((statement) => statement.trim());
        for (const statement of statements) {
          await client.execute(statement.trim());
        }

        return NextResponse.json({ success: true, executed: true });
      }

      case "supabase": {
        return NextResponse.json({
          success: true,
          executed: false,
          migrationSql: SUPABASE_SQL,
          note: "Supabase does not support executing raw SQL via the REST API with an anon key. Please run the SQL above in the Supabase SQL Editor.",
        });
      }

      case "planetscale": {
        return NextResponse.json({
          success: true,
          executed: false,
          migrationSql: PLANETSCALE_SQL,
          note: "Please run the SQL above in the PlanetScale console or via the MySQL CLI.",
        });
      }

      default:
        return errorJson(400, "Unknown provider");
    }
  } catch (error) {
    log.error("Migration failed", { error });
    const message = error instanceof Error ? error.message : "Unknown error";
    return errorJson(500, message);
  }
}
