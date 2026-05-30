"use client";

import { notificationEventBus } from "@radarboard/notifications/event-bus";
import { API_ROUTES, pluginDataListRoute, pluginDataRoute } from "@radarboard/types/api-routes";
import type { IntentPayload, IntentPayloadInput } from "@radarboard/types/intent";
import { createTemplateDescriptor } from "@radarboard/widget-engine/templates";
import { registerWidget, WIDGET_REGISTRY } from "@radarboard/widget-engine/widgets/registry";
import { type ReactNode, useCallback, useEffect, useMemo, useRef } from "react";
import { intentBus } from "./intent-bus";
import { PluginLifecycleRunner, topoSortPlugins } from "./lifecycle";
import { PLUGIN_REGISTRY } from "./registry";
import { callPluginService, listPluginServices } from "./rpc-bus";
import {
  isPluginNotificationIntegrationEnabled,
  type PluginAPI,
  type PluginDescriptor,
  type PluginPermission,
  type PluginUserConfig,
  pluginHasPermission,
} from "./types";
import { PluginAPIContext } from "./use-plugin-api";

// ---------------------------------------------------------------------------
// No-op API surfaces for denied permissions
// ---------------------------------------------------------------------------

const NOOP_DB: PluginAPI["db"] = {
  get: async () => null,
  set: async () => {},
  delete: async () => {},
  list: async () => [],
};

const NOOP_EVENTS: PluginAPI["events"] = {
  emit: () => {},
  on: () => () => {},
};

const NOOP_INTENTS: PluginAPI["intents"] = {
  resolveTargets: () => [],
  sendTo: async () => ({ success: false, message: "Permission denied: intents" }),
  sendToAssistant: async () => {},
};

const NOOP_HOTKEYS: PluginAPI["hotkeys"] = {
  register: () => () => {},
};

const NOOP_DATASOURCES: PluginAPI["dataSources"] = {
  isConnected: async () => false,
  getConnectionType: async () => null,
};

const NOOP_RPC: PluginAPI["rpc"] = {
  call: async () => ({ ok: false, error: "Permission denied: rpc" }),
  listServices: () => [],
};

async function trackPluginMount(pluginId: string): Promise<void> {
  await fetch(API_ROUTES.extensionsUsage, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      extensionId: pluginId,
      extensionType: "plugin",
      event: "mount",
    }),
  });
}

/** Apply permission gating to a PluginAPI. */
function applyPermissions(api: PluginAPI, descriptor: PluginDescriptor | undefined): PluginAPI {
  if (!descriptor?.permissions) return api; // No permissions declared = full access

  const has = (p: PluginPermission) => pluginHasPermission(descriptor, p);

  return {
    ...api,
    db: has("db") ? api.db : NOOP_DB,
    events: has("events") ? api.events : NOOP_EVENTS,
    intents: has("intents") ? api.intents : NOOP_INTENTS,
    hotkeys: has("hotkeys") ? api.hotkeys : NOOP_HOTKEYS,
    notify: has("notify") ? api.notify : () => {},
    dataSources: has("dataSources") ? api.dataSources : NOOP_DATASOURCES,
    projects: has("projects") ? api.projects : { list: async () => [] },
    rpc: has("rpc") ? api.rpc : NOOP_RPC,
  };
}

// ---------------------------------------------------------------------------
// Widget registration — runs once on mount, cleaned up on unmount
// ---------------------------------------------------------------------------

function registerPluginWidgets(
  plugins: PluginDescriptor[],
  pluginConfigs?: Map<string, PluginUserConfig>
): () => void {
  const registeredIds: string[] = [];

  for (const plugin of plugins) {
    if (!plugin.widgets) continue;
    const disabledWidgets = new Set(pluginConfigs?.get(plugin.id)?.disabledWidgets ?? []);

    for (const contribution of plugin.widgets) {
      if (disabledWidgets.has(contribution.widgetId)) continue;
      const namespacedId = `${plugin.id}__${contribution.widgetId}`;

      if (WIDGET_REGISTRY.has(namespacedId)) continue;

      const descriptor = createTemplateDescriptor(
        namespacedId,
        contribution.name,
        contribution.description,
        contribution.templateConfig,
        {
          requiredIntegrations: [
            ...(plugin.requiredIntegrations ?? []),
            ...(contribution.requiredIntegrations ?? []),
          ],
          defaultSlot: contribution.defaultSlot ?? "slot8",
          expandedSize: contribution.expandedSize,
          defaultPollInterval: contribution.defaultPollInterval,
          pollingSourceIds: contribution.pollingSourceIds,
        }
      );

      // Plugin-backed widgets open the plugin overlay instead of expanding in-place
      descriptor.expandAction = { type: "open-plugin", pluginId: plugin.id };

      registerWidget(descriptor as unknown as Parameters<typeof registerWidget>[0]);

      registeredIds.push(namespacedId);
    }
  }

  // Cleanup: remove plugin widgets from registry on unmount
  return () => {
    for (const id of registeredIds) {
      WIDGET_REGISTRY.delete(id);
    }
  };
}

