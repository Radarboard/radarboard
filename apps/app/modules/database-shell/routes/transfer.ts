import { createLogger } from "@radarboard/logger/logger";
import { PLUGIN_REGISTRY } from "@radarboard/plugin-sdk/registry";
import type {
  DebugConfig,
  FeaturePreferencesConfig,
  GitHubRepoStarDailyRow,
  GitHubRepoStarEventRow,
  GitHubRepoStarSyncStateRow,
  GitHubRepoStarTrackingRow,
  IntegrationConnectionsConfig,
  LlmConfig,
  ProjectIntegrationsConfig,
  RoutingConfig,
  WidgetLayoutConfig,
} from "@radarboard/types/database";
import type { ProjectContextMap } from "@radarboard/types/project-context";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getCacheRepo,
  getCredentialRepo,
  getGitHubStarHistoryRepo,
  getPluginRepo,
  getSettingsRepo,
} from "@/db/repository";
import { errorJson, parseBody } from "@/lib/api";
import { getDatabaseConfig } from "@/lib/radarboard-config";

const log = createLogger("api/database/transfer");

const FULL_BACKUP_VERSION = "3" as const;

const OMITTED_DOMAINS = ["assistantHistory", "debugEventLog", "notificationState"] as const;

const metadataSchema = z.object({
  warnings: z.array(z.string()).optional(),
  omittedDomains: z.array(z.string()).optional(),
});

const cacheEntrySchema = z.object({
  key: z.string().min(1),
  route: z.string().min(1),
  data: z.string(),
  fetchedAt: z.number().int().nonnegative(),
  ttlSeconds: z.number().int().nonnegative(),
});

const credentialEntrySchema = z.object({
  key: z.string().min(1),
  values: z.record(z.string(), z.string()),
});

const pluginEntrySchema = z.object({
  key: z.string().min(1),
  value: z.string(),
});

const githubDailySchema = z.object({
  repoKey: z.string().min(1),
  day: z.string().min(1),
  totalStars: z.number().int(),
  starsGained: z.number().int(),
  source: z.string(),
  updatedAt: z.number().int().nonnegative(),
});

const githubSyncStateSchema = z.object({
  repoKey: z.string().min(1),
  backfillStatus: z.enum(["pending", "backfilling", "complete", "error"]),
  nextPage: z.number().int().nullable(),
  oldestSeenStarredAt: z.string().nullable(),
  lastSyncedAt: z.number().int().nullable(),
  lastError: z.string().nullable(),
  updatedAt: z.number().int().nonnegative(),
});

const githubStarEventSchema = z.object({
  sourceEventId: z.string().min(1),
  repoKey: z.string().min(1),
  action: z.enum(["created", "deleted"]),
  userLogin: z.string().nullable(),
  occurredAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});

const githubTrackingStateSchema = z.object({
  repoKey: z.string().min(1),
  trackingStartedAt: z.number().int().nullable(),
  baselineStars: z.number().int().nullable(),
  lastWebhookAt: z.number().int().nullable(),
  updatedAt: z.number().int().nonnegative(),
});

const settingsSnapshotSchema = z.object({
  projectOrder: z.array(z.string()).optional(),
  widgetLayout: z.record(z.string(), z.unknown()).nullable().optional(),
  projectIntegrations: z.record(z.string(), z.unknown()).optional(),
  integrationConnections: z.array(z.record(z.string(), z.unknown())).optional(),
  projectContextMap: z.record(z.string(), z.unknown()).optional(),
  featurePreferences: z.record(z.string(), z.boolean()).optional(),
  llmConfig: z.record(z.string(), z.unknown()).nullable().optional(),
  debugConfig: z.record(z.string(), z.unknown()).nullable().optional(),
  routingConfig: z.record(z.string(), z.unknown()).nullable().optional(),
  workflows: z.record(z.string(), z.unknown()).optional(),
  userPlan: z.string().nullable().optional(),
  licenseKey: z.string().nullable().optional(),
});

