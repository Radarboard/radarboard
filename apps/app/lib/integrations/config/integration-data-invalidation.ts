import { API_ROUTES } from "@radarboard/types/api-routes";

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

export function getCredentialDependentCacheRoutes(credentialKey: string): string[] {
  if ((ANALYTICS_PROVIDER_IDS as readonly string[]).includes(credentialKey)) {
    return [ANALYTICS_BRIDGE_DATA_ROUTE];
  }

  return [];
}

export function isAppShellWidgetAuthServiceId(serviceId: string): boolean {
  return (APP_SHELL_WIDGET_AUTH_SERVICE_IDS as readonly string[]).includes(serviceId);
}