// ---------------------------------------------------------------------------
// Plugin token cache — fetches and caches signed tokens for DB access
// ---------------------------------------------------------------------------

const pluginTokenCache = new Map<string, { token: string; expiresAt: number }>();
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // Refresh 5 minutes before expiry
const TOKEN_CACHE_TTL_MS = 55 * 60 * 1000; // Cache for 55 minutes (tokens last 1 hour)

export async function getPluginToken(pluginId: string): Promise<string> {
  const cached = pluginTokenCache.get(pluginId);
  if (cached && cached.expiresAt > Date.now() + TOKEN_REFRESH_BUFFER_MS) {
    return cached.token;
  }

  const res = await fetch(API_ROUTES.pluginToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pluginId }),
  });

  if (!res.ok) {
    throw new Error(`Failed to obtain plugin token for ${pluginId}`);
  }

  const { token } = (await res.json()) as { token: string };
  pluginTokenCache.set(pluginId, {
    token,
    expiresAt: Date.now() + TOKEN_CACHE_TTL_MS,
  });
  return token;
}

// ---------------------------------------------------------------------------
// buildPluginDB — reusable DB API factory for any plugin ID
// ---------------------------------------------------------------------------

function buildPluginDB(pluginId: string): PluginAPI["db"] {
  return {
    get: async <T,>(key: string): Promise<T | null> => {
      const token = await getPluginToken(pluginId);
      const res = await fetch(pluginDataRoute(pluginId, key), {
        headers: { "X-Plugin-Token": token },
      });
      if (!res.ok) return null;
      const json = await res.json();
      return json.value ? (JSON.parse(json.value) as T) : null;
    },

    set: async <T,>(key: string, value: T): Promise<void> => {
      const token = await getPluginToken(pluginId);
      await fetch(API_ROUTES.pluginData, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Plugin-Token": token,
        },
        body: JSON.stringify({
          pluginId,
          key,
          value: JSON.stringify(value),
        }),
      });
    },

    delete: async (key: string): Promise<void> => {
      const token = await getPluginToken(pluginId);
      await fetch(API_ROUTES.pluginData, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "X-Plugin-Token": token,
        },
        body: JSON.stringify({ pluginId, key }),
      });
    },

    list: async <T,>(prefix: string): Promise<T[]> => {
      const token = await getPluginToken(pluginId);
      const res = await fetch(pluginDataListRoute(pluginId, prefix), {
        headers: { "X-Plugin-Token": token },
      });
      if (!res.ok) return [];
      const json = await res.json();
      return (json.items ?? []).map((item: { value: string }) => JSON.parse(item.value)) as T[];
    },
  };
}

// ---------------------------------------------------------------------------
// buildPluginDataSources — reusable data-source connection check factory
// ---------------------------------------------------------------------------