const fullBackupSchema = z.object({
  version: z.literal(FULL_BACKUP_VERSION),
  exportedAt: z.string(),
  sourceProvider: z.string(),
  metadata: metadataSchema.optional(),
  settings: settingsSnapshotSchema.optional(),
  credentials: z.array(credentialEntrySchema).optional(),
  pluginData: z.record(z.string(), z.array(pluginEntrySchema)).optional(),
  cache: z.array(cacheEntrySchema).optional(),
  githubStarHistory: z
    .object({
      daily: z.array(githubDailySchema),
      syncStates: z.array(githubSyncStateSchema),
      starEvents: z.array(githubStarEventSchema),
      trackingStates: z.array(githubTrackingStateSchema),
    })
    .optional(),
});

const fullBackupImportSchema = z
  .union([
    fullBackupSchema,
    z.object({
      mode: z.enum(["replace", "merge"]),
      backup: fullBackupSchema,
    }),
  ])
  .transform((value) =>
    "backup" in value
      ? value
      : {
          mode: "replace" as const,
          backup: value,
        }
  );

type FullBackupArtifact = z.infer<typeof fullBackupSchema>;
type FullBackupImportRequest = z.infer<typeof fullBackupImportSchema>;
type SettingsSnapshot = Awaited<ReturnType<typeof exportSettingsSnapshot>>;

async function exportSettingsSnapshot() {
  const repo = getSettingsRepo();

  const [
    projectOrder,
    widgetLayout,
    projectIntegrations,
    integrationConnections,
    projectContextMap,
    featurePreferences,
    llmConfig,
    debugConfig,
    routingConfig,
    workflows,
    userPlan,
    licenseKey,
  ] = await Promise.all([
    repo.getProjectOrder().catch(() => [] as string[]),
    repo.getWidgetLayout().catch(() => null),
    repo.getProjectIntegrations().catch(() => ({})),
    repo.getIntegrationConnections().catch(() => []),
    repo.getProjectContextMap().catch(() => ({})),
    repo.getFeaturePreferences().catch(() => ({})),
    repo.getLlmConfig().catch(() => null),
    repo.getDebugConfig().catch(() => null),
    repo.getRoutingConfig().catch(() => null),
    repo.getWorkflows().catch(() => ({})),
    repo.getUserPlan().catch(() => null),
    repo.getLicenseKey().catch(() => null),
  ]);

  return {
    projectOrder,
    widgetLayout,
    projectIntegrations,
    integrationConnections,
    projectContextMap,
    featurePreferences,
    llmConfig,
    debugConfig,
    routingConfig,
    workflows,
    userPlan,
    licenseKey,
  };
}

async function exportCredentials() {
  try {
    const credentialRepo = getCredentialRepo();
    const keys = await credentialRepo.listCredentialKeys();
    const entries = await Promise.all(
      keys.map(async (key) => ({
        key,
        values: (await credentialRepo.getCredential(key)) ?? {},
      }))
    );
    return entries.filter((entry) => Object.keys(entry.values).length > 0);
  } catch {
    return [];
  }
}

async function exportPluginData() {
  try {
    const pluginRepo = getPluginRepo();
    const pluginData: Record<string, Array<{ key: string; value: string }>> = {};

    for (const [pluginId] of PLUGIN_REGISTRY) {
      const items = await pluginRepo.list(pluginId, "");
      if (items.length > 0) {
        pluginData[pluginId] = items;
      }
    }

    return pluginData;
  } catch {
    return {};
  }
}

async function exportCacheEntries() {
  try {
    return await getCacheRepo().listEntries();
  } catch {
    return [];
  }
}

async function exportGitHubStarHistory() {
  try {
    const repo = getGitHubStarHistoryRepo();
    const repoKeys = await repo.listRepoKeys();

    if (repoKeys.length === 0) {
      return {
        daily: [] as GitHubRepoStarDailyRow[],
        syncStates: [] as GitHubRepoStarSyncStateRow[],
        starEvents: [] as GitHubRepoStarEventRow[],
        trackingStates: [] as GitHubRepoStarTrackingRow[],
      };
    }

    const [daily, syncStates, starEvents, trackingStates] = await Promise.all([
      repo.getDaily(repoKeys),
      repo.getSyncStates(repoKeys),
      repo.getStarEvents(repoKeys),
      repo.getTrackingStates(repoKeys),
    ]);

    return {
      daily,
      syncStates,
      starEvents,
      trackingStates,
    };
  } catch {
    return {
      daily: [] as GitHubRepoStarDailyRow[],
      syncStates: [] as GitHubRepoStarSyncStateRow[],
      starEvents: [] as GitHubRepoStarEventRow[],
      trackingStates: [] as GitHubRepoStarTrackingRow[],
    };
  }
}

