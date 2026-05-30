/**
 * Vercel — MCP tool definitions
 *
 * Define MCP tools that expose this integration's capabilities
 * to LLMs via the Model Context Protocol.
 */

import type { IntegrationMcpTool } from "@radarboard/integration-sdk/types";
import { z } from "zod";

export const vercelMcpTools: IntegrationMcpTool[] = [
  {
    name: "get_vercel_deployments",
    description: "Get recent Vercel production deployments and build statuses.",
    parameters: z.object({}),
    route: {
      action: "deployments",
    },
  },
];
