/**
 * BetterStack — MCP tool definitions
 *
 * Define MCP tools that expose this integration's capabilities
 * to LLMs via the Model Context Protocol.
 */

import type { IntegrationMcpTool } from "@radarboard/integration-sdk/types";
import { z } from "zod";

export const betterstackMcpTools: IntegrationMcpTool[] = [
  {
    name: "get_health_checks",
    description: "Get uptime monitor statuses from BetterStack.",
    parameters: z.object({}),
    route: {
      action: "data",
    },
  },
];
