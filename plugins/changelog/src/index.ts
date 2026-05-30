import type { PluginDescriptor } from "@radarboard/plugin-sdk/types";
import { History } from "lucide-react";
import { ChangelogOverlay } from "./components/changelog-overlay";
import { changelogMcpTools } from "./mcp-tools";

export const changelogDescriptor: PluginDescriptor = {
  id: "changelog",
  name: "Changelog",
  description: "Track releases, deployments, and hotfixes across your projects",
  icon: History,
  category: "monitoring",
  version: "0.1.0",

  launchSurfaces: ["palette", "topbar"],
  presentation: { default: "fullscreen", alternates: ["side-panel"], size: "lg" },
  shortcut: "Mod+Shift+G",

  component: ChangelogOverlay,

  mcpTools: changelogMcpTools,

  settings: [
    {
      key: "widget-entries",
      label: "Widget Entries",
      description: "Number of entries shown in the timeline widget",
      type: "number",
      defaultValue: 4,
    },
  ],
};
