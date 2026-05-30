import type { IntentPayload } from "@radarboard/types/intent";
import { intentBus } from "./intent-bus";
import { PLUGIN_REGISTRY, registerPlugin } from "./registry";
import type { PluginAPI, PluginDescriptor } from "./types";

// ---------------------------------------------------------------------------
// Tracked mock PluginAPI — records calls for assertion
// ---------------------------------------------------------------------------

/** A mock PluginAPI that records all calls (notifications, events, close) for test assertions. */
export interface TrackedPluginAPI extends PluginAPI {
  /** All `notify()` calls recorded as `{ message, type }`. */
  notifications: Array<{ message: string; type?: string }>;
  /** Number of times `close()` was called. */
  closeCount: number;
  /** All events emitted via `events.emit()`. */
  emittedEvents: Array<{
    type: string;
    severity: string;
    title: string;
    body?: string | null;
    metadata?: Record<string, unknown>;
  }>;
  /** Direct access to the in-memory DB store for assertions. */
  dbStore: Map<string, string>;
  /** Reset all tracked state (notifications, events, close count). */
  resetTracking: () => void;
}

/**
 * Create a mock PluginAPI backed by an in-memory Map.
 * Useful for testing MCP tools and plugin logic.
 */
export function createMockPluginAPI(
  pluginId?: string,
  store?: Map<string, string>
): TrackedPluginAPI {
  const dbStore = store ?? new Map<string, string>();
  const notifications: TrackedPluginAPI["notifications"] = [];
  const emittedEvents: TrackedPluginAPI["emittedEvents"] = [];
  let closeCount = 0;

  const api: TrackedPluginAPI = {
    notifications,
    closeCount: 0,
    emittedEvents,
    dbStore,
    resetTracking: () => {
      notifications.length = 0;
      emittedEvents.length = 0;
      closeCount = 0;
      api.closeCount = 0;
    },

    widgets: {
      getState: () => null,
    },
    db: {
      get: async <T>(key: string): Promise<T | null> => {
        const value = dbStore.get(key);
        return value ? (JSON.parse(value) as T) : null;
      },
      set: async <T>(key: string, value: T): Promise<void> => {
        dbStore.set(key, JSON.stringify(value));
      },
      delete: async (key: string): Promise<void> => {
        dbStore.delete(key);
      },
      list: async <T>(prefix: string): Promise<T[]> => {
        const results: T[] = [];
        for (const [k, v] of dbStore) {
          if (k.startsWith(prefix)) {
            results.push(JSON.parse(v) as T);
          }
        }
        return results;
      },
    },
    hotkeys: {
      register: () => () => {
        /* noop cleanup */
      },
    },
    notify: (message: string, type?: "info" | "success" | "error") => {
      notifications.push({ message, type });
    },
    close: () => {
      closeCount++;
      api.closeCount = closeCount;
    },
    projects: {
      list: async () => [],
    },
    searchParams: new URLSearchParams(),
    intents: {
      resolveTargets: (payload) => intentBus.resolveTargets(payload),
      sendTo: async (targetPluginId, action, payloadInput) => {
        const fullPayload = {
          ...payloadInput,
          sourcePluginId: pluginId ?? "__test__",
        } as IntentPayload;
        return intentBus.dispatch(targetPluginId, action, fullPayload, (pid) =>
          createMockPluginAPI(pid, pluginStores.get(pid))
        );
      },
      sendToAssistant: async () => {
        /* noop */
      },
    },
    dataSources: {
      isConnected: async () => false,
      getConnectionType: async () => null,
    },
    rpc: {
      call: async () => ({ ok: false, error: "RPC not implemented in test harness" }),
      listServices: () => [],
    },
    events: {
      emit: (event) => {
        emittedEvents.push(event);
      },
      on: () => () => {
        /* noop cleanup */
      },
    },
  };

  return api;
}

// ---------------------------------------------------------------------------
// Plugin host test harness — registers descriptors and wires real intents
// ---------------------------------------------------------------------------

/** Per-plugin DB stores used by the test host. */
const pluginStores = new Map<string, Map<string, string>>();

/** Test harness that registers plugin descriptors and provides scoped, tracked APIs with real intent dispatch. */
export interface TestPluginHost {
  /** Get a tracked PluginAPI scoped to a plugin. */
  getAPI: (pluginId: string) => TrackedPluginAPI;
  /** Get the in-memory DB store for a plugin. */
  getStore: (pluginId: string) => Map<string, string>;
  /** Clean up: clear registry and all stores. */
  cleanup: () => void;
}

/**
 * Create a test plugin host that registers descriptors and provides
 * scoped, tracked PluginAPIs with real intent dispatch.
 *
 * Usage:
 * ```ts
 * const host = createTestPluginHost([tasksDescriptor, notesDescriptor]);
 * const tasksApi = host.getAPI("tasks");
 * // ... run tests ...
 * host.cleanup();
 * ```
 */
export function createTestPluginHost(descriptors: PluginDescriptor[]): TestPluginHost {
  // Clear any existing registrations
  PLUGIN_REGISTRY.clear();
  pluginStores.clear();

  // Register all descriptors
  for (const d of descriptors) {
    registerPlugin(d);
    pluginStores.set(d.id, new Map());
  }

  const apis = new Map<string, TrackedPluginAPI>();

  function getAPI(pluginId: string): TrackedPluginAPI {
    let api = apis.get(pluginId);
    if (!api) {
      const store = pluginStores.get(pluginId) ?? new Map<string, string>();
      pluginStores.set(pluginId, store);
      api = createMockPluginAPI(pluginId, store);
      apis.set(pluginId, api);
    }
    return api;
  }

  function getStore(pluginId: string): Map<string, string> {
    let store = pluginStores.get(pluginId);
    if (!store) {
      store = new Map();
      pluginStores.set(pluginId, store);
    }
    return store;
  }

  function cleanup(): void {
    PLUGIN_REGISTRY.clear();
    pluginStores.clear();
    apis.clear();
  }

  return { getAPI, getStore, cleanup };
}
