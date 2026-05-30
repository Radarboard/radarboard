/**
 * OpenPanel — MCP tool definitions
 *
 * Define MCP tools that expose this integration's capabilities
 * to LLMs via the Model Context Protocol.
 */

import type { IntegrationMcpTool } from "@radarboard/integration-sdk/types";
import { z } from "zod";

const analyticsRangeSchema = z
  .enum(["today", "7d", "15d", "30d", "3m", "1y"])
  .default("30d")
  .describe("Time range");

export const openpanelMcpTools: IntegrationMcpTool[] = [
  {
    name: "get_analytics",
    description: "Get website analytics: pageviews, unique visitors, sessions, and referrers.",
    parameters: z.object({ range: analyticsRangeSchema }),
    route: {
      integrationId: "analytics",
      action: "data",
      buildParams: (params) => {
        const range = params.range;
        return typeof range === "string" ? { range } : { range: "30d" };
      },
    },
  },
];
