import { API_ROUTES } from "@radarboard/types/api-routes";
import type { Cache, ScopedMutator } from "swr";

export const INTEGRATION_DATA_ROUTE_PREFIX = "/api/integrations/";
export const PLUGIN_CHANGELOG_ROUTE_PREFIX = "/api/plugins/changelog/";
export const ANALYTICS_BRIDGE_DATA_ROUTE = "/api/integrations/analytics/data";
export const ANALYTICS_PROVIDER_IDS = ["openpanel", "umami"] as const;
export const APP_SHELL_WIDGET_AUTH_SERVICE_IDS = ["openpanel"] as const;

export const INTEGRATION_BACKED_DASHBOARD_DATA_PREFIXES = [
  INTEGRATION_DATA_ROUTE_PREFIX,
  API_ROUTES.analyticsData,
  PLUGIN_CHANGELOG_ROUTE_PREFIX,
] as const;

export function isIntegrationBackedDashboardDataKey(key: unknown): key is string {
  return (
    typeof key === "string" &&
    INTEGRATION_BACKED_DASHBOARD_DATA_PREFIXES.some((prefix) => key.includes(prefix))
  );
}

export function buildForceRefreshDashboardDataUrl(key: string): string {
  const baseUrl =
    typeof window === "undefined" ? "http://radarboard.local" : window.location.origin;
  const url = new URL(key, baseUrl);
  url.searchParams.set("refresh", "1");

  if (key.startsWith("http://") || key.startsWith("https://")) {
    return url.toString();
  }

  return `${url.pathname}${url.search}`;
}

async function fetchDashboardData(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Dashboard data refresh failed (${res.status})`);
  return res.json() as Promise<unknown>;
}

export async function revalidateIntegrationBackedDashboardData(
  cache: Cache,
  mutate: ScopedMutator
): Promise<void> {
  const keys = Array.from(cache.keys()).filter(isIntegrationBackedDashboardDataKey);

  if (keys.length === 0) {
    await mutate(isIntegrationBackedDashboardDataKey, undefined, { revalidate: true });
    return;
  }

  await Promise.all(
    keys.map(async (key) => {
      try {
        const fresh = await fetchDashboardData(buildForceRefreshDashboardDataUrl(key));
        await mutate(key, fresh, { populateCache: true, revalidate: false });
      } catch {
        await mutate(key, undefined, { revalidate: true });
      }
    })
  );
}

export function getCredentialDependentCacheRoutes(credentialKey: string): string[] {
  if ((ANALYTICS_PROVIDER_IDS as readonly string[]).includes(credentialKey)) {
    return [ANALYTICS_BRIDGE_DATA_ROUTE];
  }

  return [];
}

export function isAppShellWidgetAuthServiceId(serviceId: string): boolean {
  return (APP_SHELL_WIDGET_AUTH_SERVICE_IDS as readonly string[]).includes(serviceId);
}
