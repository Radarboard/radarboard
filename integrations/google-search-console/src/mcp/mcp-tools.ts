/**
 * Google Search Console — MCP tool definitions
 *
 * Define MCP tools that expose this integration's capabilities
 * to LLMs via the Model Context Protocol.
 */

import { z } from "zod";

export const googleSearchConsoleMcpTools = [
  {
    name: "get-google-search-console-data",
    description: "Get search analytics data from Google Search Console",
    parameters: z.object({
      siteUrl: z.string().describe("The site URL to query (e.g. https://example.com)"),
    }),
    execute: async (_params: { siteUrl: string }) => {
      // Placeholder — implementation pending
      return { status: "not_implemented" };
    },
  },
];
