/**
 * ASO Keywords — MCP tool definitions
 */

import { z } from "zod";

export const asoKeywordsMcpTools = [
  {
    name: "get-aso-keywords",
    description: "Get ASO Keywords data for a project",
    parameters: z.object({
      projectSlug: z.string().describe("The project slug to query"),
    }),
    execute: async (_params: { projectSlug: string }) => {
      // TODO: Implement — fetch data and return structured result
      return { status: "not_implemented" };
    },
  },
];
