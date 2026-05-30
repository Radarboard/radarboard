/**
 * Revenue — MCP tool definitions
 */

import { z } from "zod";

export const revenueMcpTools = [
  {
    name: "get-revenue",
    description: "Get revenue data (MRR, gross, net) for a project",
    parameters: z.object({
      projectSlug: z.string().describe("The project slug to query"),
    }),
    execute: async (_params: { projectSlug: string }) => {
      // TODO: Implement — fetch data and return structured result
      return { status: "not_implemented" };
    },
  },
];
