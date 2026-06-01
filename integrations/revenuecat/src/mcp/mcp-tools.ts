/**
 * RevenueCat — MCP tool definitions
 *
 * Define MCP tools that expose this integration's capabilities
 * to LLMs via the Model Context Protocol.
 */

import type { IntegrationMcpTool } from "@radarboard/integration-sdk/types";
import { z } from "zod";

const revenueRangeSchema = z
  .enum(["today", "7d", "15d", "30d", "3m", "1y"])
  .default("30d")
  .describe("Time range");

export const revenuecatMcpTools: IntegrationMcpTool[] = [
  {
    name: "get_revenue",
    description: "Get revenue overview: MRR, total revenue, subscriber count, and revenue series.",
    parameters: z.object({ range: revenueRangeSchema }),
    route: {
      action: "data",
      buildParams: (params) => {
        const range = params.range;
        return typeof range === "string" ? { range } : { range: "30d" };
      },
    },
  },
];
