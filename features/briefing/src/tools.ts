/**
 * Briefing AI tool executors.
 *
 * Returns execute functions for the generate_daily_briefing tool.
 * The host app wraps these with the AI SDK's tool() helper.
 */

import { findDataSource } from "@radarboard/integration-sdk/registry";
import type { DataSourceContext } from "@radarboard/integration-sdk/types";
import {
  analyzeBriefingMetric,
  determineOverallStatus,
  formatBriefingMarkdown,
  getLatestBriefing,
  storeBriefing,
  type MorningBriefing,
} from "./morning-briefing";

/** Call a registered data-source's fetch function with default params. */
async function callDataSource(
  integration: string,
  action: string,
  params: Record<string, unknown>,
  ctx: DataSourceContext,
): Promise<unknown> {
  const ds = findDataSource(integration, action);
  if (!ds) throw new Error(`Data source ${integration}/${action} not found in registry`);
  return ds.fetch(
    { projectSlug: null, range: "30d", timeZone: "UTC", forceRefresh: false, ...params },
    ctx,
  );
}

/** Resolve the connected analytics provider (OpenPanel or Umami). */
async function resolveAnalyticsProvider(ctx: DataSourceContext): Promise<"openpanel" | "umami" | null> {
  for (const provider of ["openpanel", "umami"] as const) {
    const ds = findDataSource(provider, "data");
    if (!ds) continue;
    try {
      const result = (await ds.fetch(
        { projectSlug: null, range: "7d", timeZone: "UTC", forceRefresh: false },
        ctx,
      )) as Record<string, unknown>;
      if (result.configured !== false) return provider;
    } catch {
      // provider not configured, try next
    }
  }
  return null;
}

/** Extract numeric values from heterogeneous data source responses. */
export function extractNumericValues(data: unknown): number[] {
  if (!data || typeof data !== "object") return [];

  if (Array.isArray(data)) {
    const nums = data.filter((v): v is number => typeof v === "number");
    if (nums.length > 0) return nums;

    const withValues = data
      .map((item) =>
        typeof item === "object" && item !== null && "value" in item
          ? Number((item as Record<string, unknown>).value)
          : Number.NaN
      )
      .filter((n) => !Number.isNaN(n));
    if (withValues.length > 0) return withValues;
  }

  const record = data as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    const val = record[key];
    if (Array.isArray(val)) {
      const result = extractNumericValues(val);
      if (result.length > 0) return result;
    }
    if (typeof val === "object" && val !== null) {
      const result = extractNumericValues(val);
      if (result.length > 0) return result;
    }
  }

  return [];
}

/**
 * Build the briefing tool executor.
 * Takes a DataSourceContext factory since it needs to call data sources.
 */
export function buildBriefingToolExecutor(buildDataSourceContext: () => DataSourceContext) {
  return {
    generate_daily_briefing: async () => {
      const cached = getLatestBriefing();
      if (cached) return { briefing: cached, fromCache: true };

      const ctx = buildDataSourceContext();
      const analyticsProvider = await resolveAnalyticsProvider(ctx);
      const integrationActions: [string, string][] = [
        ...(analyticsProvider ? [[analyticsProvider, "data"] as [string, string]] : []),
        ["revenuecat", "data"],
        ["betterstack", "data"],
        ["stripe", "daily-revenue"],
      ];

      const sections = [];
      for (const [integration, action] of integrationActions) {
        try {
          const data = await callDataSource(integration, action, { range: "30d" }, ctx);
          const values = extractNumericValues(data);
          if (values.length < 4) continue;

          const mid = Math.floor(values.length / 2);
          const section = analyzeBriefingMetric(
            integration,
            action,
            values.slice(mid),
            values.slice(0, mid)
          );
          sections.push(section);
        } catch {
          // Skip integrations that fail
        }
      }

      const overallStatus = determineOverallStatus(sections);
      const markdownSummary = formatBriefingMarkdown(sections);

      const briefing: MorningBriefing = {
        generatedAt: Date.now(),
        sections,
        overallStatus,
        markdownSummary,
      };
      storeBriefing(briefing);
      return { briefing, fromCache: false };
    },
  };
}
