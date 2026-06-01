/* biome-ignore-all lint/style/useNamingConvention: environment variable keys are uppercase by convention. */
/* biome-ignore-all lint/style/noProcessEnv: this module is the centralized process.env boundary for the app. */
/**
 * Centralized environment variable definitions for the web application.
 *
 * All web-app-specific env vars (database, backup, encryption) should be
 * referenced through this module instead of raw `process.env.*` access.
 *
 * Validates env vars with Zod on first access. Missing required vars
 * produce a clear error listing all problems at once.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Schema — defines all known env vars with required/optional semantics
// ---------------------------------------------------------------------------

const envSchema = z.object({
  // Database (optional — defaults to SQLite if not set)
  DATABASE_PROVIDER: z.string().optional(),
  TURSO_DATABASE_URL: z.string().url().optional(),
  TURSO_AUTH_TOKEN: z.string().optional(),

  // Encryption (required for credential storage)
  ENCRYPTION_KEY: z.string().min(1, "ENCRYPTION_KEY is required for credential encryption"),

  // Backup (optional — backup feature disabled if not set)
  BACKUP_CRON_URL: z.string().url().optional(),
  BACKUP_SECRET: z.string().optional(),
  BACKUP_INTERVAL_MS: z.string().optional(),

  // OAuth (optional — OpenAI provider auth disabled if not set)
  OAUTH_OPENAI_CLIENT_ID: z.string().optional(),
  OAUTH_OPENAI_CLIENT_SECRET: z.string().optional(),

  // MCP & API (required for plugin token signing and MCP OAuth)
  NEXT_PUBLIC_APP_URL: z.string().optional(),
  RADARBOARD_API_SECRET: z
    .string()
    .min(1, "RADARBOARD_API_SECRET is required for plugin token signing"),

  // Webhook relay (optional — relay polling disabled if not set)
  RELAY_POLL_SECRET: z.string().optional(),

  // Extension discovery (optional — defaults to Radarboard/community-extensions)
  RADARBOARD_COMMUNITY_EXTENSIONS_CATALOG_URL: z.string().url().optional(),

  // Feature flags (optional — all default to enabled)
  NEXT_PUBLIC_FEATURE_ASSISTANT: z.string().optional(),
  NEXT_PUBLIC_FEATURE_SKILLS: z.string().optional(),
  NEXT_PUBLIC_FEATURE_WORKFLOWS: z.string().optional(),
  NEXT_PUBLIC_FEATURE_BRIEFING: z.string().optional(),
  NEXT_PUBLIC_FEATURE_NOTIFICATIONS: z.string().optional(),
  NEXT_PUBLIC_FEATURE_MCP_SERVERS: z.string().optional(),
  NEXT_PUBLIC_FEATURE_MEMORY: z.string().optional(),
  NEXT_PUBLIC_FEATURE_ONBOARDING: z.string().optional(),
  NEXT_PUBLIC_FEATURE_DEMO_MODE: z.string().optional(),

  // TTS / Piper (optional — read-aloud disabled if not set)
  PIPER_COMMAND: z.string().optional(),
  PIPER_MODEL_PATH: z.string().optional(),
  PIPER_SPEAKER: z.string().optional(),
});

type WebEnv = z.infer<typeof envSchema>;

// ---------------------------------------------------------------------------
// Validation — runs once, caches result
// ---------------------------------------------------------------------------

let cachedEnv: WebEnv | null = null;
let validationErrors: string[] | null = null;

/**
 * Validate all env vars against the schema.
 * Returns the validated env object or throws with all errors listed.
 */
export function validateEnv(): WebEnv {
  if (cachedEnv) return cachedEnv;

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const issues = result.error.issues.map(
      (issue) => `  - ${issue.path.join(".")}: ${issue.message}`
    );
    validationErrors = issues;
    throw new Error(
      `Environment validation failed:\n${issues.join("\n")}\n\nCheck your .env file or environment variables.`
    );
  }

  cachedEnv = result.data;
  return cachedEnv;
}

/** Get validation errors without throwing (for instrumentation logging). */
export function getEnvValidationErrors(): string[] | null {
  return validationErrors;
}

// ---------------------------------------------------------------------------
// Backward-compatible API — preserves existing getWebEnv/WEB_ENV_KEYS
// ---------------------------------------------------------------------------

export const WEB_ENV_KEYS = {
  database: {
    provider: "DATABASE_PROVIDER",
    tursoUrl: "TURSO_DATABASE_URL",
    tursoAuthToken: "TURSO_AUTH_TOKEN",
  },
  backup: {
    cronUrl: "BACKUP_CRON_URL",
    secret: "BACKUP_SECRET",
    intervalMs: "BACKUP_INTERVAL_MS",
  },
  encryption: {
    key: "ENCRYPTION_KEY",
  },
  oauth: {
    openaiClientId: "OAUTH_OPENAI_CLIENT_ID",
    openaiClientSecret: "OAUTH_OPENAI_CLIENT_SECRET",
  },
  mcp: {
    appUrl: "NEXT_PUBLIC_APP_URL",
    apiSecret: "RADARBOARD_API_SECRET",
  },
  relay: {
    secret: "RELAY_POLL_SECRET",
  },
  extensions: {
    communityCatalogUrl: "RADARBOARD_COMMUNITY_EXTENSIONS_CATALOG_URL",
  },
  assistant: {
    enabled: "NEXT_PUBLIC_FEATURE_ASSISTANT",
  },
  tts: {
    piperCommand: "PIPER_COMMAND",
    piperModelPath: "PIPER_MODEL_PATH",
    piperSpeaker: "PIPER_SPEAKER",
  },
} as const;

/**
 * Read an environment variable by its canonical name.
 * Returns `undefined` when the variable is missing or empty.
 */
export function getWebEnv(name: string): string | undefined {
  const value = process.env[name];
  return value || undefined;
}

export function getWebBooleanEnv(name: string): boolean {
  return getWebEnv(name) === "1";
}
