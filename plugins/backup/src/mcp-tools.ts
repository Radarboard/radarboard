/**
 * Backup & Export — MCP tool definitions
 *
 * Exposes data export capabilities to the AI assistant.
 * The export_data tool fetches real integration data via the backup export API
 * and returns a download URL the user can click.
 */

import type { McpToolDefinition, PluginAPI } from "@radarboard/plugin-sdk/types";
import { z } from "zod";
import type { ExportResult } from "./types";

const DB_KEYS = {
  history: "backup:export-history",
} as const;

const VALID_SOURCES = ["analytics", "revenue", "seo", "github", "linear", "deployments", "errors"];

async function getExportHistory(api: PluginAPI): Promise<ExportResult[]> {
  return (await api.db.get<ExportResult[]>(DB_KEYS.history)) ?? [];
}

async function addToHistory(api: PluginAPI, result: ExportResult): Promise<void> {
  const history = await getExportHistory(api);
  history.unshift(result);
  await api.db.set(DB_KEYS.history, history.slice(0, 50));
}

export const backupMcpTools: McpToolDefinition[] = [
  {
    name: "export_data",
    description:
      "Export integration data as JSON or CSV. Returns a download URL for the exported file. Available sources: analytics, revenue, seo, github, linear, deployments, errors.",
    parameters: z.object({
      source: z
        .string()
        .describe(
          "Data source to export: analytics, revenue, seo, github, linear, deployments, errors"
        ),
      format: z
        .enum(["json", "csv"])
        .optional()
        .default("json")
        .describe("Export format (default: json)"),
      range: z
        .string()
        .optional()
        .default("30d")
        .describe("Time range: today, 7d, 15d, 30d, 3m, 1y"),
      project_slug: z.string().optional().describe("Filter by project"),
    }),
    execute: async (args, api: PluginAPI) => {
      const { source, format, range, project_slug } = args as {
        source: string;
        format: string;
        range: string;
        project_slug?: string;
      };

      if (!VALID_SOURCES.includes(source)) {
        return { error: `Unknown source: ${source}. Available: ${VALID_SOURCES.join(", ")}` };
      }

      const params = new URLSearchParams({ source, format, range });
      if (project_slug) params.set("project", project_slug);
      const downloadUrl = `/api/backup/export?${params}`;

      const result: ExportResult = {
        filename: `${source}-${range}-${new Date().toISOString().slice(0, 10)}.${format}`,
        format: format as "json" | "csv",
        size: 0,
        itemCount: 0,
        createdAt: new Date().toISOString(),
      };

      await addToHistory(api, result);

      return {
        filename: result.filename,
        format: result.format,
        downloadUrl,
        message: `Export ready. [Download ${result.filename}](${downloadUrl})`,
      };
    },
  },
  {
    name: "list_exports",
    description: "List recent data exports with their details (filename, format, size, date).",
    parameters: z.object({
      limit: z.number().optional().default(10).describe("Number of recent exports to show"),
    }),
    execute: async (args, api: PluginAPI) => {
      const { limit } = args as { limit: number };
      const history = await getExportHistory(api);
      return {
        exports: history.slice(0, limit),
        total: history.length,
      };
    },
  },
  {
    name: "list_exportable_sources",
    description: "List all available data sources that can be exported as JSON or CSV.",
    parameters: z.object({}),
    execute: async (_args, _api: PluginAPI) => {
      return {
        sources: VALID_SOURCES.map((id) => ({
          id,
          formats: ["json", "csv"],
          exportUrl: `/api/backup/export?source=${id}&format=json&range=30d`,
        })),
      };
    },
  },
];
