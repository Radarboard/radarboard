import type {
  CommonRouteParams,
  DataSourceContext,
  DataSourceDescriptor,
} from "@radarboard/integration-sdk/types";
import { getTimeRangeWindow } from "@radarboard/utils/timezone";
import {
  getSearchAnalytics,
  getSearchAnalyticsByDate,
  getSearchAnalyticsForQuery,
  listSites,
} from "./client";

interface DataPoint {
  date: string;
  value: number;
}

type GSCConfig = { clientId: string; clientSecret: string; refreshToken: string };

function buildMissingGscProjectSetupState() {
  return {
    configured: false as const,
    ctaLabel: "Open Project Settings",
    ctaTarget: "intent:google-search-console-project",
    projectMappingRequired: true,
    setupMessage:
      "Google Search Console is connected, but no site is linked yet. Add a site URL in Project Settings.",
  };
}

async function resolveConfig(ctx: DataSourceContext): Promise<GSCConfig | null> {
  const creds = await ctx.resolveCredential("google-search-console");
  if (creds?.refreshToken && creds?.clientId && creds?.clientSecret) {
    return {
      clientId: creds.clientId,
      clientSecret: creds.clientSecret,
      refreshToken: creds.refreshToken,
    };
  }
  return null;
}

function mergeTrends(trends: DataPoint[][]): DataPoint[] {
  const map = new Map<string, number>();
  for (const trend of trends) {
    for (const point of trend) {
      map.set(point.date, (map.get(point.date) ?? 0) + point.value);
    }
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, value }));
}

function getDateRange(range: string, timeZone: string) {
  // biome-ignore lint/suspicious/noExplicitAny: data-source descriptor requires heterogeneous type params
  const { startDate, endDate } = getTimeRangeWindow(range as any, timeZone);
  return { startDate, endDate };
}

function getPreviousPeriod(
  startDate: string,
  endDate: string
): { startDate: string; endDate: string } {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const durationMs = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 86_400_000); // day before current start
  const prevStart = new Date(prevEnd.getTime() - durationMs);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { startDate: fmt(prevStart), endDate: fmt(prevEnd) };
}

function computeChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

async function fetchSeoForSite(
  config: GSCConfig,
  siteUrl: string,
  projectName: string | undefined,
  projectColor: string | undefined,
  range: string,
  fixedDate: string | null,
  timeZone: string
) {
  const resolveLatestAvailableDate = async () => {
    const { startDate, endDate } = getDateRange("7d", timeZone);
    const dateData = await getSearchAnalyticsByDate(config, siteUrl, { startDate, endDate });
    const dates = (dateData.rows ?? [])
      .map((row) => row.keys[0] ?? null)
      .filter((date): date is string => Boolean(date))
      .sort((left, right) => left.localeCompare(right));
    return dates.at(-1) ?? null;
  };

  const latestAvailableDate =
    range === "today" ? (fixedDate ?? (await resolveLatestAvailableDate())) : null;

  if (range === "today" && !latestAvailableDate) {
    return {
      queries: [],
      clicksTrend: [],
      impressionsTrend: [],
      ctrTrend: [],
      positionTrend: [],
      latestAvailableDate: null,
    };
  }

  const { startDate, endDate } =
    range === "today" && latestAvailableDate
      ? { startDate: latestAvailableDate, endDate: latestAvailableDate }
      : getDateRange(range, timeZone);

  const [queryData, dateData] = await Promise.all([
    getSearchAnalytics(config, siteUrl, {
      startDate,
      endDate,
      dimensions: ["query"],
      rowLimit: 25,
    }),
    getSearchAnalyticsByDate(config, siteUrl, { startDate, endDate }),
  ]);

  const queries = (queryData.rows ?? []).map((row) => ({
    query: row.keys[0] ?? "",
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr * 100,
    position: row.position,
    siteUrl,
    projectName,
    projectColor,
  }));

  const clicksTrend: DataPoint[] = (dateData.rows ?? []).map((row) => ({
    date: row.keys[0] ?? "",
    value: row.clicks,
  }));

  const impressionsTrend: DataPoint[] = (dateData.rows ?? []).map((row) => ({
    date: row.keys[0] ?? "",
    value: row.impressions,
  }));

  const ctrTrend: DataPoint[] = (dateData.rows ?? []).map((row) => ({
    date: row.keys[0] ?? "",
    value: Number((row.ctr * 100).toFixed(2)),
  }));

  const positionTrend: DataPoint[] = (dateData.rows ?? []).map((row) => ({
    date: row.keys[0] ?? "",
    value: Number(row.position.toFixed(1)),
  }));

  return { queries, clicksTrend, impressionsTrend, ctrTrend, positionTrend, latestAvailableDate };
}

