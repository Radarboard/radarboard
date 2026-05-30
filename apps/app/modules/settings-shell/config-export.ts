import { createLogger } from "@radarboard/logger/logger";
import { PLUGIN_REGISTRY } from "@radarboard/plugin-sdk/registry";
import { NextResponse } from "next/server";
import { getCredentialRepo, getPluginRepo, getSettingsRepo } from "@/db/repository";
import "@/lib/plugins-init";
import { errorJson } from "@/lib/api";

const log = createLogger("api/config/export");

const SCHEMA_VERSION = "2";

/**
 * GET /api/config/export
 *
 * Exports a full config snapshot as a JSON download.
 */
export async function handleConfigExport(): Promise<NextResponse> {
  try {
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

    let credentialKeys: string[] = [];
    try {
      const credRepo = getCredentialRepo();
      credentialKeys = await credRepo.listCredentialKeys();
    } catch {
      // Credential repo may not be available in all providers
    }

    const pluginData: Record<string, Array<{ key: string; value: string }>> = {};
    try {
      const pluginRepo = getPluginRepo();
      for (const [pluginId] of PLUGIN_REGISTRY) {
        const items = await pluginRepo.list(pluginId, "");
        if (items.length > 0) {
          pluginData[pluginId] = items;
        }
      }
    } catch {
      // Plugin repo may not be available in all providers
    }

    const snapshot = {
      version: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
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
      credentialKeys,
      pluginData,
    };

    const filename = `radarboard-config-${new Date().toISOString().slice(0, 10)}.json`;

    return new NextResponse(JSON.stringify(snapshot, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    log.error("Failed to export config", {
      error: err instanceof Error ? err.message : String(err),
    });
    return errorJson(500, "Failed to export config");
  }
}
