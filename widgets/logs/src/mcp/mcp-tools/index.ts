/**
 * Logs — MCP tool definitions
 */

import { z } from "zod";

export const logsMcpTools = [
  {
    name: "get-recent-logs",
    description: "Get recent structured application logs with optional level and search filtering",
    parameters: z.object({
      level: z.enum(["debug", "info", "warn", "error"]).optional().describe("Filter by log level"),
      search: z.string().optional().describe("Free-text search across log messages"),
      limit: z.number().optional().describe("Max entries to return (default 200)"),
    }),
    execute: async (_params: { level?: string; search?: string; limit?: number }) => {
      // TODO: Implement — fetch data and return structured result
      return { status: "not_implemented" };
    },
  },
];
