import { beforeEach, describe, expect, it, vi } from "vitest";
import { PluginLifecycleRunner, topoSortPlugins } from "./lifecycle";
import type { PluginAPI, PluginDescriptor } from "./types";

/** Minimal mock PluginAPI — lifecycle hooks only need the interface shape. */
function mockApi(): PluginAPI {
  return {
    widgets: { getState: vi.fn() },
    db: {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      list: vi.fn(),
    },
    hotkeys: { register: vi.fn() },
    notify: vi.fn(),
    close: vi.fn(),
    events: { emit: vi.fn(), on: vi.fn() },
    projects: { list: vi.fn() },
    searchParams: new URLSearchParams(),
    intents: {
      resolveTargets: vi.fn(),
      sendTo: vi.fn(),
      sendToAssistant: vi.fn(),
    },
    dataSources: {
      isConnected: vi.fn(),
      getConnectionType: vi.fn(),
    },
    rpc: {
      call: vi.fn(),
      listServices: vi.fn(() => []),
    },
  };
}

function makeDescriptor(id: string, hooks: PluginDescriptor["lifecycle"] = {}): PluginDescriptor {
  return {
    id,
    name: id,
    description: `Test plugin ${id}`,
    icon: () => null,
    category: "productivity",
    version: "1.0.0",
    launchSurfaces: [],
    presentation: "fullscreen",
    component: () => null,
    lifecycle: hooks,
  } as unknown as PluginDescriptor;
}

