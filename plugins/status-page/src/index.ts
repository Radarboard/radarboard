import type { PluginDescriptor } from "@radarboard/plugin-sdk/types";
import { Activity } from "lucide-react";
import { StatusPageOverlay } from "./components/status-page-overlay";
import { statusPageMcpTools } from "./mcp-tools";

export const statusPageDescriptor: PluginDescriptor = {
  id: "status-page",
  name: "Status Page",
  description: "Monitor the operational status of external services and dependencies",
  icon: Activity,
  category: "monitoring",
  version: "0.1.0",

  launchSurfaces: ["palette", "topbar", "dock"],
  presentation: { default: "side-panel", alternates: ["fullscreen"], size: "md" },
  shortcut: "Mod+Shift+S",

  component: StatusPageOverlay,

  mcpTools: statusPageMcpTools,

  radarboardIntegrations: {
    notifications: {
      enabledByDefault: true,
    },
    ticker: {
      enabledByDefault: true,
    },
  },

  settings: [
    {
      key: "refresh-interval",
      label: "Refresh Interval (seconds)",
      description: "How often to refresh service status",
      type: "number",
      defaultValue: 60,
    },
    {
      key: "show-operational-only",
      label: "Show Only Issues",
      description: "Hide services that are operational in the widget",
      type: "boolean",
      defaultValue: false,
    },
  ],

  dataSources: [
    {
      id: "betteruptime",
      name: "Better Uptime",
      description: "Pull service status from Better Uptime monitors",
      connectionTypes: ["api_key"],
      integrationKey: "betteruptime",
    },
    {
      id: "upptime",
      name: "Upptime",
      description: "Sync status from an Upptime GitHub-powered status page",
      connectionTypes: ["mcp"],
      mcpServerNames: ["upptime"],
    },
  ],
};
