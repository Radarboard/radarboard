import type { PluginDescriptor } from "@radarboard/plugin-sdk/types";
import { Bookmark } from "lucide-react";
import { BookmarksOverlay } from "./components/bookmarks-overlay";
import { bookmarksIntents } from "./intents";
import { bookmarksMcpTools } from "./mcp-tools";

export const bookmarksDescriptor: PluginDescriptor = {
  id: "bookmarks",
  name: "Bookmarks",
  description: "Save, organize, and quickly access bookmarks with tagging and search",
  icon: Bookmark,
  category: "productivity",
  version: "0.1.0",

  launchSurfaces: ["palette", "topbar", "dock"],
  presentation: { default: "side-panel", alternates: ["fullscreen"], size: "md" },
  shortcut: "Mod+Shift+B",

  component: BookmarksOverlay,

  mcpTools: bookmarksMcpTools,

  intents: bookmarksIntents,

  settings: [
    {
      key: "widget-count",
      label: "Quick Access Count",
      description: "Number of bookmarks shown in the widget",
      type: "number",
      defaultValue: 5,
    },
    {
      key: "open-in-new-tab",
      label: "Open in New Tab",
      description: "Open bookmarks in a new browser tab",
      type: "boolean",
      defaultValue: true,
    },
  ],

  dataSources: [
    {
      id: "raindrop",
      name: "Raindrop.io",
      description: "Import bookmarks and collections from Raindrop.io",
      connectionTypes: ["mcp", "oauth"],
      mcpServerNames: ["raindrop"],
      integrationKey: "raindrop",
    },
  ],
};
