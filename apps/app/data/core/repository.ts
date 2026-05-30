import { createGitHubStarHistoryRepository } from "@radarboard/integration-github/stars";
import type {
  CacheRepository,
  CredentialRepository,
  DatabaseAdapter,
  DatabaseConfig,
  DebugRepository,
  GitHubStarHistoryRepository,
  LlmRepository,
  NotificationRepository,
  PluginRepository,
  SettingsRepository,
} from "@radarboard/types/database";
import { PlanetscaleCacheRepository } from "@/data/cache/planetscale-cache";
import { SqliteCacheRepository } from "@/data/cache/sqlite-cache";
import { SupabaseCacheRepository } from "@/data/cache/supabase-cache";
import { TursoCacheRepository } from "@/data/cache/turso-cache";
import { getDb } from "@/data/core/client";
import { PlanetscaleCredentialRepository } from "@/data/credentials/planetscale-credentials";
import { SqliteCredentialRepository } from "@/data/credentials/sqlite-credentials";
import { SupabaseCredentialRepository } from "@/data/credentials/supabase-credentials";
import { TursoCredentialRepository } from "@/data/credentials/turso-credentials";
import { PlanetscaleDebugRepository } from "@/data/debug/planetscale-debug";
import { SqliteDebugRepository } from "@/data/debug/sqlite-debug";
import { SupabaseDebugRepository } from "@/data/debug/supabase-debug";
import { TursoDebugRepository } from "@/data/debug/turso-debug";
import { PlanetscaleLlmRepository } from "@/data/llm/planetscale-llm";
import { SqliteLlmRepository } from "@/data/llm/sqlite-llm";
import { SupabaseLlmRepository } from "@/data/llm/supabase-llm";
import { TursoLlmRepository } from "@/data/llm/turso-llm";
import { SqliteNotificationRepository } from "@/data/providers/sqlite/sqlite-notifications";
import { SqlitePluginRepository } from "@/data/providers/sqlite/sqlite-plugins";
import { PlanetscaleSettingsRepository } from "@/data/settings/planetscale-settings";
import { SqliteSettingsRepository } from "@/data/settings/sqlite-settings";
import { SupabaseSettingsRepository } from "@/data/settings/supabase-settings";
import { TursoSettingsRepository } from "@/data/settings/turso-settings";
import { getDatabaseConfig } from "@/lib/radarboard-config";

// Singleton instances -- lazily initialized, reset when provider changes
let _cache: CacheRepository | null = null;
let _githubStarHistory: GitHubStarHistoryRepository | null = null;
let _settings: SettingsRepository | null = null;
let _credentials: CredentialRepository | null = null;
let _llm: LlmRepository | null = null;
let _debug: DebugRepository | null = null;
let _plugins: PluginRepository | null = null;
let _notifications: NotificationRepository | null = null;
let _currentProvider: string | null = null;
let _credentialsMigrated = false;

function ensureProvider(): string {
  try {
    const config = getDatabaseConfig();
    const provider = config.provider;

    // Reset singletons if provider changed
    if (_currentProvider !== null && _currentProvider !== provider) {
      _cache = null;
      _githubStarHistory = null;
      _settings = null;
      _credentials = null;
      _llm = null;
      _debug = null;
      _notifications = null;
    }
    _currentProvider = provider;

    return provider;
  } catch {
    _currentProvider = "sqlite";
    return "sqlite";
  }
}

function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    // Fall back to a deterministic key derived from DATABASE_PROVIDER for development
    // In production, ENCRYPTION_KEY should always be set
    return "dev-fallback-key-not-for-production-use-set-ENCRYPTION_KEY";
  }
  return key;
}

/**
 * Get the cache repository for the configured database provider.
 */
