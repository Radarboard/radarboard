/**
 * App Store Connect — MCP tool definitions
 *
 * Define MCP tools that expose this integration's capabilities
 * to LLMs via the Model Context Protocol.
 */

import { z } from "zod";

export const appStoreConnectMcpTools = [
  {
    name: "get-app-store-connect-data",
    description: "Get data from App Store Connect",
    parameters: z.object({
      _params: z.string().describe("The app ID to query"),
    }),
    execute: async (_params: { _params: string }) => {
      // Placeholder — implementation pending
      return { status: "not_implemented" };
    },
  },
];
