/**
 * Backup & Export — Plugin Descriptor
 *
 * Provides data export capabilities for all integration data.
 * Supports JSON and CSV formats with customizable date ranges.
 */

import type { PluginDescriptor } from "@radarboard/plugin-sdk/types";
import { HardDriveDownload } from "lucide-react";
import { BackupOverlay } from "./components/backup-overlay";
import { backupMcpTools } from "./mcp-tools";

export const backupDescriptor: PluginDescriptor = {
  id: "backup",
  name: "Backup & Export",
  description: "Export integration data as JSON or CSV for backup, analysis, or migration",
  icon: HardDriveDownload,
  category: "data",
  version: "0.1.0",

  launchSurfaces: ["palette", "topbar"],
  presentation: { default: "modal", alternates: ["side-panel"], size: "md" },

  component: BackupOverlay,

  mcpTools: backupMcpTools,

  settings: [
    {
      key: "default-format",
      label: "Default Export Format",
      description: "Pre-selected format when opening the export dialog",
      type: "select",
      defaultValue: "json",
      options: [
        { label: "JSON", value: "json" },
        { label: "CSV", value: "csv" },
      ],
    },
    {
      key: "default-range",
      label: "Default Date Range",
      description: "Pre-selected time range for exports",
      type: "select",
      defaultValue: "30d",
      options: [
        { label: "7 days", value: "7d" },
        { label: "15 days", value: "15d" },
        { label: "30 days", value: "30d" },
        { label: "3 months", value: "3m" },
        { label: "1 year", value: "1y" },
      ],
    },
  ],
};