interface PreviousPeriodTotals {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

function mergeOverviewTrend(
  clicksTrend: DataPoint[],
  impressionsTrend: DataPoint[],
  ctrTrend: DataPoint[],
  positionTrend: DataPoint[]
) {
  const map = new Map<
    string,
    { clicks: number; impressions: number; ctr: number; position: number }
  >();
  for (const p of clicksTrend)
    map.set(p.date, { clicks: p.value, impressions: 0, ctr: 0, position: 0 });
  for (const p of impressionsTrend) {
    const row = map.get(p.date);
    if (row) row.impressions = p.value;
    else map.set(p.date, { clicks: 0, impressions: p.value, ctr: 0, position: 0 });
  }
  for (const p of ctrTrend) {
    const row = map.get(p.date);
    if (row) row.ctr = p.value;
    else map.set(p.date, { clicks: 0, impressions: 0, ctr: p.value, position: 0 });
  }
  for (const p of positionTrend) {
    const row = map.get(p.date);
    if (row) row.position = p.value;
    else map.set(p.date, { clicks: 0, impressions: 0, ctr: 0, position: p.value });
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, row]) => ({ date, ...row }));
}

function buildSeoOverview(
  // biome-ignore lint/suspicious/noExplicitAny: data-source descriptor requires heterogeneous type params
  queries: any[],
  clicksTrend: DataPoint[],
  impressionsTrend: DataPoint[],
  ctrTrend: DataPoint[],
  positionTrend: DataPoint[],
  latestAvailableDate: string | null = null,
  previous: PreviousPeriodTotals | null = null
) {
  const totalClicks = queries.reduce((sum, q) => sum + q.clicks, 0);
  const totalImpressions = queries.reduce((sum, q) => sum + q.impressions, 0);
  const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const avgPosition =
    queries.length > 0 ? queries.reduce((sum, q) => sum + q.position, 0) / queries.length : 0;
  return {
    queries,
    clicksTrend,
    impressionsTrend,
    ctrTrend,
    positionTrend,
    overviewTrend: mergeOverviewTrend(clicksTrend, impressionsTrend, ctrTrend, positionTrend),
    totalClicks,
    totalImpressions,
    avgCtr,
    avgPosition,
    clicksChange: previous ? computeChange(totalClicks, previous.clicks) : null,
    impressionsChange: previous ? computeChange(totalImpressions, previous.impressions) : null,
    ctrChange: previous ? computeChange(avgCtr, previous.ctr) : null,
    positionChange: previous ? computeChange(previous.position, avgPosition) : null,
    latestAvailableDate,
  };
}

function handleSeoError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes("Token refresh failed") || message.includes("401")) {
    return { configured: true as const, seo: null, tokenExpired: true, error: message };
  }
  throw err;
}

interface SeoParams {
  siteUrl: string | null;
}

type ProjectEntry = Awaited<ReturnType<DataSourceContext["getAllProjects"]>>[number];
type PlatformEntry = ProjectEntry["platforms"][number];
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

function resolveGscSiteUrl(
  platform: PlatformEntry,
  projectSlug: string,
  dbOverrides: DbOverrides
): string | null {
  return (
    resolveOverrideString(dbOverrides, projectSlug, platform.id, "googleSearchConsole.siteUrl") ??
    (platform.integrations.googleSearchConsole as { siteUrl?: string } | undefined)?.siteUrl ??
    null
  );
}

