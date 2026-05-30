/**
 * @radarboard/feature-mcp-servers
 *
 * MCP Servers feature descriptor.
 */

import type { FeatureDescriptor } from "@radarboard/feature-sdk/types";

export const mcpServersDescriptor: FeatureDescriptor = {
  id: "mcpServers",
  envKey: "NEXT_PUBLIC_FEATURE_MCP_SERVERS",
  label: "MCP Servers",
  description: "Model Context Protocol server connections.",
  defaultEnabled: true,
  tier: "user",
  plan: "free",
  category: "infrastructure",
  settingsSections: ["mcp-servers"],
};
