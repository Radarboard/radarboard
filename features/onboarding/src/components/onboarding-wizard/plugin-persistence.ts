import type { PluginDescriptor } from "@radarboard/plugin-sdk/types";
import type { OnboardingState } from "./types";
import { ESSENTIAL_PLUGIN_IDS } from "./step-plugins";

type GetPlugins = () => PluginDescriptor[];
type GetToken = (pluginId: string) => Promise<string>;
type FetchImpl = typeof fetch;

interface PersistEnabledPluginsDeps {
  fetchImpl: FetchImpl;
  getAllPlugins: GetPlugins;
  getPluginToken: GetToken;
  pluginDataRoute: string;
}

export function buildDisabledPluginIds(
  allPluginIds: string[],
  enabledPluginIds: string[],
  essentialPluginIds: string[] = ESSENTIAL_PLUGIN_IDS
): string[] {
  const enabledSet = new Set([...enabledPluginIds, ...essentialPluginIds]);
  return allPluginIds.filter((id) => !enabledSet.has(id)).sort();
}

export async function persistEnabledPlugins(
  state: OnboardingState,
  deps: PersistEnabledPluginsDeps
): Promise<string[]> {
  const allPluginIds = deps.getAllPlugins().map((plugin) => plugin.id);
  const disabledPluginIds = buildDisabledPluginIds(allPluginIds, state.enabledPlugins);
  const token = await deps.getPluginToken("_system");
  const response = await deps.fetchImpl(deps.pluginDataRoute, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "X-Plugin-Token": token },
    body: JSON.stringify({
      pluginId: "_system",
      key: "disabled-plugins",
      value: JSON.stringify(disabledPluginIds),
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to persist disabled plugins: ${response.status}`);
  }

  return disabledPluginIds;
}
