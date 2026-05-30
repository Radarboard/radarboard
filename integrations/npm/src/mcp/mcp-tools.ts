/**
 * npm — MCP tool definitions
 *
 * Define MCP tools that expose this integration's capabilities
 * to LLMs via the Model Context Protocol.
 */

import type { IntegrationMcpTool } from "@radarboard/integration-sdk/types";
import { z } from "zod";

const npmRangeSchema = z
  .enum(["last-week", "last-month", "last-year"])
  .default("last-month")
  .describe("Download period");

export const npmMcpTools: IntegrationMcpTool[] = [
  {
    name: "get_npm_downloads",
    description: "Get NPM package download counts.",
    parameters: z.object({ range: npmRangeSchema }),
    route: {
      action: "data",
      buildParams: (params) => {
        const range = params.range;
        return typeof range === "string" ? { range } : { range: "last-month" };
      },
    },
  },
];
