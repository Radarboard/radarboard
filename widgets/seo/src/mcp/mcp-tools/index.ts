/**
 * SEO Performance — MCP tool definitions
 */

import { z } from "zod";

export const seoMcpTools = [
  {
    name: "get-seo",
    description: "Get SEO performance data (clicks, impressions, CTR, position) for a project",
    parameters: z.object({
      projectSlug: z.string().describe("The project slug to query"),
    }),
    execute: async (_params: { projectSlug: string }) => {
      // TODO: Implement — fetch data and return structured result
      return { status: "not_implemented" };
    },
  },
];
