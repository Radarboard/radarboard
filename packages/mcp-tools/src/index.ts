import { PLUGIN_REGISTRY } from "@radarboard/plugin-sdk/registry";
import type { McpToolDefinition, PluginAPI, PluginUserConfig } from "@radarboard/plugin-sdk/types";
import { z } from "zod";
import type { McpRequest, McpResponse, McpToolInfo } from "./types";

interface NamespacedTool {
  namespacedName: string;
  pluginId: string;
  definition: McpToolDefinition;
}

/**
 * Collect all MCP tools from registered plugins, namespaced by plugin ID.
 * Skips tools from disabled plugins and individually disabled tools.
 */
function collectTools(
  disabledPlugins?: Set<string>,
  pluginConfigs?: Map<string, PluginUserConfig>
): NamespacedTool[] {
  const tools: NamespacedTool[] = [];

  for (const [pluginId, descriptor] of PLUGIN_REGISTRY) {
    if (!descriptor.mcpTools) continue;
    if (disabledPlugins?.has(pluginId)) continue;
    const disabledTools = new Set(pluginConfigs?.get(pluginId)?.disabledTools ?? []);

    for (const tool of descriptor.mcpTools) {
      if (disabledTools.has(tool.name)) continue;
      tools.push({
        namespacedName: `${pluginId}__${tool.name}`,
        pluginId,
        definition: tool,
      });
    }
  }

  return tools;
}

/**
 * Build an MCP request handler that aggregates all plugin tools.
 *
 * The returned handler is transport-agnostic — call it from an HTTP route,
 * WebSocket handler, or directly from the in-app AI chat.
 */
export function buildMcpRouter(
  getPluginAPI: (pluginId: string) => PluginAPI,
  disabledPlugins?: Set<string>,
  pluginConfigs?: Map<string, PluginUserConfig>
) {
  return async (request: McpRequest): Promise<McpResponse> => {
    if (request.method === "tools/list") {
      return handleToolsList(disabledPlugins, pluginConfigs);
    }

    if (request.method === "tools/call") {
      return handleToolsCall(request, getPluginAPI, disabledPlugins, pluginConfigs);
    }

    return {
      error: { code: "METHOD_NOT_FOUND", message: `Unknown method: ${request.method}` },
    };
  };
}

function handleToolsList(
  disabledPlugins?: Set<string>,
  pluginConfigs?: Map<string, PluginUserConfig>
): McpResponse {
  const tools = collectTools(disabledPlugins, pluginConfigs);

  const toolInfos: McpToolInfo[] = tools.map((t) => {
    let inputSchema: Record<string, unknown>;
    try {
      inputSchema = z.toJSONSchema(t.definition.parameters) as Record<string, unknown>;
    } catch {
      inputSchema = { type: "object" };
    }

    return {
      name: t.namespacedName,
      description: t.definition.description,
      inputSchema,
    };
  });

  return { tools: toolInfos };
}

async function handleToolsCall(
  request: McpRequest,
  getPluginAPI: (pluginId: string) => PluginAPI,
  disabledPlugins?: Set<string>,
  pluginConfigs?: Map<string, PluginUserConfig>
): Promise<McpResponse> {
  const toolName = request.params?.name;
  if (!toolName) {
    return { error: { code: "INVALID_PARAMS", message: "Missing tool name" } };
  }

  const tools = collectTools(disabledPlugins, pluginConfigs);
  const tool = tools.find((t) => t.namespacedName === toolName);

  if (!tool) {
    return {
      error: { code: "TOOL_NOT_FOUND", message: `Unknown tool: ${toolName}` },
    };
  }

  // Validate input
  const parseResult = tool.definition.parameters.safeParse(request.params?.arguments ?? {});
  if (!parseResult.success) {
    return {
      error: {
        code: "INVALID_PARAMS",
        message: `Invalid parameters: ${JSON.stringify(parseResult.error)}`,
      },
    };
  }

  // Execute
  try {
    const api = getPluginAPI(tool.pluginId);
    const result = await tool.definition.execute(parseResult.data, api);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
    };
  } catch (err) {
    return {
      error: {
        code: "EXECUTION_ERROR",
        message: err instanceof Error ? err.message : "Tool execution failed",
      },
    };
  }
}

export type { McpRequest, McpResponse, McpToolInfo } from "./types";
