/**
 * Plugin RPC bus — dispatches cross-plugin service calls with Zod validation.
 *
 * Plugins declare services on their descriptor. The bus validates params
 * against the declared schema, resolves the target plugin's API, and
 * invokes the handler. Returns typed results or structured errors.
 */

import { PLUGIN_REGISTRY } from "./registry";
import type { PluginAPI, PluginRpcResult } from "./types";

type ApiBuilder = (pluginId: string) => PluginAPI;

/**
 * Call a service on another plugin.
 *
 * @param targetPluginId - The plugin exposing the service
 * @param action - The service action name
 * @param params - Input params (validated against the service's Zod schema)
 * @param buildApi - Function to build a PluginAPI for the target plugin
 */
export async function callPluginService<T = unknown>(
  targetPluginId: string,
  action: string,
  params: unknown,
  buildApi: ApiBuilder
): Promise<PluginRpcResult<T>> {
  // Resolve the target plugin
  const descriptor = PLUGIN_REGISTRY.get(targetPluginId);
  if (!descriptor) {
    return { ok: false, error: `Plugin "${targetPluginId}" not found` };
  }

  // Find the service
  const service = descriptor.services?.find((s) => s.action === action);
  if (!service) {
    return {
      ok: false,
      error: `Plugin "${targetPluginId}" has no service "${action}"`,
    };
  }

  // Validate params
  const parseResult = service.parameters.safeParse(params ?? {});
  if (!parseResult.success) {
    const issues = parseResult.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    return { ok: false, error: `Invalid params: ${issues}` };
  }

  // Execute the handler
  try {
    const api = buildApi(targetPluginId);
    const result = await service.handler(parseResult.data, api);
    return { ok: true, data: result as T };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Service error: ${message}` };
  }
}

/**
 * List all available services across registered plugins.
 */
export function listPluginServices(): Array<{
  pluginId: string;
  action: string;
  description?: string;
}> {
  const services: Array<{
    pluginId: string;
    action: string;
    description?: string;
  }> = [];

  for (const [pluginId, descriptor] of PLUGIN_REGISTRY) {
    for (const service of descriptor.services ?? []) {
      services.push({
        pluginId,
        action: service.action,
        description: service.description,
      });
    }
  }

  return services;
}