function mergeStringList(existing: string[], incoming: string[]) {
  return [...new Set([...existing, ...incoming])];
}

function mergeById<T extends { id: string }>(existing: T[], incoming: T[]) {
  const merged = new Map(existing.map((item) => [item.id, item]));
  for (const item of incoming) {
    merged.set(item.id, item);
  }
  return [...merged.values()];
}

function mergeWidgetLayout(
  existing: WidgetLayoutConfig | null,
  incoming: WidgetLayoutConfig | null
): WidgetLayoutConfig | null {
  if (!existing) return incoming;
  if (!incoming) return existing;

  return {
    ...existing,
    ...incoming,
    layout: {
      ...(existing.layout ?? {}),
      ...(incoming.layout ?? {}),
    },
    configs: {
      ...(existing.configs ?? {}),
      ...(incoming.configs ?? {}),
    },
    modalPrefs: {
      ...(existing.modalPrefs ?? {}),
      ...(incoming.modalPrefs ?? {}),
    },
    layouts: mergeById(existing.layouts ?? [], incoming.layouts ?? []),
    projectLayouts: {
      ...(existing.projectLayouts ?? {}),
      ...(incoming.projectLayouts ?? {}),
    },
    preferences: {
      ...(existing.preferences ?? {}),
      ...(incoming.preferences ?? {}),
    },
    appearance: incoming.appearance ?? existing.appearance,
  };
}

async function loadCurrentSettingsSnapshot() {
  return exportSettingsSnapshot();
}

function applyResult(applied: Record<string, boolean>, errors: string[], key: string) {
  applied[key] = !errors.some((message) => message.startsWith(`${key}:`));
}

async function applyProjectScopedSettings({
  settings,
  mode,
  currentSettings,
  applied,
  errors,
}: {
  settings: NonNullable<FullBackupArtifact["settings"]>;
  mode: "replace" | "merge";
  currentSettings: SettingsSnapshot | null;
  applied: Record<string, boolean>;
  errors: string[];
}) {
  const settingsRepo = getSettingsRepo();

  if (settings.projectOrder) {
    const projectOrder =
      mode === "merge" && currentSettings
        ? mergeStringList(currentSettings.projectOrder, settings.projectOrder)
        : settings.projectOrder;
    await settingsRepo.setProjectOrder(projectOrder).catch((error) => {
      errors.push(`projectOrder: ${error instanceof Error ? error.message : String(error)}`);
    });
    applyResult(applied, errors, "projectOrder");
  }

  if (settings.widgetLayout !== undefined) {
    const widgetLayout =
      mode === "merge" && currentSettings
        ? mergeWidgetLayout(
            currentSettings.widgetLayout as WidgetLayoutConfig | null,
            settings.widgetLayout as unknown as WidgetLayoutConfig | null
          )
        : (settings.widgetLayout as unknown as WidgetLayoutConfig | null);
    if (widgetLayout) {
      await settingsRepo.setWidgetLayout(widgetLayout).catch((error) => {
        errors.push(`widgetLayout: ${error instanceof Error ? error.message : String(error)}`);
      });
      applyResult(applied, errors, "widgetLayout");
    }
  }

  if (settings.projectIntegrations) {
    const projectIntegrations =
      mode === "merge" && currentSettings
        ? ({
            ...(currentSettings.projectIntegrations as ProjectIntegrationsConfig),
            ...(settings.projectIntegrations as unknown as ProjectIntegrationsConfig),
          } as ProjectIntegrationsConfig)
        : (settings.projectIntegrations as unknown as ProjectIntegrationsConfig);
    await settingsRepo.setProjectIntegrations(projectIntegrations).catch((error) => {
      errors.push(`projectIntegrations: ${error instanceof Error ? error.message : String(error)}`);
    });
    applyResult(applied, errors, "projectIntegrations");
  }

  if (settings.integrationConnections) {
    const integrationConnections =
      mode === "merge" && currentSettings
        ? mergeById(
            currentSettings.integrationConnections as IntegrationConnectionsConfig,
            settings.integrationConnections as unknown as IntegrationConnectionsConfig
          )
        : (settings.integrationConnections as unknown as IntegrationConnectionsConfig);
    await settingsRepo.setIntegrationConnections(integrationConnections).catch((error) => {
      errors.push(
        `integrationConnections: ${error instanceof Error ? error.message : String(error)}`
      );
    });
    applyResult(applied, errors, "integrationConnections");
  }

  if (settings.projectContextMap) {
    const projectContextMap =
      mode === "merge" && currentSettings
        ? ({
            ...(currentSettings.projectContextMap as ProjectContextMap),
            ...(settings.projectContextMap as unknown as ProjectContextMap),
          } as ProjectContextMap)
        : (settings.projectContextMap as unknown as ProjectContextMap);
    await settingsRepo.setProjectContextMap(projectContextMap).catch((error) => {
      errors.push(`projectContextMap: ${error instanceof Error ? error.message : String(error)}`);
    });
    applyResult(applied, errors, "projectContextMap");
  }
}

