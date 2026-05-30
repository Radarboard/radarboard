/**
 * GitHub Sponsors — MCP tool definitions
 *
 * Define MCP tools that expose this integration's capabilities
 * to LLMs via the Model Context Protocol.
 */

import { z } from "zod";

export const githubSponsorsMcpTools = [
  {
    name: "get-github-sponsors-data",
    description:
      "Get GitHub Sponsors overview for a user, including sponsors list, tiers, monthly income, and goals",
    parameters: z.object({
      login: z.string().describe("The GitHub username to fetch sponsors data for"),
    }),
    execute: async (_params: { login: string }) => {
      // Placeholder — implementation pending
      return { status: "not_implemented" };
    },
  },
];