async function fetchAllProjectsSeo(
  ctx: DataSourceContext,
  allProjects: ProjectEntry[],
  dbOverrides: DbOverrides,
  range: string,
  timeZone: string
) {
  const config = await resolveConfig(ctx);
  if (!config) return { configured: false as const };

  const gscPlatforms = allProjects.flatMap((project) =>
    project.platforms
      .map((p: PlatformEntry) => ({
        siteUrl: resolveGscSiteUrl(p, project.slug, dbOverrides) ?? "",
        projectName: project.name,
        projectColor: project.color,
      }))
      .filter((p: { siteUrl: string }) => p.siteUrl !== "")
  );

  if (gscPlatforms.length === 0) return buildMissingGscProjectSetupState();

  try {
    let sharedLatestDate: string | null = null;
    if (range === "today") {
      const latestDates = await Promise.all(
        gscPlatforms.map((platform) =>
          fetchSeoForSite(
            config,
            platform.siteUrl,
            platform.projectName,
            platform.projectColor,
            "today",
            null,
            timeZone
          ).then((result) => result.latestAvailableDate)
        )
      );
      const availableDates = latestDates.filter((date): date is string => Boolean(date));
      sharedLatestDate =
        availableDates.length > 0
          ? (availableDates.sort((l, r) => l.localeCompare(r))[0] ?? null)
          : null;
    }

    const { startDate, endDate } =
      range === "today" ? { startDate: range, endDate: range } : getDateRange(range, timeZone);

    const prevRange = range !== "today" ? getPreviousPeriod(startDate, endDate) : null;

    const [results, ...prevResults] = await Promise.all([
      Promise.all(
        gscPlatforms.map((platform) =>
          fetchSeoForSite(
            config,
            platform.siteUrl,
            platform.projectName,
            platform.projectColor,
            range,
            sharedLatestDate,
            timeZone
          )
        )
      ),
      ...(prevRange
        ? gscPlatforms.map((platform) =>
            getSearchAnalyticsByDate(config, platform.siteUrl, {
              startDate: prevRange.startDate,
              endDate: prevRange.endDate,
            })
          )
        : []),
    ]);

    let previous: PreviousPeriodTotals | null = null;
    if (prevRange && prevResults.length > 0) {
      let totalPrevClicks = 0;
      let totalPrevImpressions = 0;
      let totalPrevPosition = 0;
      let prevRowCount = 0;
      for (const prevData of prevResults) {
        const rows =
          (prevData as { rows?: { clicks: number; impressions: number; position: number }[] })
            .rows ?? [];
        for (const row of rows) {
          totalPrevClicks += row.clicks;
          totalPrevImpressions += row.impressions;
          totalPrevPosition += row.position;
          prevRowCount++;
        }
      }
      if (prevRowCount > 0) {
        previous = {
          clicks: totalPrevClicks,
          impressions: totalPrevImpressions,
          ctr: totalPrevImpressions > 0 ? (totalPrevClicks / totalPrevImpressions) * 100 : 0,
          position: totalPrevPosition / prevRowCount,
        };
      }
    }

    const allQueries = results.flatMap((r) => r.queries);
    const topQueries = allQueries.sort((a, b) => b.clicks - a.clicks).slice(0, 25);
    return {
      configured: true as const,
      seo: buildSeoOverview(
        topQueries,
        mergeTrends(results.map((r) => r.clicksTrend)),
        mergeTrends(results.map((r) => r.impressionsTrend)),
        mergeTrends(results.map((r) => r.ctrTrend)),
        mergeTrends(results.map((r) => r.positionTrend)),
        sharedLatestDate,
        previous
      ),
    };
  } catch (err) {
    return handleSeoError(err);
  }
}

export const gscDataSource: DataSourceDescriptor<SeoParams> = {
  action: "data",
  description: "Fetches search analytics from Google Search Console.",
  cacheTtlSeconds: 300,
  pollingSourceId: "seo",
  parseParams: (sp) => ({ siteUrl: sp.get("siteUrl") }),
  buildCacheKey: (params) =>
    `seo:${params.projectSlug ?? "all"}:${params.siteUrl ?? "none"}:${params.range}:${params.timeZone}`,
  async fetch(params, ctx) {
    const { projectSlug, range, timeZone } = params;
    let { siteUrl } = params;

    const [allProjects, dbOverrides] = await Promise.all([
      ctx.getAllProjects(),
      ctx.getProjectIntegrations().catch(() => ({}) as DbOverrides),
    ]);

    if (!projectSlug && !siteUrl) {
      return fetchAllProjectsSeo(ctx, allProjects, dbOverrides, range, timeZone);
    }

    if (!siteUrl && projectSlug) {
      const project = allProjects.find((p) => p.slug === projectSlug);
      const gscPlatform = project?.platforms.find((p: PlatformEntry) =>
        resolveGscSiteUrl(p, projectSlug, dbOverrides)
      );
      siteUrl = gscPlatform ? resolveGscSiteUrl(gscPlatform, projectSlug, dbOverrides) : null;
    }

    const config = await resolveConfig(ctx);
    if (!config) return { configured: false as const };
    if (!siteUrl) return buildMissingGscProjectSetupState();

    try {
      const { startDate, endDate } =
        range === "today" ? { startDate: range, endDate: range } : getDateRange(range, timeZone);

      const prevRange = range !== "today" ? getPreviousPeriod(startDate, endDate) : null;

      const [seoSiteData, prevDateData] = await Promise.all([
        fetchSeoForSite(config, siteUrl, undefined, undefined, range, null, timeZone),
        prevRange
          ? getSearchAnalyticsByDate(config, siteUrl, {
              startDate: prevRange.startDate,
              endDate: prevRange.endDate,
            })
          : Promise.resolve(null),
      ]);

      let previous: PreviousPeriodTotals | null = null;
      if (prevDateData?.rows?.length) {
        const prevClicks = prevDateData.rows.reduce((s, r) => s + r.clicks, 0);
        const prevImpressions = prevDateData.rows.reduce((s, r) => s + r.impressions, 0);
        previous = {
          clicks: prevClicks,
          impressions: prevImpressions,
          ctr: prevImpressions > 0 ? (prevClicks / prevImpressions) * 100 : 0,
          position:
            prevDateData.rows.reduce((s, r) => s + r.position, 0) / prevDateData.rows.length,
        };
      }

      return {
        configured: true as const,
        seo: buildSeoOverview(
          seoSiteData.queries,
          seoSiteData.clicksTrend,
          seoSiteData.impressionsTrend,
          seoSiteData.ctrTrend,
          seoSiteData.positionTrend,
          seoSiteData.latestAvailableDate,
          previous
        ),
      };
    } catch (err) {
      return handleSeoError(err);
    }
  },
};