export function getCacheRepo(): CacheRepository {
  const provider = ensureProvider();

  if (!_cache) {
    const config = getDatabaseConfig();

    switch (provider) {
      case "supabase": {
        if (!config.supabase) throw new Error("Supabase config missing");
        _cache = new SupabaseCacheRepository(config.supabase);
        break;
      }
      case "turso": {
        if (!config.turso) throw new Error("Turso config missing");
        _cache = new TursoCacheRepository(config.turso);
        break;
      }
      case "planetscale": {
        if (!config.planetscale) throw new Error("PlanetScale config missing");
        _cache = new PlanetscaleCacheRepository(config.planetscale);
        break;
      }
      default: {
        _cache = new SqliteCacheRepository();
        break;
      }
    }
  }

  return _cache;
}

/**
 * Get the GitHub star history repository for the configured database provider.
 */
export function getGitHubStarHistoryRepo(): GitHubStarHistoryRepository {
  ensureProvider();

  if (!_githubStarHistory) {
    const config = getDatabaseConfig() as DatabaseConfig;
    _githubStarHistory = createGitHubStarHistoryRepository(config, { getDb });
  }

  return _githubStarHistory;
}

/**
 * Get the settings repository for the configured database provider.
 */
export function getSettingsRepo(): SettingsRepository {
  const provider = ensureProvider();

  if (!_settings) {
    const config = getDatabaseConfig();

    switch (provider) {
      case "supabase": {
        if (!config.supabase) throw new Error("Supabase config missing");
        _settings = new SupabaseSettingsRepository(config.supabase);
        break;
      }
      case "turso": {
        if (!config.turso) throw new Error("Turso config missing");
        _settings = new TursoSettingsRepository(config.turso);
        break;
      }
      case "planetscale": {
        if (!config.planetscale) throw new Error("PlanetScale config missing");
        _settings = new PlanetscaleSettingsRepository(config.planetscale);
        break;
      }
      default: {
        _settings = new SqliteSettingsRepository();
        break;
      }
    }
  }

  return _settings;
}

/**
 * Get the credential repository for the configured database provider.
 */
export function getCredentialRepo(): CredentialRepository {
  const provider = ensureProvider();
  const encryptionKey = getEncryptionKey();

  if (!_credentials) {
    const config = getDatabaseConfig();

    switch (provider) {
      case "supabase": {
        if (!config.supabase) throw new Error("Supabase config missing");
        _credentials = new SupabaseCredentialRepository(config.supabase, encryptionKey);
        break;
      }
      case "turso": {
        if (!config.turso) throw new Error("Turso config missing");
        _credentials = new TursoCredentialRepository(config.turso, encryptionKey);
        break;
      }
      case "planetscale": {
        if (!config.planetscale) throw new Error("PlanetScale config missing");
        _credentials = new PlanetscaleCredentialRepository(config.planetscale, encryptionKey);
        break;
      }
      default: {
        _credentials = new SqliteCredentialRepository(encryptionKey);
        break;
      }
    }

    // Migrate legacy widget-scoped keys to service-level keys (fire-and-forget)
    migrateCredentialKeys(_credentials).catch(() => {
      /* fire-and-forget */
    });
  }

  return _credentials;
}

/**
 * Migrate widget-scoped credential keys (e.g., "shipping/vercel") to
 * service-level keys (e.g., "vercel"). Runs once per process lifetime.
 * Idempotent: skips if target key already exists.
 */
const LEGACY_KEY_MAP: Record<string, string> = {
  "revenue/revenuecat": "revenuecat",
  "detail/sentry": "sentry",
  "analytics/openpanel": "openpanel",
  "detail/betterstack": "betterstack",
  "revenue/opencollective": "opencollective",
  "sponsorship/opencollective": "opencollective",
  "shipping/linear": "linear",
  "ideas/linear": "linear",
  "shipping/vercel": "vercel",
  "shipping/github": "github",
  "github-stars/github": "github",
  "detail/app-store-connect": "app-store-connect",
  "seo/google-search-console": "google-search-console",
};

