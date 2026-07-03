import {
  createDefaultDashboardPage,
  createEmptyDashboardWidgetLayout,
} from "@radarboard/hooks/dashboard-layout";
import { createLogger } from "@radarboard/logger/logger";
import { PLUGIN_REGISTRY } from "@radarboard/plugin-sdk/registry";
import { ALL_PROJECTS_SLUG } from "@radarboard/types/dashboard";
import type { RoutingConfig, WidgetLayoutConfig } from "@radarboard/types/database";
import { BASIC_3X3 } from "@radarboard/widget-engine/layouts";
import {
  getCacheRepo,
  getCredentialRepo,
  getDebugRepo,
  getGitHubStarHistoryRepo,
  getLlmRepo,
  getNotificationRepo,
  getPluginRepo,
  getSettingsRepo,
} from "@/data/core/repository";

const log = createLogger("system/factory-reset");

export interface FactoryResetResult {
  /** Names of the stores that were cleared successfully. */
  cleared: string[];
  /** Human-readable failures (one per store that errored). */
  errors: string[];
}

/** A pristine, first-run dashboard layout — empty grid, no onboarding flag. */
function createDefaultLayoutConfig(): WidgetLayoutConfig {
  return {
    configs: {},
    layouts: [BASIC_3X3],
    projectLayouts: {
      [ALL_PROJECTS_SLUG]: {
        pages: [
          createDefaultDashboardPage(
            {
              layoutId: BASIC_3X3.id,
              widgetLayouts: { [BASIC_3X3.id]: createEmptyDashboardWidgetLayout(BASIC_3X3) },
            },
            [BASIC_3X3]
          ),
        ],
      },
    },
    preferences: { timezone: "auto", polling: {} },
  };
}

/**
 * Full factory reset — erases ALL user data and returns the app to first-run
 * state. Distinct from onboarding's "Start fresh", which only clears cached/demo
 * data and keeps the user's connected services.
 *
 * Each store is cleared independently so one failure doesn't abort the rest; the
 * caller gets a per-store success/error breakdown.
 */
export async function performFactoryReset(): Promise<FactoryResetResult> {
  const cleared: string[] = [];
  const errors: string[] = [];

  async function step(name: string, fn: () => Promise<void>): Promise<void> {
    try {
      await fn();
      cleared.push(name);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${name}: ${message}`);
      log.error("Factory reset step failed", { step: name, error });
    }
  }

  await step("cache", () => getCacheRepo().clear());

  await step("credentials", async () => {
    const repo = getCredentialRepo();
    const keys = await repo.listCredentialKeys();
    await Promise.all(keys.map((key) => repo.deleteCredential(key)));
  });

  await step("pluginData", async () => {
    const repo = getPluginRepo();
    for (const [pluginId] of PLUGIN_REGISTRY) {
      const items = await repo.list(pluginId, "");
      await Promise.all(items.map((item) => repo.delete(pluginId, item.key)));
    }
  });

  await step("githubStarHistory", () => getGitHubStarHistoryRepo().clearAll());
  await step("llm", () => getLlmRepo().clearAll());
  await step("notifications", async () => {
    await getNotificationRepo()?.clearAll();
  });
  await step("debug", () => getDebugRepo().clearAll());

  await step("settings", async () => {
    const settings = getSettingsRepo();
    await settings.setWidgetLayout(createDefaultLayoutConfig());
    await settings.setProjectOrder([]);
    await settings.setProjectIntegrations({});
    await settings.setIntegrationConnections([]);
    await settings.setProjectContextMap({});
    await settings.setLlmConfig({});
    await settings.setDebugConfig({});
    await settings.setRoutingConfig({ rules: [] } satisfies RoutingConfig);
    await settings.setWorkflows({});
    await settings.setFeaturePreferences({});
  });

  log.info("Factory reset completed", { cleared, errors });
  return { cleared, errors };
}
