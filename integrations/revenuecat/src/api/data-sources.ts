import type { DataSourceContext, DataSourceDescriptor } from "@radarboard/integration-sdk/types";
import { getTimeRangeWindow } from "@radarboard/utils/timezone";
import { revenuecatDelta } from "../events/delta";
import type {
  ChartDataResponse,
  Currency,
  OverviewMetricsResponse,
  RevenueCatConfig,
} from "../types";
import { extractMetric, getChartData, getOverviewMetrics } from "./client";

type DisplayCurrency = "USD" | "CAD" | "EUR" | "GBP" | "JPY";

interface RevenueParams {
  currency: DisplayCurrency;
}

interface DataPoint {
  date: string;
  value: number;
}

type DbOverrides = Record<string, Record<string, Record<string, unknown>>>;

function resolveOverrideString(
  overrides: DbOverrides,
  projectSlug: string,
  platformId: string,
  key: string
): string | null {
  const val = overrides[projectSlug]?.[platformId]?.[key];
  return typeof val === "string" && val ? val : null;
}

function getDateRangeForTimeZone(
  range: string,
  timeZone: string
): { startDate: string; endDate: string; resolution: string } {
  // biome-ignore lint/suspicious/noExplicitAny: data-source descriptor requires heterogeneous type params
  const { startDate, endDate } = getTimeRangeWindow(range as any, timeZone);
  return {
    startDate,
    endDate,
    resolution: range === "3m" || range === "1y" ? "1" : "0",
  };
}

function parseChartValues(values: unknown[] | undefined): DataPoint[] {
  if (!values) return [];
  const points: DataPoint[] = [];
  for (const row of values) {
    const entry = row as { cohort?: number; value?: number; measure?: number };
    if (entry.cohort != null && (entry.measure ?? 0) === 0) {
      const dateMs = entry.cohort > 1e12 ? entry.cohort : entry.cohort * 1000;
      points.push({
        date: new Date(dateMs).toISOString().split("T")[0] ?? "",
        value: entry.value ?? 0,
      });
    }
  }
  return points;
}

function formatRevenueTimeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function buildRevenueResponse(
  overview: OverviewMetricsResponse,
  revenueChart: ChartDataResponse,
  proceedsChart: ChartDataResponse,
  currencyParam: DisplayCurrency
) {
  const mrrMetric = extractMetric(overview, "mrr");
  const revenueMetric = extractMetric(overview, "revenue");

  const grossPoints = parseChartValues(revenueChart.values as unknown[]);
  const proceedsPoints = parseChartValues(proceedsChart.values as unknown[]);
  const totalProceeds = proceedsPoints.reduce((sum, p) => sum + p.value, 0);
  const lastNonZero = [...grossPoints].reverse().find((p) => p.value > 0);
  const chartCurrency = revenueChart.yaxis_currency ?? currencyParam;

  const revenueData = {
    grossRevenue: {
      value: revenueMetric?.value ?? 0,
      previousValue: 0,
      currency: chartCurrency,
      sparklineData: grossPoints.slice(-14),
    },
    mrr: {
      value: mrrMetric?.value ?? 0,
      previousValue: 0,
      currency: chartCurrency,
      sparklineData: grossPoints.slice(-14),
    },
    netRevenue: {
      value: Math.round(totalProceeds * 100) / 100,
      previousValue: 0,
      currency: proceedsChart.yaxis_currency ?? currencyParam,
      sparklineData: proceedsPoints.slice(-14),
    },
    lastPayment: {
      amount: lastNonZero?.value ?? 0,
      currency: chartCurrency,
      country: "",
      countryCode: "",
      projectName: "Goshuin Atlas",
      projectColor: "#E63946",
      timeAgo: lastNonZero ? formatRevenueTimeAgo(lastNonZero.date) : "",
    },
  };

  const revenueSeries = [
    { projectName: "Goshuin Atlas", projectColor: "#E63946", data: grossPoints },
  ];

  return {
    configured: true as const,
    revenue: revenueData,
    revenueSeries,
    raw: {
      overview: overview.metrics.map((m) => ({
        id: m.id,
        name: m.name,
        value: m.value,
        unit: m.unit,
      })),
      newCustomers: extractMetric(overview, "new_customers")?.value ?? 0,
      activeUsers: extractMetric(overview, "active_users")?.value ?? 0,
    },
  };
}

