import { findDataSource } from "@radarboard/integration-sdk/registry";
import type { TimeRange } from "@radarboard/integration-sdk/types";
import "@/lib/integrations-init";
import { createLogger } from "@radarboard/logger/logger";
import { normalizeTimeZone } from "@radarboard/utils/timezone";
import { z } from "zod";
import { errorJson, parseSearchParams } from "@/lib/api";
import { buildDataSourceContext } from "@/lib/data-source-context";

const log = createLogger("api/backup/export");
const timeRangeSchema: z.ZodType<TimeRange> = z.enum([
  "today",
  "7d",
  "15d",
  "30d",
  "3m",
  "1y",
  "all",
]);
const backupExportQuerySchema = z.object({
  source: z.string().optional(),
  format: z.string().optional(),
  range: timeRangeSchema.optional(),
  project: z.string().optional(),
  timezone: z.string().optional(),
});

export const BACKUP_EXPORT_SOURCE_MAP: Record<string, { integration: string; action: string }> = {
  analytics: { integration: "openpanel", action: "data" },
  revenue: { integration: "revenuecat", action: "data" },
  seo: { integration: "google-search-console", action: "data" },
  github: { integration: "github", action: "data" },
  linear: { integration: "linear", action: "data" },
  deployments: { integration: "vercel", action: "data" },
  errors: { integration: "sentry", action: "data" },
};

export function extractExportRows(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (typeof data !== "object" || data === null) return [data];

  for (const value of Object.values(data)) {
    if (Array.isArray(value) && value.length > 0) return value;
    if (typeof value === "object" && value !== null) {
      const nested = extractExportRows(value);
      if (nested.length > 0 && Array.isArray(nested[0]) === false) return nested;
    }
  }

  return [data];
}

export function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportJsonToCsv(data: unknown): string {
  const rows = extractExportRows(data);
  if (rows.length === 0) return "";

  const keys = new Set<string>();
  for (const row of rows) {
    if (typeof row === "object" && row !== null) {
      for (const key of Object.keys(row)) keys.add(key);
    }
  }

  const headers = [...keys];
  const lines = [headers.map(escapeCsvField).join(",")];

  for (const row of rows) {
    const record = row as Record<string, unknown>;
    const values = headers.map((key) => {
      const val = record[key];
      if (val === null || val === undefined) return "";
      if (typeof val === "object") return escapeCsvField(JSON.stringify(val));
      return escapeCsvField(String(val));
    });
    lines.push(values.join(","));
  }

  return lines.join("\n");
}

export async function handleBackupExport(request: Request) {
  try {
    const parsed = parseSearchParams(new URL(request.url).searchParams, backupExportQuerySchema);
    if (!parsed.ok) return parsed.response;
    const { source, format = "json", range = "30d", project: projectSlug, timezone } = parsed.data;
    const timeZone = normalizeTimeZone(timezone);

    if (!source || !BACKUP_EXPORT_SOURCE_MAP[source]) {
      return errorJson(
        400,
        `Unknown source: ${source}. Available: ${Object.keys(BACKUP_EXPORT_SOURCE_MAP).join(", ")}`
      );
    }

    const { integration, action } = BACKUP_EXPORT_SOURCE_MAP[source];
    const dataSource = findDataSource(integration, action);

    if (!dataSource) {
      return errorJson(404, `Data source not found: ${integration}/${action}`);
    }

    const ctx = buildDataSourceContext();
    const data = await dataSource.fetch(
      { projectSlug: projectSlug ?? null, range, timeZone, forceRefresh: false },
      ctx
    );
    const filename = `${source}-${range}-${new Date().toISOString().slice(0, 10)}`;

    if (format === "csv") {
      const csv = exportJsonToCsv(data);
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}.csv"`,
        },
      });
    }

    const jsonStr = JSON.stringify(data, null, 2);
    return new Response(jsonStr, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.json"`,
      },
    });
  } catch (error) {
    log.error("Export failed", { error });
    const message = error instanceof Error ? error.message : "Unknown error";
    return errorJson(500, message);
  }
}
