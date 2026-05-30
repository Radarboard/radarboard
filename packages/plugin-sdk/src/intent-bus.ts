import type { IntentPayload, IntentResult } from "@radarboard/types/intent";
import { PLUGIN_REGISTRY } from "./registry";
import type { PluginAPI, ResolvedIntentTarget } from "./types";

// ---------------------------------------------------------------------------
// IntentBus — thin resolution + dispatch layer for cross-plugin intents
// ---------------------------------------------------------------------------

class IntentBus {
  /**
   * Resolve which plugins can handle a given payload.
   * Used by the UI to populate the "Send to…" context menu.
   */
  resolveTargets(payload: IntentPayload): ResolvedIntentTarget[] {
    const targets: ResolvedIntentTarget[] = [];

    for (const [pluginId, descriptor] of PLUGIN_REGISTRY) {
      if (!descriptor.intents) continue;
      // Skip sending to self
      if (pluginId === payload.sourcePluginId) continue;

      for (const handler of descriptor.intents) {
        if (handler.accepts.includes(payload.kind)) {
          targets.push({
            pluginId,
            pluginName: descriptor.name,
            pluginIcon: descriptor.icon,
            action: handler.action,
            label: handler.label,
            description: handler.description,
            icon: handler.icon,
          });
        }
      }
    }

    return targets;
  }

  /**
   * Dispatch a payload to a specific plugin's intent handler.
   * The caller must provide a factory to build a PluginAPI scoped to the target plugin.
   */
  async dispatch(
    targetPluginId: string,
    action: string,
    payload: IntentPayload,
    buildAPI: (pluginId: string) => PluginAPI
  ): Promise<IntentResult> {
    const descriptor = PLUGIN_REGISTRY.get(targetPluginId);
    if (!descriptor?.intents) {
      return { success: false, message: `Plugin "${targetPluginId}" not found or has no intents.` };
    }

    const handler = descriptor.intents.find((h) => h.action === action);
    if (!handler) {
      return {
        success: false,
        message: `Plugin "${targetPluginId}" has no handler for action "${action}".`,
      };
    }

    if (!handler.accepts.includes(payload.kind)) {
      return {
        success: false,
        message: `Handler "${action}" does not accept payload kind "${payload.kind}".`,
      };
    }

    const api = buildAPI(targetPluginId);
    return handler.handle(payload, api);
  }
}

/** Singleton intent bus for resolving and dispatching cross-plugin intents. */
export const intentBus = new IntentBus();
