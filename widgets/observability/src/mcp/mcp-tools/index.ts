/**
 * Detail / Service Monitor — MCP tool definitions
 */

import { z } from "zod";

export const detailMcpTools = [
  {
    name: "get-service-health",
    description: "Get service health status including uptime checks, incidents, and response times",
    parameters: z.object({
      projectSlug: z.string().describe("The project slug to query"),
    }),
    execute: async (_params: { projectSlug: string }) => {
      // TODO: Implement — fetch data and return structured result
      return { status: "not_implemented" };
    },
  },
];
