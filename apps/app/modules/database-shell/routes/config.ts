import { createLogger } from "@radarboard/logger/logger";
import type { DatabaseConfig } from "@radarboard/types/database";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSettingsRepo } from "@/data/core/repository";
import { resetRepositories } from "@/db/repository";
import { errorJson, parseBody } from "@/lib/api";
import {
  configExists,
  getDatabaseConfig,
  readConfig,
  setDatabaseConfig,
  writeConfig,
} from "@/lib/radarboard-config";

const log = createLogger("api/database/config");

const VALID_PROVIDERS = ["sqlite", "supabase", "turso", "planetscale"] as const;

const DatabaseConfigSchema = z
  .object({
    provider: z
      .string({
        error: (iss) =>
          iss.input === undefined || iss.input === null
            ? `Invalid provider. Must be one of: ${VALID_PROVIDERS.join(", ")}`
            : iss.message,
      })
      .superRefine((v, ctx) => {
        if (!(VALID_PROVIDERS as readonly string[]).includes(v)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Invalid provider. Must be one of: ${VALID_PROVIDERS.join(", ")}`,
          });
        }
      }),
    config: z.record(z.string(), z.string()).optional(),
  })
  .passthrough();

function isConfigured(config: DatabaseConfig): boolean {
  switch (config.provider) {
    case "supabase":
      return Boolean(config.supabase?.url && config.supabase?.anonKey);
    case "turso":
      return Boolean(config.turso?.url && config.turso?.authToken);
    case "planetscale":
      return Boolean(
        config.planetscale?.host && config.planetscale?.username && config.planetscale?.password
      );
    default:
      return true;
  }
}

export async function handleGetDatabaseConfig() {
  try {
    // On desktop first-run, the default provider is SQLite and no config file
    // exists. Auto-create it so the app skips the database SetupWizard and goes
    // straight to the onboarding wizard (SQLite needs no user configuration).
    if (!configExists()) {
      const defaultConfig = readConfig(); // Returns DEFAULT_CONFIG when no file exists
      if (defaultConfig.database.provider === "sqlite") {
        writeConfig(defaultConfig);
        log.info("Auto-created default SQLite config for first-run");
      }
    }

    const config = getDatabaseConfig();
    const hasConfig = configExists();
    const configured = isConfigured(config);

    let onboardingCompleted = false;
    try {
      const wl = await getSettingsRepo().getWidgetLayout();
      onboardingCompleted = wl?.preferences?.onboardingCompleted === true;
    } catch {
      // Settings may not be ready yet — treat as not completed
    }

    return NextResponse.json({
      provider: config.provider,
      configured,
      hasConfig,
      onboardingCompleted,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    log.error("Failed to get database config", { error });
    return errorJson(500, message);
  }
}

export async function handleSetDatabaseConfig(request: Request) {
  try {
    const parsed = await parseBody(request, DatabaseConfigSchema);
    if (!parsed.ok) return parsed.response;

    const { provider, config } = parsed.data as {
      provider: (typeof VALID_PROVIDERS)[number];
      config?: Record<string, string>;
    };

    const dbConfig: DatabaseConfig = { provider };

    switch (provider) {
      case "supabase":
        dbConfig.supabase = {
          url: config?.url ?? "",
          anonKey: config?.anonKey ?? "",
        };
        break;
      case "turso":
        dbConfig.turso = {
          url: config?.url ?? "",
          authToken: config?.authToken ?? "",
        };
        break;
      case "planetscale":
        dbConfig.planetscale = {
          host: config?.host ?? "",
          username: config?.username ?? "",
          password: config?.password ?? "",
        };
        break;
      default:
        break;
    }

    setDatabaseConfig(dbConfig);
    resetRepositories();

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    log.error("Failed to save database config", { error });
    return errorJson(500, message);
  }
}
