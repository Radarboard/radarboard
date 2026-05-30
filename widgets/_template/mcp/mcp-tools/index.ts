/**
 * __WIDGET_NAME__ — MCP tool definitions
 *
 * Define MCP tools that expose this widget's data and actions
 * to LLMs via the Model Context Protocol.
 */

import { z } from "zod";

export const __WIDGET_CAMEL__McpTools = [
  {
    name: "get-__WIDGET_KEBAB__",
    description: "Get __WIDGET_NAME__ data for a project",
    parameters: z.object({
      projectSlug: z.string().describe("The project slug to query"),
    }),
    execute: async (params: { projectSlug: string }) => {
      // TODO: Implement — fetch data and return structured result
      return { status: "not_implemented" };
    },
  },
];
