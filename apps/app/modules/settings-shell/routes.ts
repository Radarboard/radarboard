import { createLogger } from "@radarboard/logger/logger";
import { isValidPollingPreferences, sanitizePollingPreferences } from "@radarboard/types/polling";
import { APP_SHORTCUT_ACTION_IDS } from "@radarboard/types/shortcuts";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSettingsRepo } from "@/db/repository";
import { parseBody } from "@/lib/api";
import { emitCacheInvalidation } from "@/lib/event-gateway";
import { INTEGRATION_BACKED_DASHBOARD_DATA_PREFIXES } from "@/lib/integration-data-invalidation";
import "@/lib/polling-config";
import { ensureWorkflowSchedulerStarted } from "@/lib/workflow-scheduler-runtime";

const log = createLogger("api/settings");

const assistantPresetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  prompt: z.string().min(1),
  mode: z.enum(["default", "explore", "plan", "review", "qa"]),
  modelId: z.string().nullable().optional(),
  description: z.string().optional(),
});

const integrationConnectionCapabilitySchema = z.object({
  id: z.string().min(1),
  enabled: z.boolean(),
  config: z.record(z.string(), z.unknown()).optional(),
  resources: z.record(z.string(), z.unknown()).optional(),
});

const integrationConnectionSchema = z.object({
  id: z.string().min(1),
  provider: z.string().min(1),
  name: z.string().min(1),
  credentialKey: z.string().min(1),
  enabled: z.boolean(),
  isDefault: z.boolean(),
  source: z.enum(["explicit", "legacy"]),
  capabilities: z.array(integrationConnectionCapabilitySchema),
  metadata: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const widgetSlotMapSchema = z.record(z.string(), z.string().nullable());
const dashboardPageSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  layoutId: z.string().optional(),
  widgetLayouts: z.record(z.string(), widgetSlotMapSchema).optional(),
});
const projectLayoutConfigSchema = z.object({
  pages: z.array(dashboardPageSchema).min(1).optional(),
  layoutId: z.string().optional(),
  layout: widgetSlotMapSchema.optional(),
  widgetLayouts: z.record(z.string(), widgetSlotMapSchema).optional(),
});
const routingConditionSchema = z.object({
  scope: z.enum(["event", "metadata"]),
  field: z.string().min(1),
  operator: z.enum([
    "equals",
    "not_equals",
    "contains",
    "greater_than",
    "greater_than_or_equal",
    "less_than",
    "less_than_or_equal",
  ]),
  valueType: z.enum(["string", "number", "boolean"]),
  value: z.union([z.string(), z.number(), z.boolean()]),
});

const shortcutBindingSchema = z.object({
  shortcut: z.string().min(1).nullable().optional(),
  desktopGlobal: z.boolean().optional(),
});

const SettingsPostSchema = z
  .object({
    projectOrder: z
      .custom<string[]>(
        (v) => Array.isArray(v) && v.length > 0 && v.every((s) => typeof s === "string"),
        {
          message: "Invalid project order",
        }
      )
      .optional(),
    widgetLayout: z
      .custom<Record<string, unknown>>(isPlainObject, { message: "Invalid widget layout" })
      .pipe(
        z.object({
          layout: z.record(z.string(), z.string().nullable()).optional(),
          configs: z.record(z.string(), z.record(z.string(), z.unknown())),
          modalPrefs: z
            .record(z.string(), z.record(z.string(), z.enum(["sm", "content", "md", "lg", "xl"])))
            .optional(),
          layouts: z.array(z.unknown()).optional(),
          projectLayouts: z.record(z.string(), projectLayoutConfigSchema).optional(),
          preferences: z
            .object({
              timezone: z.string().optional(),
              locale: z.string().optional(),
              polling: z
                .custom<Record<string, number> | undefined>(isValidPollingPreferences, {
                  message: "Invalid polling preferences",
                })
                .optional(),
              shortcuts: z
                .record(z.enum(APP_SHORTCUT_ACTION_IDS), shortcutBindingSchema.optional())
                .optional(),
              onboardingCompleted: z.boolean().optional(),
              demoMode: z.boolean().optional(),
              userProfile: z.string().nullable().optional(),
              intendedIntegrations: z.array(z.string()).optional(),
              blueprintWidgetMap: z.record(z.string(), z.string()).optional(),
            })
            .optional(),
          appearance: z
            .object({
              fontScale: z.enum(["sm", "md", "lg"]),
              themeFamilyId: z.string().min(1).optional(),
              themeMode: z.enum(["light", "dark", "system"]).optional(),
              ticker: z
                .object({
                  enabled: z.boolean().optional(),
                  speed: z.enum(["slow", "normal", "fast"]).optional(),
                  sources: z
                    .object({
                      github: z.boolean().optional(),
                      linear: z.boolean().optional(),
                      vercel: z.boolean().optional(),
                      manual: z.boolean().optional(),
                    })
                    .optional(),
                  showHealthAlerts: z.boolean().optional(),
                })
                .optional(),
            })
            .optional(),
        })
      )
      .optional(),
    projectIntegrations: z
      .record(z.string(), z.record(z.string(), z.record(z.string(), z.unknown())))
      .optional(),
    integrationConnections: z.array(integrationConnectionSchema).optional(),
    projectContextMap: z
      .custom<Record<string, unknown>>(isPlainObject, { message: "Invalid project context map" })
      .optional(),
    llmConfig: z
      .object({
        identityPrompt: z.string().optional(),
        extractionPrompt: z.string().optional(),
        skillOverrides: z.record(z.string(), z.string()).optional(),
        assistantPresets: z.array(assistantPresetSchema).optional(),
      })
      .optional(),
    debugConfig: z
      .object({
        promotionEnabled: z.boolean().optional(),
        metadataRedactionEnabled: z.boolean().optional(),
        additionalRedactedKeys: z.array(z.string()).optional(),
        metadataMaxBytes: z.number().int().min(256).max(65536).optional(),
        retentionDays: z.number().int().min(1).max(3650).optional(),
        promotionRules: z
          .array(
            z.object({
              id: z.string(),
              enabled: z.boolean(),
              sourcePattern: z.string().nullable().optional(),
              eventTypePattern: z.string().nullable().optional(),
              level: z.enum(["debug", "info", "warn", "error"]).nullable().optional(),
              severity: z.enum(["critical", "warning", "info"]),
            })
          )
          .optional(),
      })
      .optional(),
    featurePreferences: z.record(z.string(), z.boolean()).optional(),
    routingConfig: z
      .object({
        rules: z.array(
          z.object({
            id: z.string().min(1),
            name: z.string().min(1).max(120),
            enabled: z.boolean(),
            source: z.string().nullable().optional(),
            eventType: z.string().nullable().optional(),
            severity: z.enum(["critical", "warning", "info"]).nullable().optional(),
            projectSlug: z.string().nullable().optional(),
            condition: routingConditionSchema.nullable().optional(),
            notifications: z.enum(["inherit", "allow", "deny"]),
            ticker: z.enum(["inherit", "allow", "deny"]),
            createdAt: z.number().int().nonnegative(),
            updatedAt: z.number().int().nonnegative(),
          })
        ),
      })
      .optional(),
  })
  .superRefine((d, ctx) => {
    if (
      !d.projectOrder &&
      !d.widgetLayout &&
      !d.projectIntegrations &&
      !d.integrationConnections &&
      !d.projectContextMap &&
      !d.llmConfig &&
      !d.debugConfig &&
      !d.routingConfig &&
      !d.featurePreferences
    ) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "No settings to update" });
    }
  });