async function applyPreferenceSettings({
  settings,
  mode,
  currentSettings,
  applied,
  errors,
}: {
  settings: NonNullable<FullBackupArtifact["settings"]>;
  mode: "replace" | "merge";
  currentSettings: SettingsSnapshot | null;
  applied: Record<string, boolean>;
  errors: string[];
}) {
  const settingsRepo = getSettingsRepo();

  if (settings.featurePreferences) {
    const featurePreferences =
      mode === "merge" && currentSettings
        ? ({
            ...(currentSettings.featurePreferences as FeaturePreferencesConfig),
            ...(settings.featurePreferences as unknown as FeaturePreferencesConfig),
          } as FeaturePreferencesConfig)
        : (settings.featurePreferences as unknown as FeaturePreferencesConfig);
    await settingsRepo.setFeaturePreferences(featurePreferences).catch((error) => {
      errors.push(`featurePreferences: ${error instanceof Error ? error.message : String(error)}`);
    });
    applyResult(applied, errors, "featurePreferences");
  }

  if (settings.llmConfig) {
    const llmConfig =
      mode === "merge" && currentSettings
        ? ({
            ...(currentSettings.llmConfig as LlmConfig),
            ...(settings.llmConfig as unknown as LlmConfig),
          } as LlmConfig)
        : (settings.llmConfig as unknown as LlmConfig);
    await settingsRepo.setLlmConfig(llmConfig).catch((error) => {
      errors.push(`llmConfig: ${error instanceof Error ? error.message : String(error)}`);
    });
    applyResult(applied, errors, "llmConfig");
  }

  if (settings.debugConfig) {
    const debugConfig =
      mode === "merge" && currentSettings
        ? ({
            ...(currentSettings.debugConfig as DebugConfig),
            ...(settings.debugConfig as unknown as DebugConfig),
          } as DebugConfig)
        : (settings.debugConfig as unknown as DebugConfig);
    await settingsRepo.setDebugConfig(debugConfig).catch((error) => {
      errors.push(`debugConfig: ${error instanceof Error ? error.message : String(error)}`);
    });
    applyResult(applied, errors, "debugConfig");
  }

  if (settings.routingConfig) {
    const routingConfig =
      mode === "merge" && currentSettings
        ? ({
            ...(currentSettings.routingConfig as RoutingConfig),
            ...(settings.routingConfig as unknown as RoutingConfig),
            rules: mergeById(
              (currentSettings.routingConfig as RoutingConfig | null)?.rules ?? [],
              (settings.routingConfig as unknown as RoutingConfig).rules ?? []
            ),
          } as RoutingConfig)
        : (settings.routingConfig as unknown as RoutingConfig);
    await settingsRepo.setRoutingConfig(routingConfig).catch((error) => {
      errors.push(`routingConfig: ${error instanceof Error ? error.message : String(error)}`);
    });
    applyResult(applied, errors, "routingConfig");
  }

  if (settings.workflows) {
    const workflows =
      mode === "merge" && currentSettings
        ? {
            ...currentSettings.workflows,
            ...settings.workflows,
          }
        : settings.workflows;
    await settingsRepo.setWorkflows(workflows).catch((error) => {
      errors.push(`workflows: ${error instanceof Error ? error.message : String(error)}`);
    });
    applyResult(applied, errors, "workflows");
  }
}