describe("PluginLifecycleRunner", () => {
  let runner: PluginLifecycleRunner;
  let api: PluginAPI;

  beforeEach(() => {
    runner = new PluginLifecycleRunner();
    api = mockApi();
  });

  describe("init", () => {
    it("calls onInit once and marks the plugin as initialised", async () => {
      const onInit = vi.fn().mockResolvedValue(undefined);
      const desc = makeDescriptor("notes", { onInit });

      runner.registerDescriptor(desc);
      await runner.init(desc, api);

      expect(onInit).toHaveBeenCalledTimes(1);
      expect(onInit).toHaveBeenCalledWith(api);
      expect(runner.isInitialised("notes")).toBe(true);
    });

    it("does not call onInit a second time", async () => {
      const onInit = vi.fn().mockResolvedValue(undefined);
      const desc = makeDescriptor("notes", { onInit });

      runner.registerDescriptor(desc);
      await runner.init(desc, api);
      await runner.init(desc, api);

      expect(onInit).toHaveBeenCalledTimes(1);
    });

    it("stores the cleanup returned by onInit", async () => {
      const cleanup = vi.fn();
      const onInit = vi.fn().mockResolvedValue(cleanup);
      const desc = makeDescriptor("notes", { onInit });

      runner.registerDescriptor(desc);
      await runner.init(desc, api);
      await runner.destroyAll(() => api);

      expect(cleanup).toHaveBeenCalledTimes(1);
    });

    it("handles onInit errors gracefully", async () => {
      const onInit = vi.fn().mockRejectedValue(new Error("init boom"));
      const desc = makeDescriptor("broken", { onInit });

      runner.registerDescriptor(desc);
      await runner.init(desc, api);

      // Plugin is still marked as initialised (prevent retry loops)
      expect(runner.isInitialised("broken")).toBe(true);
    });
  });

  describe("activate / deactivate", () => {
    it("calls onActivate and tracks the active plugin", async () => {
      const onActivate = vi.fn().mockResolvedValue(undefined);
      const desc = makeDescriptor("tasks", { onActivate });

      runner.registerDescriptor(desc);
      await runner.activate(desc, api);

      expect(onActivate).toHaveBeenCalledTimes(1);
      expect(runner.getActivePluginId()).toBe("tasks");
    });

    it("calls onDeactivate when switching plugins", async () => {
      const onDeactivate = vi.fn().mockResolvedValue(undefined);
      const desc1 = makeDescriptor("tasks", { onDeactivate });
      const desc2 = makeDescriptor("notes", {});

      runner.registerDescriptor(desc1);
      runner.registerDescriptor(desc2);
      await runner.activate(desc1, api);
      await runner.activate(desc2, api);

      expect(onDeactivate).toHaveBeenCalledTimes(1);
      expect(runner.getActivePluginId()).toBe("notes");
    });

    it("runs onActivate cleanup before onDeactivate", async () => {
      const order: string[] = [];
      const activateCleanup = vi.fn().mockImplementation(() => {
        order.push("activate-cleanup");
      });
      const onActivate = vi.fn().mockResolvedValue(activateCleanup);
      const onDeactivate = vi.fn().mockImplementation(() => {
        order.push("deactivate");
      });

      const desc1 = makeDescriptor("tasks", { onActivate, onDeactivate });
      const desc2 = makeDescriptor("notes", {});

      runner.registerDescriptor(desc1);
      runner.registerDescriptor(desc2);
      await runner.activate(desc1, api);
      await runner.activate(desc2, api);

      expect(order).toEqual(["activate-cleanup", "deactivate"]);
    });

    it("explicit deactivate clears the active plugin", async () => {
      const desc = makeDescriptor("tasks", {});
      runner.registerDescriptor(desc);
      await runner.activate(desc, api);
      await runner.deactivate(api);

      expect(runner.getActivePluginId()).toBeNull();
    });
  });

  describe("destroyAll", () => {
    it("calls onDestroy for all initialised plugins", async () => {
      const onDestroy1 = vi.fn().mockResolvedValue(undefined);
      const onDestroy2 = vi.fn().mockResolvedValue(undefined);
      const desc1 = makeDescriptor("tasks", { onDestroy: onDestroy1 });
      const desc2 = makeDescriptor("notes", { onDestroy: onDestroy2 });

      runner.registerDescriptor(desc1);
      runner.registerDescriptor(desc2);
      await runner.init(desc1, api);
      await runner.init(desc2, api);
      await runner.destroyAll(() => api);

      expect(onDestroy1).toHaveBeenCalledTimes(1);
      expect(onDestroy2).toHaveBeenCalledTimes(1);
    });

    it("deactivates the current plugin before destroying", async () => {
      const order: string[] = [];
      const onDeactivate = vi.fn().mockImplementation(() => order.push("deactivate"));
      const onDestroy = vi.fn().mockImplementation(() => order.push("destroy"));

      const desc = makeDescriptor("tasks", { onDeactivate, onDestroy });
      runner.registerDescriptor(desc);
      await runner.init(desc, api);
      await runner.activate(desc, api);
      await runner.destroyAll(() => api);

      expect(order).toEqual(["deactivate", "destroy"]);
    });

    it("resets all state after destroy", async () => {
      const desc = makeDescriptor("tasks", {});
      runner.registerDescriptor(desc);
      await runner.init(desc, api);
      await runner.activate(desc, api);
      await runner.destroyAll(() => api);

      expect(runner.isInitialised("tasks")).toBe(false);
      expect(runner.getActivePluginId()).toBeNull();
    });
  });

  describe("no-op when hooks are not defined", () => {
    it("init does nothing for a plugin without lifecycle hooks", async () => {
      const desc = makeDescriptor("plain", undefined);
      runner.registerDescriptor(desc);
      await runner.init(desc, api);

      expect(runner.isInitialised("plain")).toBe(true);
    });

    it("activate/deactivate do nothing without hooks", async () => {
      const desc = makeDescriptor("plain", {});
      runner.registerDescriptor(desc);
      await runner.activate(desc, api);
      await runner.deactivate(api);

      // No errors thrown
      expect(runner.getActivePluginId()).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// Topological sort tests
// ---------------------------------------------------------------------------

describe("topoSortPlugins", () => {
  function stub(id: string, deps?: string[]): PluginDescriptor {
    return {
      ...makeDescriptor(id),
      dependencies: deps,
    };
  }

  it("returns plugins in dependency order", () => {
    const a = stub("a");
    const b = stub("b", ["a"]);
    const c = stub("c", ["b"]);

    const sorted = topoSortPlugins([c, a, b]);
    const ids = sorted.map((d) => d.id);
    expect(ids).toEqual(["a", "b", "c"]);
  });

  it("handles plugins with no dependencies", () => {
    const a = stub("a");
    const b = stub("b");
    const sorted = topoSortPlugins([a, b]);
    expect(sorted).toHaveLength(2);
  });

  it("throws on circular dependencies", () => {
    const a = stub("a", ["b"]);
    const b = stub("b", ["a"]);

    expect(() => topoSortPlugins([a, b])).toThrow("Circular plugin dependency");
  });

  it("throws on self-dependency", () => {
    const a = stub("a", ["a"]);
    expect(() => topoSortPlugins([a])).toThrow("Circular plugin dependency");
  });

  it("handles diamond dependencies", () => {
    const a = stub("a");
    const b = stub("b", ["a"]);
    const c = stub("c", ["a"]);
    const d = stub("d", ["b", "c"]);

    const sorted = topoSortPlugins([d, c, b, a]);
    const ids = sorted.map((p) => p.id);

    // a must come before b and c; b and c must come before d
    expect(ids.indexOf("a")).toBeLessThan(ids.indexOf("b"));
    expect(ids.indexOf("a")).toBeLessThan(ids.indexOf("c"));
    expect(ids.indexOf("b")).toBeLessThan(ids.indexOf("d"));
    expect(ids.indexOf("c")).toBeLessThan(ids.indexOf("d"));
  });

  it("ignores unknown dependencies gracefully", () => {
    const a = stub("a", ["unknown-plugin"]);
    const sorted = topoSortPlugins([a]);
    expect(sorted.map((d) => d.id)).toEqual(["a"]);
  });
});
