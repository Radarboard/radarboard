import { getPluginToken } from "@radarboard/plugin-sdk/host";
import { API_ROUTES, pluginDataRoute, pluginRoute } from "@radarboard/types/api-routes";

const SYSTEM_PLUGIN_ID = "_system";
export const INTEGRATION_RSS_FEEDS_KEY = "integration-rss-feeds";

export type IntegrationRssFeedOverrides = Record<string, string | null>;

interface PluginDataResponse {
  value?: string | null;
}

interface DiscoverRssFeedResponse {
  ok: boolean;
  feedUrl?: string;
  error?: string;
}

function hasOwnOverride(overrides: IntegrationRssFeedOverrides, serviceId: string): boolean {
  return Object.hasOwn(overrides, serviceId);
}

export function resolveIntegrationRssFeedUrl(
  serviceId: string,
  overrides: IntegrationRssFeedOverrides,
  defaultRssFeedUrl?: string
): string | null {
  if (hasOwnOverride(overrides, serviceId)) {
    const override = overrides[serviceId];
    return typeof override === "string" && override.trim() ? override.trim() : null;
  }

  return defaultRssFeedUrl?.trim() || null;
}

export function getIntegrationRssFeedMode(
  serviceId: string,
  overrides: IntegrationRssFeedOverrides
): "inherit" | "custom" | "disabled" {
  if (!hasOwnOverride(overrides, serviceId)) return "inherit";
  return typeof overrides[serviceId] === "string" ? "custom" : "disabled";
}

export async function fetchIntegrationRssFeedOverrides(): Promise<IntegrationRssFeedOverrides> {
  const token = await getPluginToken(SYSTEM_PLUGIN_ID);
  const response = await fetch(pluginDataRoute(SYSTEM_PLUGIN_ID, INTEGRATION_RSS_FEEDS_KEY), {
    headers: { "X-Plugin-Token": token },
  });
  if (!response.ok) return {};

  const data = (await response.json()) as PluginDataResponse;
  return data.value ? (JSON.parse(data.value) as IntegrationRssFeedOverrides) : {};
}

export async function saveIntegrationRssFeedOverrides(
  overrides: IntegrationRssFeedOverrides
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
      key: INTEGRATION_RSS_FEEDS_KEY,
      value: JSON.stringify(overrides),
    }),
  });
}

export async function discoverResolvedRssFeedUrl(url: string): Promise<string> {
  const response = await fetch(pluginRoute("rss-reader", "discover"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  const data = (await response.json()) as DiscoverRssFeedResponse;

  if (!response.ok || !data.ok || !data.feedUrl) {
    throw new Error(data.error ?? "Failed to discover RSS feed");
  }

  return data.feedUrl;
}