async function applyNullableSettings({
  settings,
  mode,
  applied,
  errors,
  warnings,
}: {
  settings: NonNullable<FullBackupArtifact["settings"]>;
  mode: "replace" | "merge";
  applied: Record<string, boolean>;
  errors: string[];
  warnings: string[];
}) {
  const settingsRepo = getSettingsRepo();

  if (settings.userPlan) {
    await settingsRepo.setUserPlan(settings.userPlan).catch((error) => {
      errors.push(`userPlan: ${error instanceof Error ? error.message : String(error)}`);
    });
    applyResult(applied, errors, "userPlan");
  } else if (mode === "replace" && settings.userPlan === null) {
    warnings.push("userPlan could not be cleared automatically during replace import.");
  }

  if (settings.licenseKey) {
    await settingsRepo.setLicenseKey(settings.licenseKey).catch((error) => {
      errors.push(`licenseKey: ${error instanceof Error ? error.message : String(error)}`);
    });
    applyResult(applied, errors, "licenseKey");
  } else if (mode === "replace" && settings.licenseKey === null) {
    warnings.push("licenseKey could not be cleared automatically during replace import.");
  }
}

async function applySettingsImport({
  settings,
  mode,
  currentSettings,
  applied,
  errors,
  warnings,
}: {
  settings: NonNullable<FullBackupArtifact["settings"]>;
  mode: "replace" | "merge";
  currentSettings: SettingsSnapshot | null;
  applied: Record<string, boolean>;
  errors: string[];
  warnings: string[];
}) {
  await applyProjectScopedSettings({ settings, mode, currentSettings, applied, errors });
  await applyPreferenceSettings({ settings, mode, currentSettings, applied, errors });
  await applyNullableSettings({ settings, mode, applied, errors, warnings });
}

async function applyCredentialImport({
  credentials,
  mode,
  applied,
  errors,
}: {
  credentials: NonNullable<FullBackupArtifact["credentials"]>;
  mode: "replace" | "merge";
  applied: Record<string, boolean>;
  errors: string[];
}) {
  try {
    const credentialRepo = getCredentialRepo();
    if (mode === "replace") {
      const existingKeys = await credentialRepo.listCredentialKeys();
      await Promise.all(existingKeys.map((key) => credentialRepo.deleteCredential(key)));
    }
    await Promise.all(
      credentials.map((entry) => credentialRepo.setCredential(entry.key, entry.values))
    );
    applied.credentials = true;
  } catch (error) {
    errors.push(`credentials: ${error instanceof Error ? error.message : String(error)}`);
    applied.credentials = false;
  }
}

async function applyPluginImport({
  pluginData,
  mode,
  applied,
  errors,
}: {
  pluginData: NonNullable<FullBackupArtifact["pluginData"]>;
  mode: "replace" | "merge";
  applied: Record<string, boolean>;
  errors: string[];
}) {
  try {
    const pluginRepo = getPluginRepo();
    if (mode === "replace") {
      for (const [pluginId] of PLUGIN_REGISTRY) {
        const existing = await pluginRepo.list(pluginId, "");
        await Promise.all(existing.map((item) => pluginRepo.delete(pluginId, item.key)));
      }
    }

    for (const [pluginId, items] of Object.entries(pluginData)) {
      for (const item of items) {
        await pluginRepo.set(pluginId, item.key, item.value);
      }
    }
    applied.pluginData = true;
  } catch (error) {
    errors.push(`pluginData: ${error instanceof Error ? error.message : String(error)}`);
    applied.pluginData = false;
  }
}

async function applyCacheImport({
  cache,
  mode,
  applied,
  errors,
}: {
  cache: NonNullable<FullBackupArtifact["cache"]>;
  mode: "replace" | "merge";
  applied: Record<string, boolean>;
  errors: string[];
}) {
  try {
    const cacheRepo = getCacheRepo();
    if (mode === "replace") {
      await cacheRepo.clear();
    }
    await Promise.all(
      cache.map((entry) =>
        cacheRepo.set({
          key: entry.key,
          route: entry.route,
          data: entry.data,
          fetchedAt: entry.fetchedAt,
          ttlSeconds: entry.ttlSeconds,
        })
      )
    );
    applied.cache = true;
  } catch (error) {
    errors.push(`cache: ${error instanceof Error ? error.message : String(error)}`);
    applied.cache = false;
  }
}

