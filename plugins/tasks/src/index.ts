import type { PluginDescriptor } from "@radarboard/plugin-sdk/types";
import { CheckSquare } from "lucide-react";
import { TasksOverlay } from "./components/tasks-overlay";
import { tasksIntents } from "./intents";
import { tasksMcpTools } from "./mcp-tools";

export const tasksDescriptor: PluginDescriptor = {
  id: "tasks",
  name: "Tasks",
  description: "Task management with Pomodoro timer, project grouping, and keyboard-first workflow",
  icon: CheckSquare,
  category: "productivity",
  version: "0.1.0",

  launchSurfaces: ["palette", "topbar", "dock"],
  presentation: { default: "fullscreen", alternates: ["side-panel"] },
  shortcut: "Mod+Shift+T",

  component: TasksOverlay,

  mcpTools: tasksMcpTools,

  intents: tasksIntents,

  settings: [
    {
      key: "pomodoro-duration",
      label: "Pomodoro Duration",
      description: "Length of each focus session in minutes",
      type: "number",
      defaultValue: 25,
    },
    {
      key: "break-duration",
      label: "Break Duration",
      description: "Length of each break in minutes",
      type: "number",
      defaultValue: 5,
    },
    {
      key: "auto-start-break",
      label: "Auto-start Break",
      description: "Automatically start break timer after focus session",
      type: "boolean",
      defaultValue: false,
    },
  ],
};
