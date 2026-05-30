import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { PLUGIN_REGISTRY, registerPlugin } from "./registry";
import { callPluginService, listPluginServices } from "./rpc-bus";
import type { PluginAPI, PluginDescriptor } from "./types";

function mockApi(): PluginAPI {
  return {
    widgets: { getState: vi.fn() },
    db: { get: vi.fn(), set: vi.fn(), delete: vi.fn(), list: vi.fn() },
    hotkeys: { register: vi.fn() },
    notify: vi.fn(),
    close: vi.fn(),
    events: { emit: vi.fn(), on: vi.fn() },
    projects: { list: vi.fn() },
    searchParams: new URLSearchParams(),
    intents: { resolveTargets: vi.fn(), sendTo: vi.fn(), sendToAssistant: vi.fn() },
    dataSources: { isConnected: vi.fn(), getConnectionType: vi.fn() },
    rpc: { call: vi.fn(), listServices: vi.fn() },
  } as unknown as PluginAPI;
}

function makePlugin(id: string, services: PluginDescriptor["services"] = []): PluginDescriptor {
  return {
    id,
    name: id,
    description: `Plugin ${id}`,
    icon: () => null,
    version: "1.0.0",
    launchSurfaces: ["palette"],
    presentation: "modal",
    component: () => null,
    services,
  } as unknown as PluginDescriptor;
}

afterEach(() => {
  PLUGIN_REGISTRY.clear();
});

describe("callPluginService", () => {
  it("calls a service and returns the result", async () => {
    registerPlugin(
      makePlugin("tasks", [
        {
          action: "list-tasks",
          parameters: z.object({ tag: z.string().optional() }),
          handler: async (params) => {
            const { tag } = params as { tag?: string };
            return tag ? [`task-${tag}`] : ["task-1", "task-2"];
          },
        },
      ])
    );

    const result = await callPluginService("tasks", "list-tasks", { tag: "release" }, mockApi);
    expect(result).toEqual({ ok: true, data: ["task-release"] });
  });

  it("returns error for unknown plugin", async () => {
    const result = await callPluginService("nonexistent", "foo", {}, mockApi);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("not found");
    }
  });

  it("returns error for unknown action", async () => {
    registerPlugin(makePlugin("tasks"));

    const result = await callPluginService("tasks", "nonexistent", {}, mockApi);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("no service");
    }
  });

  it("validates params with Zod and rejects invalid input", async () => {
    registerPlugin(
      makePlugin("tasks", [
        {
          action: "create-task",
          parameters: z.object({ title: z.string().min(1) }),
          handler: async () => ({ id: "1" }),
        },
      ])
    );

    const result = await callPluginService("tasks", "create-task", { title: "" }, mockApi);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Invalid params");
    }
  });

  it("catches handler errors and returns structured error", async () => {
    registerPlugin(
      makePlugin("tasks", [
        {
          action: "failing",
          parameters: z.object({}),
          handler: async () => {
            throw new Error("DB connection lost");
          },
        },
      ])
    );

    const result = await callPluginService("tasks", "failing", {}, mockApi);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("DB connection lost");
    }
  });

  it("passes empty object when params omitted", async () => {
    const handler = vi.fn().mockResolvedValue("ok");
    registerPlugin(
      makePlugin("tasks", [
        {
          action: "ping",
          parameters: z.object({}),
          handler,
        },
      ])
    );

    await callPluginService("tasks", "ping", undefined, mockApi);
    expect(handler).toHaveBeenCalledWith({}, expect.anything());
  });
});

describe("listPluginServices", () => {
  it("lists services from all plugins", () => {
    registerPlugin(
      makePlugin("tasks", [
        {
          action: "list-tasks",
          description: "List tasks",
          parameters: z.object({}),
          handler: vi.fn(),
        },
        { action: "create-task", parameters: z.object({}), handler: vi.fn() },
      ])
    );
    registerPlugin(
      makePlugin("notes", [
        {
          action: "search",
          description: "Search notes",
          parameters: z.object({}),
          handler: vi.fn(),
        },
      ])
    );

    const services = listPluginServices();
    expect(services).toHaveLength(3);
    expect(services).toContainEqual({
      pluginId: "tasks",
      action: "list-tasks",
      description: "List tasks",
    });
    expect(services).toContainEqual({
      pluginId: "notes",
      action: "search",
      description: "Search notes",
    });
  });

  it("returns empty array when no services declared", () => {
    registerPlugin(makePlugin("empty"));
    expect(listPluginServices()).toEqual([]);
  });
});
