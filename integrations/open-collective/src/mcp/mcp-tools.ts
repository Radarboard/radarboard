/**
 * Open Collective — MCP tool definitions
 *
 * Define MCP tools that expose this integration's capabilities
 * to LLMs via the Model Context Protocol.
 */

import { z } from "zod";

export const openCollectiveMcpTools = [
  {
    name: "get-open-collective-data",
    description: "Get data from Open Collective",
    parameters: z.object({
      projectSlug: z.string().describe("The project slug to query"),
    }),
    execute: async (_params: { projectSlug: string }) => {
      // Placeholder — implementation pending
      return { status: "not_implemented" };
    },
  },
];
