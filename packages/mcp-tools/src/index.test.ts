import { PLUGIN_REGISTRY, registerPlugin } from "@radarboard/plugin-sdk/registry";
import { createMockPluginAPI } from "@radarboard/plugin-sdk/testing";
import type { PluginAPI, PluginDescriptor } from "@radarboard/plugin-sdk/types";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { buildMcpRouter } from "./index";
import type { McpRequest, McpResponse } from "./types";

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

/** Minimal plugin descriptor with MCP tools for testing. */
function makeTestPlugin(id: string, tools: PluginDescriptor["mcpTools"] = []): PluginDescriptor {
  return {
    id,
    name: id,
    description: `Test plugin: ${id}`,
    category: "productivity",
    version: "0.0.1",
    icon: () => null,
    launchSurfaces: [],
    presentation: "modal",
    component: () => null,
    mcpTools: tools,
  };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

describe("buildMcpRouter", () => {
  let api: PluginAPI;
  let router: (req: McpRequest) => Promise<McpResponse>;

  beforeEach(() => {
    PLUGIN_REGISTRY.clear();
    api = createMockPluginAPI();
    router = buildMcpRouter(() => api);
  });

  /* ---- tools/list ------------------------------------------------ */

  describe("tools/list", () => {
    it("returns empty list when no plugins are registered", async () => {
      const res = await router({ method: "tools/list" });
      expect(res.tools).toEqual([]);
    });

    it("returns namespaced tools from registered plugins", async () => {
      registerPlugin(
        makeTestPlugin("alpha", [
          {
            name: "ping",
            description: "Ping",
            parameters: z.object({}),
            execute: async () => ({ pong: true }),
          },
        ])
      );

      const res = await router({ method: "tools/list" });
      expect(res.tools).toHaveLength(1);
      expect(res.tools?.[0]?.name).toBe("alpha__ping");
      expect(res.tools?.[0]?.description).toBe("Ping");
      expect(res.tools?.[0]?.inputSchema).toBeDefined();
    });

    it("aggregates tools from multiple plugins", async () => {
      registerPlugin(
        makeTestPlugin("a", [
          {
            name: "t1",
            description: "Tool 1",
            parameters: z.object({}),
            execute: async () => ({}),
          },
        ])
      );
      registerPlugin(
        makeTestPlugin("b", [
          {
            name: "t2",
            description: "Tool 2",
            parameters: z.object({}),
            execute: async () => ({}),
          },
          {
            name: "t3",
            description: "Tool 3",
            parameters: z.object({}),
            execute: async () => ({}),
          },
        ])
      );

      const res = await router({ method: "tools/list" });
      expect(res.tools).toHaveLength(3);
      expect((res.tools ?? []).map((t) => t.name)).toEqual(["a__t1", "b__t2", "b__t3"]);
    });

    it("skips plugins without mcpTools", async () => {
      registerPlugin(makeTestPlugin("no-tools"));

      const res = await router({ method: "tools/list" });
      expect(res.tools).toEqual([]);
    });

    it("skips disabled plugins and individually disabled tools", async () => {
      registerPlugin(
        makeTestPlugin("alpha", [
          {
            name: "visible",
            description: "Visible tool",
            parameters: z.object({}),
            execute: async () => ({}),
          },
          {
            name: "hidden",
            description: "Hidden tool",
            parameters: z.object({}),
            execute: async () => ({}),
          },
        ])
      );
      registerPlugin(
        makeTestPlugin("beta", [
          {
            name: "disabled-by-plugin",
            description: "Disabled plugin tool",
            parameters: z.object({}),
            execute: async () => ({}),
          },
        ])
      );

      const filteredRouter = buildMcpRouter(
        () => api,
        new Set(["beta"]),
        new Map([["alpha", { disabledTools: ["hidden"] }]])
      );

      const res = await filteredRouter({ method: "tools/list" });
      expect((res.tools ?? []).map((tool) => tool.name)).toEqual(["alpha__visible"]);
    });
  });

  /* ---- tools/call ------------------------------------------------ */

  describe("tools/call", () => {
    it("executes a tool and returns JSON content", async () => {
      registerPlugin(
        makeTestPlugin("calc", [
          {
            name: "add",
            description: "Add two numbers",
            parameters: z.object({ a: z.number(), b: z.number() }),
            execute: async (args) => ({
              sum: (args as { a: number; b: number }).a + (args as { a: number; b: number }).b,
            }),
          },
        ])
      );

      const res = await router({
        method: "tools/call",
        params: { name: "calc__add", arguments: { a: 3, b: 4 } },
      });

      expect(res.error).toBeUndefined();
      expect(res.content).toHaveLength(1);
      expect(JSON.parse(res.content?.[0]?.text ?? "{}")).toEqual({ sum: 7 });
    });

    it("returns error for missing tool name", async () => {
      const res = await router({ method: "tools/call", params: {} });
      expect(res.error?.code).toBe("INVALID_PARAMS");
    });

    it("returns error for unknown tool", async () => {
      const res = await router({
        method: "tools/call",
        params: { name: "nonexistent__tool" },
      });
      expect(res.error?.code).toBe("TOOL_NOT_FOUND");
    });

    it("validates parameters against the Zod schema", async () => {
      registerPlugin(
        makeTestPlugin("strict", [
          {
            name: "greet",
            description: "Greet",
            parameters: z.object({ name: z.string() }),
            execute: async (args) => ({ hello: (args as { name: string }).name }),
          },
        ])
      );

      const res = await router({
        method: "tools/call",
        params: { name: "strict__greet", arguments: { name: 42 } },
      });

      expect(res.error?.code).toBe("INVALID_PARAMS");
    });

    it("catches execution errors and returns EXECUTION_ERROR", async () => {
      registerPlugin(
        makeTestPlugin("broken", [
          {
            name: "fail",
            description: "Always fails",
            parameters: z.object({}),
            execute: async () => {
              throw new Error("boom");
            },
          },
        ])
      );

      const res = await router({
        method: "tools/call",
        params: { name: "broken__fail", arguments: {} },
      });

      expect(res.error?.code).toBe("EXECUTION_ERROR");
      expect(res.error?.message).toBe("boom");
    });

    it("passes the correct pluginAPI via getPluginAPI factory", async () => {
      const apiA = createMockPluginAPI();
      const apiB = createMockPluginAPI();

      // Pre-seed different data
      await apiA.db.set("key", "from-a");
      await apiB.db.set("key", "from-b");

      const perPluginRouter = buildMcpRouter((pluginId) => (pluginId === "pa" ? apiA : apiB));

      registerPlugin(
        makeTestPlugin("pa", [
          {
            name: "read",
            description: "Read key",
            parameters: z.object({}),
            execute: async (_args, api) => ({ value: await api.db.get("key") }),
          },
        ])
      );
      registerPlugin(
        makeTestPlugin("pb", [
          {
            name: "read",
            description: "Read key",
            parameters: z.object({}),
            execute: async (_args, api) => ({ value: await api.db.get("key") }),
          },
        ])
      );

      const resA = await perPluginRouter({
        method: "tools/call",
        params: { name: "pa__read", arguments: {} },
      });
      const resB = await perPluginRouter({
        method: "tools/call",
        params: { name: "pb__read", arguments: {} },
      });

      expect(JSON.parse(resA.content?.[0]?.text ?? "{}")).toEqual({ value: "from-a" });
      expect(JSON.parse(resB.content?.[0]?.text ?? "{}")).toEqual({ value: "from-b" });
    });
  });

  /* ---- unknown method -------------------------------------------- */

  describe("unknown method", () => {
    it("returns METHOD_NOT_FOUND for unrecognized methods", async () => {
      // tools/call without params returns INVALID_PARAMS, but a truly unknown method:
      const res2 = await router({ method: "resources/list" as McpRequest["method"] });
      expect(res2.error?.code).toBe("METHOD_NOT_FOUND");
    });
  });
});