function buildPluginDataSources(pluginId: string, db: PluginAPI["db"]): PluginAPI["dataSources"] {
  return {
    isConnected: async (sourceId: string): Promise<boolean> => {
      const descriptor = PLUGIN_REGISTRY.get(pluginId);
      const source = descriptor?.dataSources?.find((s) => s.id === sourceId);
      if (!source) return false;

      if (source.connectionTypes.includes("mcp") && source.mcpServerNames?.length) {
        const value = await db.get(`ds:${sourceId}:mcp`);
        if (value) return true;
      }

      if (source.connectionTypes.includes("oauth") || source.connectionTypes.includes("api_key")) {
        const credKey = source.integrationKey ?? sourceId;
        const value = await db.get(`ds:${sourceId}:cred:${credKey}`);
        if (value) return true;
      }

      return false;
    },

    getConnectionType: async (sourceId: string) => {
      const descriptor = PLUGIN_REGISTRY.get(pluginId);
      const source = descriptor?.dataSources?.find((s) => s.id === sourceId);
      if (!source) return null;

      if (source.connectionTypes.includes("mcp") && source.mcpServerNames?.length) {
        const value = await db.get(`ds:${sourceId}:mcp`);
        if (value) return "mcp" as const;
      }

      if (source.connectionTypes.includes("oauth")) {
        const credKey = source.integrationKey ?? sourceId;
        const value = await db.get(`ds:${sourceId}:cred:${credKey}`);
        if (value) return "oauth" as const;
      }

      if (source.connectionTypes.includes("api_key")) {
        const credKey = source.integrationKey ?? sourceId;
        const value = await db.get(`ds:${sourceId}:cred:${credKey}`);
        if (value) return "api_key" as const;
      }

      return null;
    },
  };
}

// ---------------------------------------------------------------------------
// PluginHost Props
// ---------------------------------------------------------------------------

export interface PluginHostProps {
  children: ReactNode;
  /** Active plugin ID from URL param — drives overlay rendering. */
  activePluginId: string | null;
  /** Callback to update the active plugin URL param. */
  onActivePluginChange: (pluginId: string | null) => void;
  /** Toast function from the app layer (e.g. sonner's toast). */
  notify: (message: string, type?: "info" | "success" | "error") => void;
  /** Per-plugin user config overrides. */
  pluginConfigs?: Map<string, PluginUserConfig>;
  /** App-level project list for plugin access. */
  projects?: Array<{ slug: string; name: string; color: string }>;
  /** Global reactive search parameters */
  searchParams?: URLSearchParams;
  /** Callback to send an item to the assistant chat. Wired by the app layer. */
  onSendToAssistant?: (payload: IntentPayloadInput, promptHint?: string) => Promise<void>;
}

// ---------------------------------------------------------------------------
// PluginHost Provider
// ---------------------------------------------------------------------------