export const gscSitesDataSource: DataSourceDescriptor = {
  action: "sites",
  description: "Returns the list of GSC-verified sites for the authenticated user.",
  cacheTtlSeconds: 600,
  buildCacheKey: () => "seo:sites",
  async fetch(_params: CommonRouteParams, ctx: DataSourceContext) {
    const config = await resolveConfig(ctx);
    if (!config) return { sites: [], configured: false };

    const sites = await listSites(config);
    return { sites, configured: true };
  },
};

interface QueryParams {
  siteUrl: string | null;
  query: string | null;
}

export const gscQueryDataSource: DataSourceDescriptor<QueryParams> = {
  action: "query",
  description: "Per-query detail (trend, pages, devices, countries).",
  cacheTtlSeconds: 3600,
  parseParams: (sp) => ({ siteUrl: sp.get("siteUrl"), query: sp.get("query") }),
  buildCacheKey: (params) => `seo-query:${params.siteUrl}:${params.query}`,
  async fetch(params, ctx) {
    const { siteUrl, query } = params;

    if (!siteUrl || !query) {
      throw new Error("siteUrl and query are required");
    }

    const config = await resolveConfig(ctx);
    if (!config) return { configured: false as const };

    try {
      const [dateData, pageData, deviceData, countryData] = await Promise.all([
        getSearchAnalyticsForQuery(config, siteUrl, query, "date"),
        getSearchAnalyticsForQuery(config, siteUrl, query, "page"),
        getSearchAnalyticsForQuery(config, siteUrl, query, "device"),
        getSearchAnalyticsForQuery(config, siteUrl, query, "country", { rowLimit: 5 }),
      ]);

      const clicksTrend: DataPoint[] = (dateData.rows ?? []).map((row) => ({
        date: row.keys[0] ?? "",
        value: row.clicks,
      }));

      const impressionsTrend: DataPoint[] = (dateData.rows ?? []).map((row) => ({
        date: row.keys[0] ?? "",
        value: row.impressions,
      }));

      const positionTrend: DataPoint[] = (dateData.rows ?? []).map((row) => ({
        date: row.keys[0] ?? "",
        value: Number(row.position.toFixed(1)),
      }));

      return {
        configured: true as const,
        detail: {
          clicksTrend,
          impressionsTrend,
          positionTrend,
          pages: (pageData.rows ?? []).map((row) => ({
            page: row.keys[0] ?? "",
            clicks: row.clicks,
            impressions: row.impressions,
            ctr: row.ctr * 100,
            position: row.position,
          })),
          devices: (deviceData.rows ?? []).map((row) => ({
            device: row.keys[0] ?? "",
            clicks: row.clicks,
            impressions: row.impressions,
            ctr: row.ctr * 100,
            position: row.position,
          })),
          countries: (countryData.rows ?? []).map((row) => ({
            country: row.keys[0] ?? "",
            clicks: row.clicks,
            impressions: row.impressions,
            ctr: row.ctr * 100,
            position: row.position,
          })),
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("Token refresh failed") || message.includes("401")) {
        return {
          configured: true as const,
          detail: {
            clicksTrend: [],
            impressionsTrend: [],
            positionTrend: [],
            pages: [],
            devices: [],
            countries: [],
          },
        };
      }
      throw err;
    }
  },
};

// biome-ignore lint/suspicious/noExplicitAny: data-source descriptor requires heterogeneous type params
export const gscDataSources: DataSourceDescriptor<any, any>[] = [
  gscDataSource,
  gscSitesDataSource,
  gscQueryDataSource,
];
