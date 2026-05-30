import type { PluginDescriptor } from "@radarboard/plugin-sdk/types";
import { Rss } from "lucide-react";
import { RssReaderOverlay } from "./components/rss-reader-overlay";
import { rssReaderMcpTools } from "./mcp-tools";

export const rssReaderDescriptor: PluginDescriptor = {
  id: "rss-reader",
  name: "RSS Reader",
  description: "Track RSS feeds and read articles from your favorite sources",
  icon: Rss,
  category: "monitoring",
  version: "0.1.0",

  launchSurfaces: ["palette", "topbar", "dock"],
  presentation: { default: "fullscreen", alternates: ["side-panel"], size: "lg" },
  shortcut: "Mod+Shift+R",

  component: RssReaderOverlay,

  mcpTools: rssReaderMcpTools,

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
      key: "max-items",
      label: "Max Items per Feed",
      description: "Maximum number of items to display per feed",
      type: "number",
      defaultValue: 50,
    },
    {
      key: "auto-mark-read",
      label: "Auto Mark as Read",
      description: "Mark items as read when opened",
      type: "boolean",
      defaultValue: true,
    },
    {
      key: "widget-items",
      label: "Widget Items Count",
      description: "Number of items shown in the dashboard widget",
      type: "number",
      defaultValue: 3,
    },
  ],

  dataSources: [
    {
      id: "feedly",
      name: "Feedly",
      description: "Import feeds and articles from Feedly",
      connectionTypes: ["oauth", "api_key"],
      integrationKey: "feedly",
    },
    {
      id: "raindrop",
      name: "Raindrop.io",
      description: "Save articles to Raindrop collections",
      connectionTypes: ["mcp", "oauth"],
      mcpServerNames: ["raindrop"],
      integrationKey: "raindrop",
    },
  ],
};
