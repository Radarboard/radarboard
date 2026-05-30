/**
 * Linear — MCP tool definitions
 *
 * Define MCP tools that expose this integration's capabilities
 * to LLMs via the Model Context Protocol.
 */

import { z } from "zod";

export const linearMcpTools = [
  {
    name: "get-linear-data",
    description: "Get data from Linear",
    parameters: z.object({
      projectSlug: z.string().describe("The project slug to query"),
    }),
    execute: async (_params: { projectSlug: string }) => {
      // TODO: Implement — call client and return structured result
      return { status: "not_implemented" };
    },
  },
];
