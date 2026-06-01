import { PLUGIN_REGISTRY } from "@radarboard/plugin-sdk/registry";
import type { McpToolDefinition, PluginAPI, PluginUserConfig } from "@radarboard/plugin-sdk/types";
import "@/lib/plugins-init";
import { tool as aiTool, zodSchema } from "ai";
import { getPluginRepo } from "@/data/core/repository";
import { configurePluginServerRuntime } from "@/lib/extensions/runtime/server/plugin-server";

configurePluginServerRuntime();

const CONFIG_KEY = "_config";
const DISABLED_PLUGINS_KEY = "disabled-plugins";
const SYSTEM_PLUGIN_ID = "_system";

interface ResolvedPluginTool {
  pluginName: string;
  namespacedName: string;
  pluginId: string;
  tool: McpToolDefinition;
}

async function loadPluginConfig(pluginId: string): Promise<PluginUserConfig> {
  const repo = getPluginRepo();
  const raw = await repo.get(pluginId, CONFIG_KEY);
  if (!raw) return {};

  try {
    return JSON.parse(raw) as PluginUserConfig;
  } catch {
    return {};
  }
}

async function loadDisabledPluginIds(): Promise<Set<string>> {
  const repo = getPluginRepo();
  const raw = await repo.get(SYSTEM_PLUGIN_ID, DISABLED_PLUGINS_KEY);
  if (!raw) return new Set();

  try {
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

export function buildServerPluginAPI(pluginId: string): PluginAPI {
  const repo = getPluginRepo();
  return {
    widgets: { getState: () => null },
    db: {
      get: async <T>(key: string): Promise<T | null> => {
        const value = await repo.get(pluginId, key);
        return value ? (JSON.parse(value) as T) : null;
      },
      set: async <T>(key: string, value: T): Promise<void> => {
        await repo.set(pluginId, key, JSON.stringify(value));
      },
      delete: async (key: string): Promise<void> => {
        await repo.delete(pluginId, key);
      },
      list: async <T>(prefix: string): Promise<T[]> => {
        const items = await repo.list(pluginId, prefix);
        return items.map((item) => JSON.parse(item.value) as T);
      },
    },
    hotkeys: {
      register: () => () => {
        // no-op on the server
      },
    },
    notify: () => {
      // no-op on the server
    },
    close: () => {
      // no-op on the server
    },
    projects: {
      list: async () => [],
    },
    searchParams: new URLSearchParams(),
    intents: {
      resolveTargets: () => [],
      sendTo: async () => ({ success: false, message: "Not available on the server" }),
      sendToAssistant: async () => {
        // no-op on the server
      },
    },
    dataSources: {
      isConnected: async () => false,
      getConnectionType: async () => null,
    },
    events: {
      emit: () => {
        // no-op on the server
      },
      on: () => () => {
        // no-op on the server
      },
    },
    rpc: {
      call: async () => {
        throw new Error("RPC not available on the server");
      },
      listServices: () => [],
    },
  };
}

export async function getResolvedPluginTools(): Promise<ResolvedPluginTool[]> {
  const disabledPluginIds = await loadDisabledPluginIds();
  const resolved: ResolvedPluginTool[] = [];

  for (const [pluginId, descriptor] of PLUGIN_REGISTRY) {
    if (disabledPluginIds.has(pluginId) || !descriptor.mcpTools?.length) continue;

    const config = await loadPluginConfig(pluginId);
    const disabledTools = new Set(config.disabledTools ?? []);

    for (const pluginTool of descriptor.mcpTools) {
      if (disabledTools.has(pluginTool.name)) continue;

      resolved.push({
        pluginName: descriptor.name,
        pluginId,
        namespacedName: `${pluginId}__${pluginTool.name}`,
        tool: pluginTool,
      });
    }
  }

  return resolved;
}

export function buildPluginAiToolsFromResolved(
  resolvedTools: ResolvedPluginTool[]
): Record<string, unknown> {
  // biome-ignore lint/suspicious/noExplicitAny: AI SDK tool() has strict overloads for generic plugin schemas
  const tools: Record<string, any> = {};

  for (const entry of resolvedTools) {
    // biome-ignore lint/suspicious/noExplicitAny: AI SDK tool() has strict overloads for generic plugin schemas
    tools[entry.namespacedName] = (aiTool as any)({
      description: entry.tool.description,
      inputSchema: zodSchema(entry.tool.parameters),
      execute: async (params: unknown) => {
        const api = buildServerPluginAPI(entry.pluginId);
        const result = await entry.tool.execute(params, api);
        const actionMetadata = {
          pluginId: entry.pluginId,
          pluginName: entry.pluginName,
          toolName: entry.namespacedName,
          openLabel: `Open ${entry.pluginName}`,
          openUrl: `?plugin=${entry.pluginId}`,
        };

        if (typeof result === "object" && result !== null) {
          return { ...result, ...actionMetadata };
        }

        return { result, ...actionMetadata };
      },
    });
  }

  return tools;
}

export async function buildPluginAiTools(): Promise<Record<string, unknown>> {
  return buildPluginAiToolsFromResolved(await getResolvedPluginTools());
}

export function buildPluginToolGuidance(resolvedTools: ResolvedPluginTool[]): string | null {
  if (resolvedTools.length === 0) return null;

  const grouped = new Map<string, Array<{ name: string; description: string }>>();

  for (const entry of resolvedTools) {
    const tools = grouped.get(entry.pluginId) ?? [];
    tools.push({
      name: entry.namespacedName,
      description: entry.tool.description,
    });
    grouped.set(entry.pluginId, tools);
  }

  const lines = [
    "[PLUGIN TOOLS]",
    "You have direct writable and readable tools for first-party Radarboard plugins.",
    "When the user asks to create, update, delete, list, search, or manage plugin-owned data, call the matching plugin tool instead of saying the tool is unavailable.",
    "Only say a plugin capability is unavailable if no matching plugin tool is listed below.",
    "Plugin tool results include openLabel and openUrl.",
    "After a successful plugin write, confirm success briefly and include a markdown link using the returned openLabel/openUrl so the user can open the plugin immediately.",
  ];

  for (const [pluginId, tools] of grouped) {
    lines.push(`- ${pluginId}:`);
    for (const pluginTool of tools) {
      lines.push(`  - ${pluginTool.name}: ${pluginTool.description}`);
    }
  }

  return lines.join("\n");
}