export async function handleGetSettings() {
  try {
    await ensureWorkflowSchedulerStarted().catch(() => undefined);
    const repo = getSettingsRepo();
    const [
      projectOrder,
      widgetLayout,
      projectIntegrations,
      integrationConnections,
      projectContextMap,
      llmConfig,
      debugConfig,
      routingConfig,
      featurePreferences,
      userPlan,
    ] = await Promise.all([
      repo.getProjectOrder().catch(() => []),
      repo.getWidgetLayout().catch(() => null),
      repo.getProjectIntegrations().catch(() => ({})),
      repo.getIntegrationConnections().catch(() => []),
      repo.getProjectContextMap().catch(() => ({})),
      repo.getLlmConfig().catch(() => ({})),
      repo.getDebugConfig().catch(() => ({})),
      repo.getRoutingConfig().catch(() => ({ rules: [] })),
      repo.getFeaturePreferences().catch(() => ({})),
      repo.getUserPlan().catch(() => null),
    ]);
    return NextResponse.json({
      projectOrder,
      widgetLayout,
      projectIntegrations,
      integrationConnections,
      projectContextMap,
      llmConfig,
      debugConfig,
      routingConfig,
      featurePreferences,
      userPlan,
    });
  } catch (err) {
    log.error("Failed to load settings", { error: err });
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }
}

export async function handleUpdateSettings(request: Request) {
  try {
    await ensureWorkflowSchedulerStarted().catch(() => undefined);
    const parsed = await parseBody(request, SettingsPostSchema);
    if (!parsed.ok) return parsed.response;

    const {
      projectOrder,
      widgetLayout,
      projectIntegrations,
      integrationConnections,
      projectContextMap,
      llmConfig,
      debugConfig,
      routingConfig,
      featurePreferences,
    } = parsed.data;
    const repo = getSettingsRepo();

    if (projectOrder) {
      await repo.setProjectOrder(projectOrder);
    }

    if (widgetLayout) {
      const normalizedWidgetLayout = {
        ...widgetLayout,
        preferences: widgetLayout.preferences
          ? {
              ...widgetLayout.preferences,
              polling: sanitizePollingPreferences(widgetLayout.preferences.polling) ?? {},
            }
          : widgetLayout.preferences,
      };
      await repo.setWidgetLayout(
        normalizedWidgetLayout as Parameters<typeof repo.setWidgetLayout>[0]
      );
    }

    if (projectIntegrations) {
      await repo.setProjectIntegrations(projectIntegrations);
      emitCacheInvalidation(
        Array.from(INTEGRATION_BACKED_DASHBOARD_DATA_PREFIXES),
        "settings:projectIntegrations"
      );
    }

    if (integrationConnections) {
      await repo.setIntegrationConnections(integrationConnections);
    }

    if (projectContextMap) {
      await repo.setProjectContextMap(
        projectContextMap as Parameters<typeof repo.setProjectContextMap>[0]
      );
    }

    if (llmConfig) {
      await repo.setLlmConfig(llmConfig);
    }

    if (debugConfig) {
      await repo.setDebugConfig(debugConfig);
    }

    if (featurePreferences) {
      await repo.setFeaturePreferences(featurePreferences);
    }

    if (routingConfig) {
      await repo.setRoutingConfig({
        rules: routingConfig.rules.map((rule) => ({
          ...rule,
          source: rule.source ?? null,
          eventType: rule.eventType ?? null,
          severity: rule.severity ?? null,
          projectSlug: rule.projectSlug ?? null,
          condition: rule.condition ?? null,
        })),
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    log.error("Failed to save settings", { error: err });
    return NextResponse.json({ error: `Failed to save settings: ${detail}` }, { status: 500 });
  }
}
