/**
 * Plugin lifecycle runner.
 *
 * Tracks and executes lifecycle hooks declared on PluginDescriptors.
 * Each runner instance manages cleanup functions returned by onInit/onActivate
 * so that teardown happens automatically on deactivation or destroy.
 */

import { withSpan } from "@radarboard/observability";
import { runPluginMigrations } from "./migrations";
import type { PluginAPI, PluginDescriptor, PluginLifecycleCleanup } from "./types";

// ---------------------------------------------------------------------------
// Topological sort for plugin dependency resolution
// ---------------------------------------------------------------------------

/**
 * Topologically sort plugin descriptors based on `dependencies`.
 * Returns plugins in init order (dependencies first).
 * Throws if a cycle is detected.
 */
export function topoSortPlugins(descriptors: PluginDescriptor[]): PluginDescriptor[] {
  const byId = new Map(descriptors.map((d) => [d.id, d]));
  const visited = new Set<string>();
  const visiting = new Set<string>(); // cycle detection
  const sorted: PluginDescriptor[] = [];

  function visit(id: string, chain: string[]) {
    if (visited.has(id)) return;
    if (visiting.has(id)) {
      throw new Error(`Circular plugin dependency detected: ${[...chain, id].join(" → ")}`);
    }

    const descriptor = byId.get(id);
    if (!descriptor) return; // unknown dependency — skip silently

    visiting.add(id);

    for (const depId of descriptor.dependencies ?? []) {
      visit(depId, [...chain, id]);
    }

    visiting.delete(id);
    visited.add(id);
    sorted.push(descriptor);
  }

  for (const d of descriptors) {
    visit(d.id, []);
  }

  return sorted;
}

/** Manages lifecycle state for all registered plugins. */
export class PluginLifecycleRunner {
  /** Cleanup functions returned by onInit, keyed by pluginId. */
  private initCleanups = new Map<string, PluginLifecycleCleanup>();

  /** Cleanup function returned by the currently active plugin's onActivate. */
  private activateCleanup: PluginLifecycleCleanup | null = null;

  /** The currently active plugin ID (for deactivation tracking). */
  private activePluginId: string | null = null;

  /** Set of plugin IDs that have already been initialised. */
  private initialisedPlugins = new Set<string>();

  /**
   * Run onInit for a plugin. Safe to call multiple times — only runs once per plugin.
   */
  async init(descriptor: PluginDescriptor, api: PluginAPI): Promise<void> {
    if (this.initialisedPlugins.has(descriptor.id)) return;
    this.initialisedPlugins.add(descriptor.id);

    await withSpan(`plugin.init/${descriptor.id}`, async (span) => {
      span.setAttributes({ pluginId: descriptor.id, version: descriptor.version });

      // Run pending data migrations before lifecycle hooks
      if (descriptor.migrations?.length) {
        try {
          const result = await runPluginMigrations(
            api.db,
            descriptor.migrations,
            descriptor.version
          );
          if (result.applied > 0) {
            span.setAttribute("migrationsApplied", result.applied);
          }
        } catch (_err) {
          // Continue with init — the plugin should handle stale data gracefully
        }
      }

      const hook = descriptor.lifecycle?.onInit;
      if (!hook) return;

      try {
        const cleanup = await hook(api);
        if (cleanup) {
          this.initCleanups.set(descriptor.id, cleanup);
        }
      } catch (_err) {}
    });
  }

  /**
   * Run onActivate for a plugin. Automatically deactivates the previous plugin first.
   */
  async activate(descriptor: PluginDescriptor, api: PluginAPI): Promise<void> {
    // Deactivate previous plugin if different
    if (this.activePluginId && this.activePluginId !== descriptor.id) {
      await this.deactivate(api);
    }

    this.activePluginId = descriptor.id;

    const hook = descriptor.lifecycle?.onActivate;
    if (!hook) return;

    await withSpan(`plugin.activate/${descriptor.id}`, async (span) => {
      span.setAttribute("pluginId", descriptor.id);
      try {
        const cleanup = await hook(api);
        if (cleanup) {
          this.activateCleanup = cleanup;
        }
      } catch (_err) {}
    });
  }

  /**
   * Deactivate the currently active plugin.
   * Runs the onActivate cleanup (if any), then onDeactivate.
   */
  async deactivate(api: PluginAPI): Promise<void> {
    if (!this.activePluginId) return;

    // Run onActivate cleanup first
    if (this.activateCleanup) {
      try {
        await this.activateCleanup();
      } catch (_err) {}
      this.activateCleanup = null;
    }

    // Then run onDeactivate hook
    // Note: we need the descriptor to get the hook, but we look it up from registry
    // The caller should pass the right API; the hook itself handles plugin-specific logic
    const pluginId = this.activePluginId;
    this.activePluginId = null;

    // We import dynamically to avoid circular deps — the caller provides the descriptor
    // Instead, we store descriptors at init time
    const descriptor = this.descriptorCache.get(pluginId);
    const hook = descriptor?.lifecycle?.onDeactivate;
    if (!hook) return;

    try {
      await hook(api);
    } catch (_err) {}
  }

  /** Cache of descriptors for deactivation lookup. */
  private descriptorCache = new Map<string, PluginDescriptor>();

  /** Register a descriptor for later lookup (called during init). */
  registerDescriptor(descriptor: PluginDescriptor): void {
    this.descriptorCache.set(descriptor.id, descriptor);
  }

  /**
   * Destroy all plugins — runs onDestroy and onInit cleanups.
   * Called once when PluginHost unmounts.
   */
  async destroyAll(buildApi: (pluginId: string) => PluginAPI): Promise<void> {
    // Deactivate current plugin first
    if (this.activePluginId) {
      await this.deactivate(buildApi(this.activePluginId));
    }

    // Run onDestroy for each initialised plugin
    for (const pluginId of this.initialisedPlugins) {
      const descriptor = this.descriptorCache.get(pluginId);
      const hook = descriptor?.lifecycle?.onDestroy;
      if (hook) {
        try {
          await hook(buildApi(pluginId));
        } catch (_err) {}
      }
    }

    // Run onInit cleanups
    for (const [_pluginId, cleanup] of this.initCleanups) {
      try {
        await cleanup();
      } catch (_err) {}
    }

    this.initCleanups.clear();
    this.initialisedPlugins.clear();
    this.descriptorCache.clear();
    this.activateCleanup = null;
    this.activePluginId = null;
  }

  /** Get the currently active plugin ID (for testing). */
  getActivePluginId(): string | null {
    return this.activePluginId;
  }

  /** Check if a plugin has been initialised (for testing). */
  isInitialised(pluginId: string): boolean {
    return this.initialisedPlugins.has(pluginId);
  }
}