async function applyGitHubStarHistoryImport({
  githubStarHistory,
  mode,
  applied,
  errors,
}: {
  githubStarHistory: NonNullable<FullBackupArtifact["githubStarHistory"]>;
  mode: "replace" | "merge";
  applied: Record<string, boolean>;
  errors: string[];
}) {
  try {
    const historyRepo = getGitHubStarHistoryRepo();
    if (mode === "replace") {
      await historyRepo.clearAll();
    }
    if (githubStarHistory.daily.length > 0) {
      await historyRepo.upsertDaily(githubStarHistory.daily);
    }
    if (githubStarHistory.syncStates.length > 0) {
      await Promise.all(
        githubStarHistory.syncStates.map((row) => historyRepo.upsertSyncState(row))
      );
    }
    if (githubStarHistory.starEvents.length > 0) {
      await historyRepo.upsertStarEvents(githubStarHistory.starEvents);
    }
    if (githubStarHistory.trackingStates.length > 0) {
      await Promise.all(
        githubStarHistory.trackingStates.map((row) => historyRepo.upsertTrackingState(row))
      );
    }
    applied.githubStarHistory = true;
  } catch (error) {
    errors.push(`githubStarHistory: ${error instanceof Error ? error.message : String(error)}`);
    applied.githubStarHistory = false;
  }
}

export async function handleExportDatabase() {
  try {
    const config = getDatabaseConfig();
    const [settings, credentials, pluginData, cache, githubStarHistory] = await Promise.all([
      exportSettingsSnapshot(),
      exportCredentials(),
      exportPluginData(),
      exportCacheEntries(),
      exportGitHubStarHistory(),
    ]);

    const backup: FullBackupArtifact = {
      version: FULL_BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      sourceProvider: config.provider,
      metadata: {
        warnings: [
          "Full backup includes settings, credentials, plugin data, cache entries, and GitHub star history.",
          "Assistant chat history, debug event logs, and notification delivery state are not included yet.",
        ],
        omittedDomains: [...OMITTED_DOMAINS],
      },
      settings: settings as unknown as FullBackupArtifact["settings"],
      credentials,
      pluginData,
      cache,
      githubStarHistory,
    };

    const filename = `radarboard-full-backup-${new Date().toISOString().slice(0, 10)}.json`;

    return new NextResponse(JSON.stringify(backup, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    log.error("Failed to export full backup", { error });
    return errorJson(500, message);
  }
}

export async function handleImportDatabase(request: Request) {
  try {
    const parsed = await parseBody(request, fullBackupImportSchema);
    if (!parsed.ok) return parsed.response;

    const { mode, backup } = parsed.data as FullBackupImportRequest;
    const applied: Record<string, boolean> = {};
    const errors: string[] = [];
    const warnings: string[] = [];
    const currentSettings = mode === "merge" ? await loadCurrentSettingsSnapshot() : null;

    if (backup.settings) {
      await applySettingsImport({
        settings: backup.settings,
        mode,
        currentSettings,
        applied,
        errors,
        warnings,
      });
    }
    if (backup.credentials) {
      await applyCredentialImport({ credentials: backup.credentials, mode, applied, errors });
    }
    if (backup.pluginData) {
      await applyPluginImport({ pluginData: backup.pluginData, mode, applied, errors });
    }
    if (backup.cache) {
      await applyCacheImport({ cache: backup.cache, mode, applied, errors });
    }
    if (backup.githubStarHistory) {
      await applyGitHubStarHistoryImport({
        githubStarHistory: backup.githubStarHistory,
        mode,
        applied,
        errors,
      });
    }

    warnings.push(
      "Assistant chat history, debug event logs, and notification delivery state are not restored by this backup yet."
    );

    if (errors.length > 0) {
      log.warn("Full backup import completed with errors", { mode, errors, warnings });
    }

    return NextResponse.json({
      success: errors.length === 0,
      mode,
      applied,
      errors,
      warnings,
      restartRecommended: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    log.error("Failed to import full backup", { error });
    return errorJson(500, message);
  }
}
