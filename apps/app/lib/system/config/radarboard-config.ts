import { existsSync, mkdirSync, readFileSync, watch, writeFileSync } from "node:fs";
import type { DatabaseConfig, RadarboardConfig } from "@radarboard/types/database";
import { z } from "zod";
import { getWebEnv, WEB_ENV_KEYS } from "@/lib/env";
import { getRadarboardDataDir, getRuntimeConfigPath } from "@/lib/runtime-data-paths";

// ---------------------------------------------------------------------------
// Zod schema for config validation
// ---------------------------------------------------------------------------

const DatabaseConfigSchema = z.object({
  provider: z.enum(["sqlite", "turso", "supabase", "planetscale"]),
  sqlite: z.object({ filename: z.string() }).optional(),
  turso: z.object({ url: z.string(), authToken: z.string() }).optional(),
  supabase: z.object({ url: z.string(), anonKey: z.string() }).optional(),
  planetscale: z
    .object({
      host: z.string(),
      username: z.string(),
      password: z.string(),
    })
    .optional(),
});

const RadarboardConfigSchema = z.object({
  database: DatabaseConfigSchema,
});

// ---------------------------------------------------------------------------
// Config path and defaults
// ---------------------------------------------------------------------------

function getConfigPath(): string {
  return getRuntimeConfigPath();
}

const DEFAULT_CONFIG: RadarboardConfig = {
  database: {
    provider: "sqlite",
  },
};

// ---------------------------------------------------------------------------
// Cached singleton with validation
// ---------------------------------------------------------------------------

let cachedConfig: RadarboardConfig | null = null;
let watcherActive = false;

/** Read and validate the .radarboard.json config file. Returns defaults if file doesn't exist or is invalid. */
export function readConfig(): RadarboardConfig {
  if (cachedConfig) return cachedConfig;

  const configPath = getConfigPath();

  if (!existsSync(configPath)) {
    cachedConfig = DEFAULT_CONFIG;
    return cachedConfig;
  }

  try {
    const raw = readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw);
    const result = RadarboardConfigSchema.safeParse(parsed);

    if (result.success) {
      cachedConfig = result.data as RadarboardConfig;
    } else {
      const _issues = result.error.issues
        .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
        .join("\n");
      cachedConfig = DEFAULT_CONFIG;
    }

    return cachedConfig;
  } catch {
    cachedConfig = DEFAULT_CONFIG;
    return cachedConfig;
  }
}

/** Invalidate the cached config so the next readConfig() re-reads from disk. */
export function invalidateConfigCache(): void {
  cachedConfig = null;
}

/**
 * Start watching the config file for changes (dev mode only).
 * On change, invalidates the cache and optionally emits an SSE event.
 */
export function startConfigWatcher(
  onReload?: (config: RadarboardConfig) => void
): (() => void) | null {
  if (watcherActive) return null;
  // biome-ignore lint/style/noProcessEnv: file watching is a development-only runtime concern
  if (process.env.NODE_ENV !== "development") return null;

  const configPath = getConfigPath();
  if (!existsSync(configPath)) return null;

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const watcher = watch(configPath, () => {
    // Debounce 300ms to avoid rapid successive reloads
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      invalidateConfigCache();
      const newConfig = readConfig();
      onReload?.(newConfig);
    }, 300);
  });

  watcherActive = true;

  return () => {
    watcher.close();
    watcherActive = false;
    if (debounceTimer) clearTimeout(debounceTimer);
  };
}

// ---------------------------------------------------------------------------
// Write / check / getDatabase — unchanged API
// ---------------------------------------------------------------------------

/** Write the .radarboard.json config file. Invalidates cache. */
export function writeConfig(config: RadarboardConfig): void {
  const configPath = getConfigPath();
  mkdirSync(getRadarboardDataDir(), { recursive: true });
  writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
  invalidateConfigCache();
}

/** Check if the config file exists. */
export function configExists(): boolean {
  return existsSync(getConfigPath());
}

/** Get just the database config. Env var override takes precedence. */
export function getDatabaseConfig(): DatabaseConfig {
  const envProvider = getWebEnv(WEB_ENV_KEYS.database.provider);
  if (envProvider) {
    const tursoUrl = getWebEnv(WEB_ENV_KEYS.database.tursoUrl);
    return {
      provider: envProvider as DatabaseConfig["provider"],
      turso: tursoUrl
        ? { url: tursoUrl, authToken: getWebEnv(WEB_ENV_KEYS.database.tursoAuthToken) ?? "" }
        : undefined,
    };
  }

  try {
    return readConfig().database;
  } catch {
    return DEFAULT_CONFIG.database;
  }
}

/** Update just the database config section. */
export function setDatabaseConfig(dbConfig: DatabaseConfig): void {
  const config = readConfig();
  config.database = dbConfig;
  writeConfig(config);
}
