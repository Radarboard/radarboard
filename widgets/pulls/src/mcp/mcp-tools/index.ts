/**
 * GitHub Activity — MCP tool definitions
 */

import { z } from "zod";

export const githubActivityMcpTools = [
  {
    name: "get-github-activity",
    description: "Get open pull requests and issues across connected GitHub repositories",
    parameters: z.object({
      projectSlug: z.string().describe("The project slug to query"),
    }),
    execute: async (_params: { projectSlug: string }) => {
      // TODO: Implement — fetch data and return structured result
      return { status: "not_implemented" };
    },
  },
];
