/**
 * __PLUGIN_NAME__ — Plugin Descriptor
 */

import type { PluginDescriptor } from "@radarboard/plugin-sdk/types";
import { Puzzle } from "lucide-react";
import { __PLUGIN_PASCAL__Overlay } from "./components/__PLUGIN_KEBAB__-overlay";
import { __PLUGIN_CAMEL__McpTools } from "./mcp-tools";

export const __PLUGIN_CAMEL__Descriptor: PluginDescriptor = {
  id: "__PLUGIN_KEBAB__",
  name: "__PLUGIN_NAME__",
  description: "__PLUGIN_NAME__ plugin — configure after scaffolding.",
  icon: Puzzle,
  category: "productivity",
  version: "0.1.0",

  launchSurfaces: ["palette", "topbar"],
  presentation: { default: "side-panel", alternates: ["fullscreen"], size: "md" },

  component: __PLUGIN_PASCAL__Overlay,

  mcpTools: __PLUGIN_CAMEL__McpTools,

  settings: [],
  screenshots: [],
  tier: "community",
  requiredCapabilities: ["database"],
};
