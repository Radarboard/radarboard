/**
 * Vercel Build Performance — MCP tool definitions
 */

import { z } from "zod";

export const vercelBuildPerfMcpTools = [
  {
    name: "get-vercel-build-perf",
    description: "Get Vercel Build Performance data for a project",
    parameters: z.object({
      projectSlug: z.string().describe("The project slug to query"),
    }),
    execute: async (_params: { projectSlug: string }) => {
      // TODO: Implement — fetch data and return structured result
      return { status: "not_implemented" };
    },
  },
];
