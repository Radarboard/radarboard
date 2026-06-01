import { createLogger } from "@radarboard/logger/logger";
import { errorJson } from "@/lib/api";

export type PluginRouteContext = {
  params: Promise<{ plugin: string; action: string }>;
};

function routeLogger(plugin: string, action: string) {
  return createLogger(`api/plugins/${plugin}/${action}`);
}

export async function handlePluginActionGet(_request: Request, context: PluginRouteContext) {
  const { plugin, action } = await context.params;
  const log = routeLogger(plugin, action);

  log.warn("Plugin route is not registered in core", { plugin, action, method: "GET" });
  return errorJson(404, "Plugin route is not registered");
}

export async function handlePluginActionPost(_request: Request, context: PluginRouteContext) {
  const { plugin, action } = await context.params;
  const log = routeLogger(plugin, action);

  log.warn("Plugin route is not registered in core", { plugin, action, method: "POST" });
  return errorJson(404, "Plugin route is not registered");
}
