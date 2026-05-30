import type { PluginDescriptor } from "@radarboard/plugin-sdk/types";
import { StickyNote } from "lucide-react";
import { NotesOverlay } from "./components/notes-overlay";
import { notesIntents } from "./intents";
import { notesMcpTools } from "./mcp-tools";

export const notesDescriptor: PluginDescriptor = {
  id: "notes",
  name: "Notes",
  description:
    "Markdown-native notes with folders, templates, pinning, version history, and full-text search",
  icon: StickyNote,
  category: "productivity",
  version: "0.2.0",

  launchSurfaces: ["palette", "topbar"],
  presentation: { default: "side-panel", alternates: ["fullscreen"], size: "md" },
  shortcut: "Mod+Shift+O",

  component: NotesOverlay,

  mcpTools: notesMcpTools,

  intents: notesIntents,

  settings: [
    {
      key: "default-tag",
      label: "Default Tag",
      description: "Tag automatically applied to new notes",
      type: "text",
      defaultValue: "",
    },
    {
      key: "sort-order",
      label: "Sort Order",
      description: "How notes are sorted in the list",
      type: "select",
      defaultValue: "updated",
      options: [
        { label: "Last Updated", value: "updated" },
        { label: "Created Date", value: "created" },
        { label: "Alphabetical", value: "alpha" },
      ],
    },
    {
      key: "auto-save-delay",
      label: "Auto-Save Delay",
      description: "Milliseconds to wait before auto-saving (default 1500)",
      type: "text",
      defaultValue: "1500",
    },
  ],

  dataSources: [
    {
      id: "obsidian",
      name: "Obsidian",
      description: "Sync notes with an Obsidian vault via MCP",
      connectionTypes: ["mcp"],
      mcpServerNames: ["obsidian"],
    },
  ],
};
