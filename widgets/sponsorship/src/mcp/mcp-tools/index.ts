/**
 * Sponsorship — MCP tool definitions
 */

import { z } from "zod";

export const sponsorshipMcpTools = [
  {
    name: "get-sponsorship-overview",
    description:
      "Get unified sponsorship data from Open Collective and GitHub Sponsors, including monthly income, sponsor counts, and donation trends",
    parameters: z.object({
      projectSlug: z.string().describe("The project slug to query"),
    }),
    execute: async (_params: { projectSlug: string }) => {
      // TODO: Implement — fetch data and return structured result
      return { status: "not_implemented" };
    },
  },
];
