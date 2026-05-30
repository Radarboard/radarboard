import {
  integrationRoute as buildIntegrationRoute,
  pluginRoute as buildPluginRoute,
  type IntegrationActionRoute,
  type PluginActionRoute,
} from "@radarboard/types/api-routes";

/** Build a typed API route for an integration action endpoint. */
export function integrationRoute<const TIntegration extends string, const TAction extends string>(
  integration: TIntegration,
  action: TAction
): IntegrationActionRoute<TIntegration, TAction> {
  return buildIntegrationRoute(integration, action);
}

/** Build a typed API route for a plugin action endpoint. */
export function pluginRoute<const TPlugin extends string, const TAction extends string>(
  plugin: TPlugin,
  action: TAction
): PluginActionRoute<TPlugin, TAction> {
  return buildPluginRoute(plugin, action);
}
