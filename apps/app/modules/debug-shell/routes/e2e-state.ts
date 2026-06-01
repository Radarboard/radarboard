import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import {
  createDefaultDashboardPage,
  createEmptyDashboardWidgetLayout,
} from "@radarboard/hooks/dashboard-layout";
import { createLogger } from "@radarboard/logger/logger";
import { ALL_PROJECTS_SLUG } from "@radarboard/types/dashboard";

const log = createLogger("api/e2e/state");

import type { WidgetLayoutConfig } from "@radarboard/types/database";
import { BASIC_3X3 } from "@radarboard/widget-engine/layouts";
import { NextResponse } from "next/server";
import { z } from "zod";
import { resetDbConnectionForTests } from "@/data/core/client";
import { SQLITE_MIGRATION_SQL } from "@/data/providers/sqlite/sqlite-migrate";
import { errorJson } from "@/lib/api";
import { getRadarboardConfigFilename, getSqliteFilename, isE2EMode } from "@/lib/e2e";
import { setDatabaseConfig } from "@/lib/radarboard-config";

const PostSchema = z.object({
  scenario: z.enum(["fresh", "dashboard"]),
});

const SQLITE_RESET_SUFFIXES = ["", "-journal", "-shm", "-wal"] as const;
const E2E_STATE_DIR = join(process.cwd(), ".radarboard-e2e");

function getE2EStatePaths() {
  const sqliteFilename = getSqliteFilename();

  return {
    configPath: join(E2E_STATE_DIR, getRadarboardConfigFilename()),
    sqlitePaths: SQLITE_RESET_SUFFIXES.map((suffix) =>
      join(E2E_STATE_DIR, `${sqliteFilename}${suffix}`)
    ),
  };
}

function clearE2EStateFiles(): void {
  const { configPath, sqlitePaths } = getE2EStatePaths();

  if (existsSync(configPath)) {
    rmSync(configPath, { force: true });
  }

  for (const sqlitePath of sqlitePaths) {
    if (existsSync(sqlitePath)) {
      rmSync(sqlitePath, { force: true });
    }
  }

  mkdirSync(E2E_STATE_DIR, { recursive: true });
}

function createSeedWidgetLayout(scenario: "fresh" | "dashboard"): WidgetLayoutConfig {
  const layout = createEmptyDashboardWidgetLayout(BASIC_3X3);

  if (scenario === "dashboard") {
    layout["cell-1"] = "revenue";
    layout["cell-2"] = "analytics";
    layout["cell-3"] = "seo";
    layout["cell-4"] = "shipping";
    layout["cell-5"] = "observability";
    layout["cell-6"] = "roadmap";
    layout["cell-7"] = "sponsorship";
    layout["cell-8"] = "bookmarks";
    layout["cell-9"] = "logs";
  }

  return {
    configs: {},
    layouts: [BASIC_3X3],
    projectLayouts: {
      [ALL_PROJECTS_SLUG]: {
        pages: [
          createDefaultDashboardPage(
            {
              layoutId: BASIC_3X3.id,
              widgetLayouts: {
                [BASIC_3X3.id]: layout,
              },
            },
            [BASIC_3X3]
          ),
        ],
      },
    },
    preferences: {
      timezone: "auto",
      polling: {},
      ...(scenario === "dashboard" && { onboardingCompleted: true }),
    },
  };
}

async function createBaseTables(): Promise<void> {
  const db = createClient({
    url: `file:${join(E2E_STATE_DIR, getSqliteFilename())}`,
  });

  await db.executeMultiple(SQLITE_MIGRATION_SQL);
}

async function seedE2ESettings(scenario: "fresh" | "dashboard"): Promise<void> {
  const db = createClient({
    url: `file:${join(E2E_STATE_DIR, getSqliteFilename())}`,
  });
  const now = Math.floor(Date.now() / 1000);

  await db.execute({
    sql: `
      INSERT INTO user_settings (
        id,
        project_order,
        widget_layout,
        project_integrations,
        project_context_map,
        llm_config,
        debug_config,
        feature_preferences,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        project_order = excluded.project_order,
        widget_layout = excluded.widget_layout,
        project_integrations = excluded.project_integrations,
        project_context_map = excluded.project_context_map,
        llm_config = excluded.llm_config,
        debug_config = excluded.debug_config,
        feature_preferences = excluded.feature_preferences,
        updated_at = excluded.updated_at
    `,
    args: [
      "default",
      JSON.stringify([]),
      JSON.stringify(createSeedWidgetLayout(scenario)),
      JSON.stringify({}),
      JSON.stringify({}),
      JSON.stringify({}),
      JSON.stringify({}),
      JSON.stringify({}),
      now,
    ],
  });
}

export async function handleE2EState(request: Request) {
  if (!isE2EMode()) {
    return errorJson(404, "E2E mode is not enabled");
  }

  try {
    const body = await request.json();
    const parsed = PostSchema.safeParse(body);

    if (!parsed.success) {
      return errorJson(400, "Invalid E2E scenario");
    }

    clearE2EStateFiles();
    resetDbConnectionForTests();

    if (parsed.data.scenario === "dashboard") {
      setDatabaseConfig({ provider: "sqlite" });
    }

    await createBaseTables();
    await seedE2ESettings(parsed.data.scenario);

    return NextResponse.json({
      success: true,
      scenario: parsed.data.scenario,
      e2eMode: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    log.error(message, { error });
    return errorJson(500, message);
  }
}
