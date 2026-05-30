import type { PluginDescriptor } from "./types";

/**
 * Central registry of all available plugins.
 *
 * Plugins register themselves by importing this map and calling `.set()`.
 * The PluginHost reads from this registry on mount to wire up widget
 * contributions, MCP tools, and launch surfaces.
 */
export const PLUGIN_REGISTRY = new Map<string, PluginDescriptor>();

const MAX_DESCRIPTION_LENGTH = 120;

/**
 * Register a plugin descriptor into the global registry.
 * Silently skips re-registration (for HMR); throws if the description is too long.
 */
export function registerPlugin(descriptor: PluginDescriptor): void {
  if (PLUGIN_REGISTRY.has(descriptor.id)) {
    // Idempotent — allow re-registration during HMR / React strict mode
    return;
  }
  if (descriptor.description.length > MAX_DESCRIPTION_LENGTH) {
    throw new Error(
      `Plugin "${descriptor.id}" description exceeds ${MAX_DESCRIPTION_LENGTH} characters (${descriptor.description.length}). Keep it concise for the settings UI.`
    );
  }
  PLUGIN_REGISTRY.set(descriptor.id, descriptor);
}

/** Get a registered plugin by ID, or undefined if not found. */
export function getPlugin(id: string): PluginDescriptor | undefined {
  return PLUGIN_REGISTRY.get(id);
}

/** Get all registered plugins as an array. */
export function getAllPlugins(): PluginDescriptor[] {
  return Array.from(PLUGIN_REGISTRY.values());
}
