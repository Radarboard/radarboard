/**
 * Shipping Log — MCP tool definitions
 */

import { z } from "zod";

export const shippingMcpTools = [
  {
    name: "get-shipping",
    description: "Get release activity data (deploys, commits, released work) for a project",
    parameters: z.object({
      projectSlug: z.string().describe("The project slug to query"),
    }),
    execute: async (_params: { projectSlug: string }) => {
      // TODO: Implement — fetch data and return structured result
      return { status: "not_implemented" };
    },
  },
];
