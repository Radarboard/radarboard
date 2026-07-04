/**
 * Server-side registration of per-integration "REST Data" widgets for all
 * persisted user integrations. The actual (client-safe) registration lives in
 * `rest-widget-registry.ts`; this module adds the settings-repo lookup.
 */
import type { SettingsRepository } from "@radarboard/types/database";
import { getSettingsRepo } from "@/data/core/repository";
import { ensureRestWidgetRegistered } from "./rest-widget-registry";
import { loadUserIntegrationConfigs } from "./user-integrations-registry";

/** Register dedicated widgets for every persisted user integration. Returns the count. */
export async function registerUserIntegrationWidgets(
  repo: SettingsRepository = getSettingsRepo()
): Promise<number> {
  const configs = await loadUserIntegrationConfigs(repo);
  let registered = 0;
  for (const config of configs) {
    if (config?.id) {
      ensureRestWidgetRegistered(config.id, config.name);
      registered += 1;
    }
  }
  return registered;
}