export function PluginHost({
  children,
  activePluginId,
  onActivePluginChange,
  notify,
  pluginConfigs,
  projects: projectsProp,
  searchParams,
  onSendToAssistant,
}: PluginHostProps) {
  const cleanupRef = useRef<(() => void) | null>(null);

  // Register all plugin widget contributions on mount (re-register when configs change)
  useEffect(() => {
    cleanupRef.current?.();
    const plugins = Array.from(PLUGIN_REGISTRY.values());
    cleanupRef.current = registerPluginWidgets(plugins, pluginConfigs);

    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [pluginConfigs]);

  // ---------------------------------------------------------------------------
  // Lifecycle runner — stable across renders
  // ---------------------------------------------------------------------------
  const lifecycleRef = useRef<PluginLifecycleRunner | null>(null);
  if (!lifecycleRef.current) {
    lifecycleRef.current = new PluginLifecycleRunner();
  }

  const close = useCallback(() => {
    onActivePluginChange(null);
  }, [onActivePluginChange]);

  // Build a PluginAPI scoped to any plugin ID. Used both for the active
  // plugin and for intent dispatch (where the target is a different plugin).
  const buildPluginAPI = useCallback(
    (pluginId: string): PluginAPI => {
      const pluginDescriptor = PLUGIN_REGISTRY.get(pluginId);
      const pluginConfig = pluginConfigs?.get(pluginId);
      const notificationsEnabled = pluginDescriptor
        ? isPluginNotificationIntegrationEnabled(pluginDescriptor, pluginConfig)
        : false;

      const pluginDB = buildPluginDB(pluginId);

      const api: PluginAPI = {
        widgets: {
          getState: (_widgetId: string) => {
            // Returns null until widget data resolution is wired up
            return null;
          },
        },

        db: pluginDB,

        hotkeys: {
          register: (key: string, handler: () => void) => {
            const listener = (e: KeyboardEvent) => {
              const parts = key.toLowerCase().split("+");
              const mainKey = parts.pop();
              const needsMod =
                parts.includes("mod") || parts.includes("meta") || parts.includes("ctrl");
              const needsShift = parts.includes("shift");
              const needsAlt = parts.includes("alt");

              if (needsMod && !(e.metaKey || e.ctrlKey)) return;
              if (needsShift && !e.shiftKey) return;
              if (needsAlt && !e.altKey) return;
              if (e.key.toLowerCase() !== mainKey) return;

              e.preventDefault();
              handler();
            };

            window.addEventListener("keydown", listener);
            return () => window.removeEventListener("keydown", listener);
          },
        },

        notify,
        close,

        intents: {
          resolveTargets: (payload: IntentPayload) => {
            return intentBus.resolveTargets(payload);
          },
          sendTo: async (targetPluginId, action, payload: IntentPayloadInput) => {
            const fullPayload = {
              ...payload,
              sourcePluginId: pluginId,
            } as IntentPayload;
            return intentBus.dispatch(targetPluginId, action, fullPayload, buildPluginAPI);
          },
          sendToAssistant: async (payload: IntentPayloadInput, promptHint?: string) => {
            if (onSendToAssistant) {
              await onSendToAssistant(payload, promptHint);
            }
          },
        },

        projects: {
          list: async () => projectsProp ?? [],
        },

        searchParams: searchParams ?? new URLSearchParams(),

        events: {
          emit: (event) => {
            if (!notificationsEnabled) return;
            fetch(API_ROUTES.notificationEmit, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                source: `plugin:${pluginId}`,
                type: event.type,
                severity: event.severity,
                title: event.title,
                body: event.body ?? null,
                metadata: event.metadata ?? {},
              }),
            }).catch(() => {});
          },
          on: (filter, handler) => {
            return notificationEventBus.on(
              {
                source: filter.source,
                type: filter.type,
              },
              handler
            );
          },
        },

        dataSources: buildPluginDataSources(pluginId, pluginDB),

        rpc: {
          call: <T = unknown>(targetPluginId: string, action: string, params?: unknown) =>
            callPluginService<T>(targetPluginId, action, params, buildPluginAPI),
          listServices: listPluginServices,
        },
      };

      return applyPermissions(api, pluginDescriptor);
    },
    [close, notify, onSendToAssistant, pluginConfigs, projectsProp, searchParams]
  );

  // ---------------------------------------------------------------------------
  // Lifecycle: onInit — run once per plugin at mount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const runner = lifecycleRef.current;
    if (!runner) return;

    const plugins = Array.from(PLUGIN_REGISTRY.values());
    // Sort by dependencies so plugins are initialized after their deps
    const sorted = topoSortPlugins(plugins);
    for (const descriptor of sorted) {
      runner.registerDescriptor(descriptor);
      runner.init(descriptor, buildPluginAPI(descriptor.id));
    }

    // Destroy all on unmount
    return () => {
      runner.destroyAll(buildPluginAPI);
    };
    // Only run on mount/unmount — buildPluginAPI is stable enough via useCallback
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // Lifecycle: onActivate / onDeactivate — track active plugin changes
  // ---------------------------------------------------------------------------
  const prevActiveRef = useRef<string | null>(null);

  useEffect(() => {
    const runner = lifecycleRef.current;
    if (!runner) return;

    const prev = prevActiveRef.current;
    prevActiveRef.current = activePluginId;

    // Deactivate previous plugin
    if (prev && prev !== activePluginId) {
      const prevDescriptor = PLUGIN_REGISTRY.get(prev);
      if (prevDescriptor) {
        runner.deactivate(buildPluginAPI(prev));
      }
    }

    // Activate new plugin
    if (activePluginId) {
      const descriptor = PLUGIN_REGISTRY.get(activePluginId);
      if (descriptor) {
        runner.activate(descriptor, buildPluginAPI(activePluginId));
        // Best-effort usage tracking
        trackPluginMount(activePluginId).catch(() => {});
      }
    }
  }, [activePluginId, buildPluginAPI]);

  // Build the PluginAPI for the active plugin
  const api: PluginAPI = useMemo(() => {
    if (!activePluginId) {
      // Return a no-op API when no plugin is active
      return buildPluginAPI("__none__");
    }
    return buildPluginAPI(activePluginId);
  }, [activePluginId, buildPluginAPI]);

  return <PluginAPIContext.Provider value={api}>{children}</PluginAPIContext.Provider>;
}
