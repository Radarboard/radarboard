import { createLogger } from "@radarboard/logger/logger";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getPluginRepo, getSettingsRepo } from "@/db/repository";
import { errorJson, parseBody } from "@/lib/api";

const log = createLogger("api/config/import");

const ConfigImportSchema = z.object({
  version: z.enum(["1", "2"]),
  exportedAt: z.string().optional(),
  projectOrder: z.array(z.string()).optional(),
  widgetLayout: z.record(z.string(), z.unknown()).optional(),
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
  credentialKeys: z.array(z.string()).optional(),
  pluginData: z
    .record(z.string(), z.array(z.object({ key: z.string(), value: z.string() })))
    .optional(),
});

type ConfigImport = z.infer<typeof ConfigImportSchema>;

/**
 * POST /api/config/import
 *
 * Restores a config snapshot produced by GET /api/config/export.
 */
export async function handleConfigImport(request: Request) {
  try {
    const parsed = await parseBody(request, ConfigImportSchema);
    if (!parsed.ok) return parsed.response;

    const data: ConfigImport = parsed.data;
    const repo = getSettingsRepo();

    const applied: Record<string, boolean> = {};
    const errors: string[] = [];

    if (data.projectOrder) {
      await repo.setProjectOrder(data.projectOrder).catch((err) => {
        errors.push(`projectOrder: ${err instanceof Error ? err.message : String(err)}`);
      });
      applied.projectOrder = !errors.some((e) => e.startsWith("projectOrder"));
    }

    if (data.widgetLayout) {
      await repo
        .setWidgetLayout(data.widgetLayout as unknown as Parameters<typeof repo.setWidgetLayout>[0])
        .catch((err) => {
          errors.push(`widgetLayout: ${err instanceof Error ? err.message : String(err)}`);
        });
      applied.widgetLayout = !errors.some((e) => e.startsWith("widgetLayout"));
    }

    if (data.projectIntegrations) {
      await repo
        .setProjectIntegrations(
          data.projectIntegrations as Parameters<typeof repo.setProjectIntegrations>[0]
        )
        .catch((err) => {
          errors.push(`projectIntegrations: ${err instanceof Error ? err.message : String(err)}`);
        });
      applied.projectIntegrations = !errors.some((e) => e.startsWith("projectIntegrations"));
    }

    if (data.integrationConnections) {
      await repo
        .setIntegrationConnections(
          data.integrationConnections as unknown as Parameters<
            typeof repo.setIntegrationConnections
          >[0]
        )
        .catch((err) => {
          errors.push(
            `integrationConnections: ${err instanceof Error ? err.message : String(err)}`
          );
        });
      applied.integrationConnections = !errors.some((e) => e.startsWith("integrationConnections"));
    }

    if (data.projectContextMap) {
      await repo
        .setProjectContextMap(
          data.projectContextMap as Parameters<typeof repo.setProjectContextMap>[0]
        )
        .catch((err) => {
          errors.push(`projectContextMap: ${err instanceof Error ? err.message : String(err)}`);
        });
      applied.projectContextMap = !errors.some((e) => e.startsWith("projectContextMap"));
    }

    if (data.featurePreferences) {
      await repo.setFeaturePreferences(data.featurePreferences).catch((err) => {
        errors.push(`featurePreferences: ${err instanceof Error ? err.message : String(err)}`);
      });
      applied.featurePreferences = !errors.some((e) => e.startsWith("featurePreferences"));
    }

    if (data.llmConfig) {
      await repo
        .setLlmConfig(data.llmConfig as Parameters<typeof repo.setLlmConfig>[0])
        .catch((err) => {
          errors.push(`llmConfig: ${err instanceof Error ? err.message : String(err)}`);
        });
      applied.llmConfig = !errors.some((e) => e.startsWith("llmConfig"));
    }

    if (data.debugConfig) {
      await repo
        .setDebugConfig(data.debugConfig as Parameters<typeof repo.setDebugConfig>[0])
        .catch((err) => {
          errors.push(`debugConfig: ${err instanceof Error ? err.message : String(err)}`);
        });
      applied.debugConfig = !errors.some((e) => e.startsWith("debugConfig"));
    }

    if (data.routingConfig) {
      await repo
        .setRoutingConfig(
          data.routingConfig as unknown as Parameters<typeof repo.setRoutingConfig>[0]
        )
        .catch((err) => {
          errors.push(`routingConfig: ${err instanceof Error ? err.message : String(err)}`);
        });
      applied.routingConfig = !errors.some((e) => e.startsWith("routingConfig"));
    }

    if (data.workflows && Object.keys(data.workflows).length > 0) {
      await repo.setWorkflows(data.workflows).catch((err) => {
        errors.push(`workflows: ${err instanceof Error ? err.message : String(err)}`);
      });
      applied.workflows = !errors.some((e) => e.startsWith("workflows"));
    }

    if (data.userPlan) {
      await repo.setUserPlan(data.userPlan).catch((err) => {
        errors.push(`userPlan: ${err instanceof Error ? err.message : String(err)}`);
      });
      applied.userPlan = !errors.some((e) => e.startsWith("userPlan"));
    }

    if (data.licenseKey) {
      await repo.setLicenseKey(data.licenseKey).catch((err) => {
        errors.push(`licenseKey: ${err instanceof Error ? err.message : String(err)}`);
      });
      applied.licenseKey = !errors.some((e) => e.startsWith("licenseKey"));
    }

    if (data.pluginData && Object.keys(data.pluginData).length > 0) {
      try {
        const pluginRepo = getPluginRepo();
        for (const [pluginId, items] of Object.entries(data.pluginData)) {
          for (const { key, value } of items) {
            await pluginRepo.set(pluginId, key, value);
          }
        }
        applied.pluginData = true;
      } catch (err) {
        errors.push(`pluginData: ${err instanceof Error ? err.message : String(err)}`);
        applied.pluginData = false;
      }
    }

    if (errors.length > 0) {
      log.warn("Config import completed with errors", { errors });
    }

    return NextResponse.json({ success: true, applied, errors });
  } catch (err) {
    log.error("Failed to import config", {
      error: err instanceof Error ? err.message : String(err),
    });
    return errorJson(500, "Failed to import config");
  }
}
