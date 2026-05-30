import {
  integrationRoute as buildIntegrationRoute,
  pluginRoute as buildPluginRoute,
} from "@radarboard/types/api-routes";

export function integrationRoute(integration: string, action: string): string {
  return buildIntegrationRoute(integration, action);
}

export function pluginRoute(plugin: string, action: string): string {
  return buildPluginRoute(plugin, action);
}
