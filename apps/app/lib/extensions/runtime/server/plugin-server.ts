import "@/lib/plugins-init";

import { getAllPlugins, getPlugin } from "@radarboard/plugin-sdk/registry";
import type {
  PluginServerRouteInput,
  PluginServerRouteResult,
  PluginServerRuntime,
} from "@radarboard/plugin-sdk/types";
import { getEmbeddingService } from "@/lib/embedding-service-singleton";

type HostPluginServerRouteHandler = (
  input: Omit<PluginServerRouteInput, "runtime">
) => Promise<PluginServerRouteResult>;

const pluginServerRuntime: PluginServerRuntime = {
  services: {
    getEmbeddingService,
  },
};

let configured = false;

export function configurePluginServerRuntime(): PluginServerRuntime {
  if (configured) return pluginServerRuntime;

  for (const descriptor of getAllPlugins()) {
    descriptor.server?.configure?.(pluginServerRuntime);
  }

  configured = true;
  return pluginServerRuntime;
}

export function getPluginServerRoute(
  pluginId: string,
  routeId: string
): HostPluginServerRouteHandler | null {
  const runtime = configurePluginServerRuntime();
  const route = getPlugin(pluginId)?.server?.routes?.[routeId];
  if (!route) return null;

  return (input) => route({ ...input, runtime });
}
