import { beforeEach, describe, expect, it } from "vitest";
import { getAllPlugins, getPlugin, PLUGIN_REGISTRY, registerPlugin } from "./registry";
import type { PluginDescriptor } from "./types";

function makeDescriptor(id: string): PluginDescriptor {
  return {
    id,
    name: `Plugin ${id}`,
    description: `Test plugin ${id}`,
    icon: () => null,
    version: "1.0.0",
    launchSurfaces: ["palette"],
    presentation: "modal",
    component: () => null,
  } as unknown as PluginDescriptor;
}

describe("Plugin Registry", () => {
  beforeEach(() => {
    PLUGIN_REGISTRY.clear();
  });

  describe("registerPlugin", () => {
    it("registers a plugin into the registry", () => {
      const descriptor = makeDescriptor("test-plugin");
      registerPlugin(descriptor);

      expect(PLUGIN_REGISTRY.size).toBe(1);
      expect(PLUGIN_REGISTRY.get("test-plugin")).toBe(descriptor);
    });

    it("treats duplicate plugin registration as idempotent", () => {
      const descriptor = makeDescriptor("dup");
      registerPlugin(descriptor);
      registerPlugin(makeDescriptor("dup"));

      expect(PLUGIN_REGISTRY.size).toBe(1);
      expect(PLUGIN_REGISTRY.get("dup")).toBe(descriptor);
    });

    it("allows multiple plugins with different IDs", () => {
      registerPlugin(makeDescriptor("a"));
      registerPlugin(makeDescriptor("b"));
      registerPlugin(makeDescriptor("c"));

      expect(PLUGIN_REGISTRY.size).toBe(3);
    });
  });

  describe("getPlugin", () => {
    it("returns a registered plugin by ID", () => {
      const descriptor = makeDescriptor("my-plugin");
      registerPlugin(descriptor);

      expect(getPlugin("my-plugin")).toBe(descriptor);
    });

    it("returns undefined for unknown plugin IDs", () => {
      expect(getPlugin("nonexistent")).toBeUndefined();
    });
  });

  describe("getAllPlugins", () => {
    it("returns empty array when no plugins registered", () => {
      expect(getAllPlugins()).toEqual([]);
    });

    it("returns all registered plugins as an array", () => {
      registerPlugin(makeDescriptor("x"));
      registerPlugin(makeDescriptor("y"));

      const all = getAllPlugins();
      expect(all).toHaveLength(2);
      expect(all.map((p) => p.id)).toEqual(["x", "y"]);
    });
  });
});