async function migrateCredentialKeys(repo: CredentialRepository): Promise<void> {
  if (_credentialsMigrated) return;
  _credentialsMigrated = true;

  try {
    const keys = await repo.listCredentialKeys();
    const legacyKeys = keys.filter((k) => k.includes("/") && LEGACY_KEY_MAP[k]);

    if (legacyKeys.length === 0) return;

    for (const oldKey of legacyKeys) {
      const newKey = LEGACY_KEY_MAP[oldKey];
      if (!newKey) continue;

      // Skip if new key already exists (avoids overwriting)
      const existingNew = await repo.getCredential(newKey);
      if (existingNew) {
        // Just delete the old key since the new one already has data
        await repo.deleteCredential(oldKey);
        continue;
      }

      // Copy old credentials to new key, then delete old
      const creds = await repo.getCredential(oldKey);
      if (creds) {
        await repo.setCredential(newKey, creds);
        await repo.deleteCredential(oldKey);
      }
    }
  } catch {
    // Migration is best-effort -- don't block startup
    _credentialsMigrated = false;
  }
}

/**
 * Get the LLM repository for the configured database provider.
 */
export function getLlmRepo(): LlmRepository {
  const provider = ensureProvider();

  if (!_llm) {
    const config = getDatabaseConfig();

    switch (provider) {
      case "supabase": {
        if (!config.supabase) throw new Error("Supabase config missing");
        _llm = new SupabaseLlmRepository(config.supabase);
        break;
      }
      case "turso": {
        if (!config.turso) throw new Error("Turso config missing");
        _llm = new TursoLlmRepository(config.turso);
        break;
      }
      case "planetscale": {
        if (!config.planetscale) throw new Error("PlanetScale config missing");
        _llm = new PlanetscaleLlmRepository(config.planetscale);
        break;
      }
      default: {
        _llm = new SqliteLlmRepository();
        break;
      }
    }
  }

  // _llm is always set in the switch above
  return _llm as LlmRepository;
}

/**
 * Get the debug event repository for the configured database provider.
 */
export function getDebugRepo(): DebugRepository {
  const provider = ensureProvider();

  if (!_debug) {
    const config = getDatabaseConfig();

    switch (provider) {
      case "supabase": {
        if (!config.supabase) throw new Error("Supabase config missing");
        _debug = new SupabaseDebugRepository(config.supabase);
        break;
      }
      case "turso": {
        if (!config.turso) throw new Error("Turso config missing");
        _debug = new TursoDebugRepository(config.turso);
        break;
      }
      case "planetscale": {
        if (!config.planetscale) throw new Error("PlanetScale config missing");
        _debug = new PlanetscaleDebugRepository(config.planetscale);
        break;
      }
      default: {
        _debug = new SqliteDebugRepository();
        break;
      }
    }
  }

  return _debug as DebugRepository;
}

/**
 * Get the plugin data repository for the configured database provider.
 * Currently only SQLite is implemented — other providers will fall back to SQLite.
 */
export function getPluginRepo(): PluginRepository {
  if (!_plugins) {
    // TODO: Add Supabase/Turso/PlanetScale implementations when needed
    _plugins = new SqlitePluginRepository();
  }
  return _plugins;
}

/**
 * Get the notification repository for the configured database provider.
 * Currently only SQLite is implemented.
 */
export function getNotificationRepo(): NotificationRepository | null {
  const provider = ensureProvider();

  if (!_notifications) {
    _notifications = new SqliteNotificationRepository();
  }

  return provider === "sqlite" ? _notifications : null;
}

/** Reset cached repository instances (call after provider change). */
export function resetRepositories(): void {
  _cache = null;
  _githubStarHistory = null;
  _settings = null;
  _credentials = null;
  _llm = null;
  _debug = null;
  _plugins = null;
  _notifications = null;
  _currentProvider = null;
  _credentialsMigrated = false;
}

/**
 * Get the full database adapter (all repos) for the configured provider.
 */
export function getDatabaseAdapter(): DatabaseAdapter {
  const provider = ensureProvider() as DatabaseAdapter["provider"];
  return {
    provider,
    cache: getCacheRepo(),
    githubStarHistory: getGitHubStarHistoryRepo(),
    settings: getSettingsRepo(),
    credentials: getCredentialRepo(),
    llm: getLlmRepo(),
    debug: getDebugRepo(),
    plugins: getPluginRepo(),
    notifications: getNotificationRepo() ?? undefined,
  };
}