function resolveRcProjectId(
  projects: Array<{
    slug: string;
    platforms: Array<{ id: string; integrations: Record<string, unknown> }>;
  }>,
  dbOverrides: DbOverrides,
  projectSlug: string | null
): string | null {
  if (projectSlug) {
    const project = projects.find((p) => p.slug === projectSlug);
    const rcPlatform = project?.platforms.find(
      (p) =>
        (p.integrations.revenuecat as { projectId?: string } | undefined) ||
        dbOverrides[projectSlug]?.[p.id]?.["revenuecat.projectId"]
    );
    if (!rcPlatform) return null;
    return (
      resolveOverrideString(dbOverrides, projectSlug, rcPlatform.id, "revenuecat.projectId") ??
      (rcPlatform.integrations.revenuecat as { projectId?: string } | undefined)?.projectId ??
      null
    );
  }
  for (const project of projects) {
    for (const platform of project.platforms) {
      const id =
        resolveOverrideString(dbOverrides, project.slug, platform.id, "revenuecat.projectId") ??
        (platform.integrations.revenuecat as { projectId?: string } | undefined)?.projectId ??
        null;
      if (id) return id;
    }
  }
  return null;
}

async function resolveConfig(
  ctx: DataSourceContext,
  rcProjectId: string | undefined
): Promise<RevenueCatConfig | null> {
  const creds = await ctx.resolveCredential("revenuecat");
  if (!creds?.apiKey) return null;
  const resolvedProjectId = rcProjectId || creds.projectId;
  if (!resolvedProjectId) return null;
  return { apiKey: creds.apiKey, projectId: resolvedProjectId };
}

function buildMissingRevenueCatProjectSetupState() {
  return {
    configured: false as const,
    ctaLabel: "Open Project Settings",
    ctaTarget: "intent:revenuecat-project",
    projectMappingRequired: true,
    setupMessage:
      "RevenueCat is connected, but no project is linked yet. Add a RevenueCat project ID in Project Settings.",
  };
}

export const revenuecatDataSource: DataSourceDescriptor<RevenueParams> = {
  action: "data",
  description: "Fetches revenue metrics from RevenueCat (MRR, gross revenue, charts).",
  cacheTtlSeconds: 300,
  pollingSourceId: "revenue",
  evictPrefixes: ["overview:", "chart:"],
  parseParams: (sp) => ({
    currency: (sp.get("currency") ?? "USD") as DisplayCurrency,
  }),
  buildCacheKey: (params) =>
    `revenue:${params.projectSlug ?? "all"}:${params.range}:${params.currency}:${params.timeZone}`,
  async fetch(params, ctx) {
    const { projectSlug, range, currency, timeZone } = params;

    const [allProjects, dbOverrides] = await Promise.all([
      ctx.getAllProjects(),
      ctx.getProjectIntegrations().catch(() => ({}) as DbOverrides),
    ]);

    const rcProjectId = resolveRcProjectId(allProjects, dbOverrides, projectSlug);
    const creds = await ctx.resolveCredential("revenuecat");
    const hasRevenueCatCredential = Boolean(creds?.apiKey);
    const hasGlobalProjectId = typeof creds?.projectId === "string" && creds.projectId.length > 0;

    if (hasRevenueCatCredential && !rcProjectId && !hasGlobalProjectId) {
      return buildMissingRevenueCatProjectSetupState();
    }

    const config = await resolveConfig(ctx, rcProjectId ?? undefined);
    if (!config) return { configured: false as const };

    const rcCurrency = currency as Currency;
    const { startDate, endDate, resolution } = getDateRangeForTimeZone(range, timeZone);

    const chartOptions: { resolution: string; startDate?: string; endDate?: string } = {
      resolution,
    };
    if (startDate) {
      chartOptions.startDate = startDate;
      chartOptions.endDate = endDate;
    }

    const [overview, revenueChart, proceedsChart] = await Promise.all([
      getOverviewMetrics(config, rcCurrency),
      getChartData(config, "revenue", { ...chartOptions, currency: rcCurrency }),
      getChartData(config, "revenue", {
        ...chartOptions,
        currency: rcCurrency,
        selectors: { revenue_type: "proceeds" },
      }),
    ]);

    return buildRevenueResponse(overview, revenueChart, proceedsChart, currency);
  },
  delta: {
    // biome-ignore lint/suspicious/noExplicitAny: data-source descriptor requires heterogeneous type params
    extractData: (data: any) => data.revenue,
    detector: revenuecatDelta,
    // biome-ignore lint/suspicious/noExplicitAny: data-source descriptor requires heterogeneous type params
    shouldDetect: (data: any) =>
      data.configured !== false &&
      "revenue" in data &&
      data.revenue &&
      typeof data.revenue === "object" &&
      "grossRevenue" in data.revenue,
  },
};

// biome-ignore lint/suspicious/noExplicitAny: data-source descriptor requires heterogeneous type params
export const revenuecatDataSources: DataSourceDescriptor<any, any>[] = [revenuecatDataSource];
