import { mkdirSync } from "node:fs";
import { type Client, createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import {
  LATEST_SCHEMA_VERSION,
  runVersionedMigrations,
  SQLITE_MIGRATION_SQL,
} from "@/data/providers/sqlite/sqlite-migrate";
import { getRadarboardDataDir, getSqliteUrl } from "@/lib/runtime-data-paths";
import {
  apiCache,
  debugEvents,
  llmArtifacts,
  llmConversations,
  llmMemory,
  llmMessages,
  llmSkills,
  llmTraces,
  notificationDeliveries,
  notificationDigests,
  notificationEvents,
  notificationPreferences,
  notificationRules,
  notificationSnoozes,
  pluginData,
  userSettings,
  webhookEndpoints,
  widgetCredentials,
} from "./schema";

const schema = {
  userSettings,
  widgetCredentials,
  apiCache,
  llmConversations,
  llmMessages,
  llmMemory,
  llmSkills,
  llmArtifacts,
  pluginData,
  notificationEvents,
  notificationDigests,
  notificationDeliveries,
  notificationRules,
  notificationPreferences,
  webhookEndpoints,
  notificationSnoozes,
  llmTraces,
  debugEvents,
};

// Lazy-initialized to avoid crashing at build time when env vars are missing.
// Falls back to a local SQLite file when TURSO_DATABASE_URL is not set.
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _ready: Promise<void> | null = null;

export function getDb() {
  if (!_db) {
    const remoteUrl = process.env.TURSO_DATABASE_URL;
    const isLocal = !remoteUrl;

    if (isLocal) {
      mkdirSync(getRadarboardDataDir(), { recursive: true });
    }

    const client = remoteUrl
      ? createClient({ url: remoteUrl, authToken: process.env.TURSO_AUTH_TOKEN })
      : createClient({ url: getSqliteUrl() });

    if (isLocal) {
      _ready = client
        .executeMultiple(
          "PRAGMA journal_mode = WAL; PRAGMA synchronous = normal; PRAGMA busy_timeout = 5000; PRAGMA cache_size = -20000; PRAGMA foreign_keys = on; PRAGMA temp_store = memory;"
        )
        .then(() => autoMigrate(client));
    }

    _db = drizzle(client, { schema });
  }

  return _db;
}

/**
 * Auto-create tables on first run, then run versioned migrations for schema upgrades.
 *
 * - Fresh install (no tables): creates all tables + sets user_version to latest
 * - Existing DB (tables exist): runs any pending incremental migrations
 */
async function autoMigrate(client: Client): Promise<void> {
  const tables = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='user_settings'"
  );

  if (tables.rows.length === 0) {
    // Fresh install — create all tables from scratch
    await client.executeMultiple(SQLITE_MIGRATION_SQL);
    await client.execute(`PRAGMA user_version = ${LATEST_SCHEMA_VERSION}`);
  } else {
    // Existing DB — run any pending incremental migrations
    await runVersionedMigrations(client);
  }
}

/** Resolves once local SQLite pragmas have been applied. No-op for remote Turso. */
export async function ensureDbReady(): Promise<void> {
  getDb();
  if (_ready !== null) await _ready;
}

export function resetDbConnectionForTests(): void {
  if (process.env.RADARBOARD_E2E !== "1" && process.env.NODE_ENV !== "test") {
    return;
  }

  _db = null;
  _ready = null;
}
