/**
 * Github — MCP tool definitions
 *
 * Define MCP tools that expose this integration's capabilities
 * to LLMs via the Model Context Protocol.
 */

import type { IntegrationMcpTool } from "@radarboard/integration-sdk/types";
import { z } from "zod";

export const githubMcpTools: IntegrationMcpTool[] = [
  {
    name: "get_github_stars",
    description: "Get GitHub repository stats: stars, forks, open issues, watchers.",
    parameters: z.object({}),
    route: {
      action: "stars",
    },
  },
];
