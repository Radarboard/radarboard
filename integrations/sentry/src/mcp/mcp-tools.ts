/**
 * Sentry — MCP tool definitions
 *
 * Define MCP tools that expose this integration's capabilities
 * to LLMs via the Model Context Protocol.
 */

import type { IntegrationMcpTool } from "@radarboard/integration-sdk/types";
import { z } from "zod";

export const sentryMcpTools: IntegrationMcpTool[] = [
  {
    name: "get_sentry_issues",
    description: "Get unresolved Sentry error issues and project health stats.",
    parameters: z.object({}),
    route: {
      action: "data",
    },
  },
];
