/**
 * __PLUGIN_NAME__ — MCP tool definitions
 *
 * MCP tools let the AI assistant interact with your plugin.
 * Each tool is auto-namespaced as "__PLUGIN_KEBAB____<name>".
 *
 * Example:
 * ```ts
 * import { z } from "zod";
 * import type { McpToolDefinition } from "@radarboard/plugin-sdk/types";
 *
 * export const __PLUGIN_CAMEL__McpTools: McpToolDefinition[] = [
 *   {
 *     name: "list-items",
 *     description: "List all items in __PLUGIN_NAME__",
 *     parameters: z.object({}),
 *     execute: async (_params, api) => {
 *       const items = await api.db.list("item:");
 *       return { items };
 *     },
 *   },
 * ];
 * ```
 */

import type { McpToolDefinition } from "@radarboard/plugin-sdk/types";

export const __PLUGIN_CAMEL__McpTools: McpToolDefinition[] = [];
