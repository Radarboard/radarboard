import { getPluginToken } from "@radarboard/plugin-sdk/host";
import { API_ROUTES, pluginDataRoute } from "@radarboard/types/api-routes";

const SYSTEM_PLUGIN_ID = "_system";
export const INTEGRATION_STATUS_PAGES_KEY = "integration-status-pages";

export type IntegrationStatusPageOverrides = Record<string, string | null>;

interface PluginDataResponse {
  value?: string | null;
}

function hasOwnOverride(overrides: IntegrationStatusPageOverrides, integrationId: string): boolean {
  return Object.hasOwn(overrides, integrationId);
}

export function resolveIntegrationStatusPageUrl(
  integrationId: string,
  overrides: IntegrationStatusPageOverrides,
  defaultStatusPageUrl?: string
): string | null {
  if (hasOwnOverride(overrides, integrationId)) {
    const override = overrides[integrationId];
    return typeof override === "string" && override.trim() ? override.trim() : null;
  }

  return defaultStatusPageUrl?.trim() || null;
}

export function getIntegrationStatusPageMode(
  integrationId: string,
  overrides: IntegrationStatusPageOverrides
): "inherit" | "custom" | "disabled" {
  if (!hasOwnOverride(overrides, integrationId)) return "inherit";
  return typeof overrides[integrationId] === "string" ? "custom" : "disabled";
}

export async function fetchIntegrationStatusPageOverrides(): Promise<IntegrationStatusPageOverrides> {
  const token = await getPluginToken(SYSTEM_PLUGIN_ID);
  const response = await fetch(pluginDataRoute(SYSTEM_PLUGIN_ID, INTEGRATION_STATUS_PAGES_KEY), {
    headers: { "X-Plugin-Token": token },
  });
  if (!response.ok) return {};

  const data = (await response.json()) as PluginDataResponse;
  return data.value ? (JSON.parse(data.value) as IntegrationStatusPageOverrides) : {};
}

export async function saveIntegrationStatusPageOverrides(
  overrides: IntegrationStatusPageOverrides
): Promise<void> {
  const token = await getPluginToken(SYSTEM_PLUGIN_ID);
  await fetch(API_ROUTES.pluginData, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Plugin-Token": token,
    },
    body: JSON.stringify({
      pluginId: SYSTEM_PLUGIN_ID,
      key: INTEGRATION_STATUS_PAGES_KEY,
      value: JSON.stringify(overrides),
    }),
  });
}
