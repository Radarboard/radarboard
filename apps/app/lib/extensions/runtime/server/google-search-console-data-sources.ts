import type {
  CommonRouteParams,
  DataSourceContext,
  DataSourceDescriptor,
} from "@radarboard/integration-sdk/types";
import type { DataPoint } from "@radarboard/types/dashboard";
import type {
  SearchQuery,
  SeoOverview,
  SeoOverviewTrendRow,
  SeoQueryDetail,
  SeoQueryDetailRow,
} from "@radarboard/types/seo";
import { getTimeRangeWindow } from "@radarboard/utils/timezone";

const GSC_API_BASE = "https://searchconsole.googleapis.com";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_ACCESS_TOKEN_FIELD = "access_token";
const MAX_QUERY_ROWS = 25;
const MAX_TREND_ROWS = 25_000;
const MAX_AUTO_SITES = 50;

type ProjectIntegrationsMap = Record<string, Record<string, Record<string, unknown>>>;

interface GoogleSearchConsoleSite {
  siteUrl: string;
  permissionLevel: string;
}

interface GoogleSearchConsoleRow {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
}

interface GoogleSearchConsoleQueryResponse {
  rows?: GoogleSearchConsoleRow[];
  responseAggregationType?: string;
}

interface GoogleSearchConsoleSiteListResponse {
  siteEntry?: GoogleSearchConsoleSite[];
}

interface GoogleAccessCredential {
  accessToken: string;
}

interface GoogleSearchConsoleTarget {
  siteUrl: string;
  projectSlug?: string;
  projectName?: string;
  projectColor?: string;
  platformName?: string;
}

interface GoogleSearchConsoleDataParams {
  siteUrl?: string | null;
}

interface GoogleSearchConsoleQueryParams {
  query?: string | null;
  siteUrl?: string | null;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toStringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function toNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizeCtr(value: unknown): number {
  return toNumber(value) * 100;
}

function normalizePosition(value: unknown): number {
  return toNumber(value);
}

async function refreshGoogleAccessToken(
  raw: Record<string, string>
): Promise<GoogleAccessCredential | null> {
  if (!raw.clientId || !raw.clientSecret || !raw.refreshToken) return null;

  const body = new URLSearchParams();
  body.set("client_id", raw.clientId);
  body.set("client_secret", raw.clientSecret);
  body.set("refresh_token", raw.refreshToken);
  body.set("grant_type", "refresh_token");

  const headers = new Headers();
  headers.set("Content-Type", "application/x-www-form-urlencoded");
  headers.set("Accept", "application/json");

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers,
    body,
  });

  if (!response.ok) return null;

  const payload = readRecord(await response.json());
  const accessToken = toStringValue(payload[GOOGLE_ACCESS_TOKEN_FIELD]);
  return accessToken ? { accessToken } : null;
}

async function resolveGoogleCredential(
  ctx: DataSourceContext
): Promise<GoogleAccessCredential | null> {
  const raw = await ctx.resolveCredential("google-search-console");
  if (!raw) return null;

  const accessToken = raw.accessToken || raw.token;
  if (accessToken) return { accessToken };

  return refreshGoogleAccessToken(raw);
}

async function fetchGoogleJson<T>(
  path: string,
  credentials: GoogleAccessCredential,
  options?: { method?: string; body?: unknown }
): Promise<T> {
  const headers = new Headers();
  headers.set("Authorization", `Bearer ${credentials.accessToken}`);
  headers.set("Accept", "application/json");
  if (options?.body) headers.set("Content-Type", "application/json");

  const response = await fetch(`${GSC_API_BASE}${path}`, {
    method: options?.method ?? "GET",
    headers,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Google Search Console API error ${response.status}: ${body || response.statusText}`
    );
  }

  return (await response.json()) as T;
}

async function listGoogleSearchConsoleSites(
  credentials: GoogleAccessCredential
): Promise<GoogleSearchConsoleSite[]> {
  const payload = await fetchGoogleJson<GoogleSearchConsoleSiteListResponse>(
    "/webmasters/v3/sites",
    credentials
  );

  return (payload.siteEntry ?? [])
    .filter((site) => typeof site.siteUrl === "string" && site.siteUrl.trim().length > 0)
    .slice(0, MAX_AUTO_SITES);
}

async function querySearchAnalytics(
  credentials: GoogleAccessCredential,
  siteUrl: string,
  body: Record<string, unknown>
): Promise<GoogleSearchConsoleQueryResponse> {
  return fetchGoogleJson<GoogleSearchConsoleQueryResponse>(
    `/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    credentials,
    { method: "POST", body }
  );
}

function buildDateBody(params: CommonRouteParams, rowLimit: number) {
  const { startDate, endDate } = getTimeRangeWindow(params.range, params.timeZone);
  return {
    startDate,
    endDate,
    rowLimit,
  };
}

function resolveSiteUrlFromPlatform(
  platform: {
    id: string;
    name: string;
    integrations: Record<string, unknown>;
  },
  projectSlug: string,
  overrides: ProjectIntegrationsMap
): string | null {
  const override = toStringValue(
    overrides[projectSlug]?.[platform.id]?.["googleSearchConsole.siteUrl"]
  );
  const baseConfig = readRecord(platform.integrations.googleSearchConsole);
  return override ?? toStringValue(baseConfig.siteUrl);
}

async function resolveGoogleSearchConsoleTargets(
  ctx: DataSourceContext,
  params: CommonRouteParams & GoogleSearchConsoleDataParams,
  credentials: GoogleAccessCredential
): Promise<GoogleSearchConsoleTarget[]> {
  if (params.siteUrl) return [{ siteUrl: params.siteUrl }];

  const [projects, overrides] = await Promise.all([
    ctx.getAllProjects().catch(() => []),
    ctx.getProjectIntegrations().catch(() => ({}) as ProjectIntegrationsMap),
  ]);
  const targets: GoogleSearchConsoleTarget[] = [];

  for (const project of projects) {
    if (params.projectSlug && project.slug !== params.projectSlug) continue;

    for (const platform of project.platforms) {
      const siteUrl = resolveSiteUrlFromPlatform(platform, project.slug, overrides);
      if (!siteUrl) continue;

      targets.push({
        siteUrl,
        projectSlug: project.slug,
        projectName: project.name,
        projectColor: project.color,
        platformName: platform.name,
      });
    }
  }

  if (targets.length > 0 || params.projectSlug) return targets;

  const sites = await listGoogleSearchConsoleSites(credentials);
  const onlySite = sites[0];
  if (sites.length === 1 && onlySite) return [{ siteUrl: onlySite.siteUrl }];

  return [];
}

function missingProjectMappingState() {
  return {
    configured: false as const,
    ctaLabel: "Open Project Settings",
    ctaTarget: "intent:google-search-console-project",
    projectMappingRequired: true,
    setupMessage:
      "Google Search Console is connected, but no site is linked yet. Add a site URL in Project Settings.",
  };
}

function normalizeQueryRow(
  row: GoogleSearchConsoleRow,
  target: GoogleSearchConsoleTarget
): SearchQuery {
  return {
    query: row.keys?.[0] ?? "(not provided)",
    clicks: toNumber(row.clicks),
    impressions: toNumber(row.impressions),
    ctr: normalizeCtr(row.ctr),
    position: normalizePosition(row.position),
    projectName: target.projectName,
    projectColor: target.projectColor,
    siteUrl: target.siteUrl,
  };
}

function normalizeTrendRow(row: GoogleSearchConsoleRow): SeoOverviewTrendRow {
  return {
    date: row.keys?.[0] ?? "",
    clicks: toNumber(row.clicks),
    impressions: toNumber(row.impressions),
    ctr: normalizeCtr(row.ctr),
    position: normalizePosition(row.position),
  };
}

function weightedAverage(
  rows: SeoOverviewTrendRow[],
  valueKey: "ctr" | "position",
  weightKey: "clicks" | "impressions"
): number {
  const totalWeight = rows.reduce((sum, row) => sum + row[weightKey], 0);
  if (totalWeight <= 0) return 0;
  return rows.reduce((sum, row) => sum + row[valueKey] * row[weightKey], 0) / totalWeight;
}

function sumBy(rows: SeoOverviewTrendRow[], key: "clicks" | "impressions"): number {
  return rows.reduce((sum, row) => sum + row[key], 0);
}

function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

function splitTrend(rows: SeoOverviewTrendRow[]) {
  const midpoint = Math.floor(rows.length / 2);
  return {
    previous: rows.slice(0, midpoint),
    current: rows.slice(midpoint),
  };
}

function trendToDataPoints(
  rows: SeoOverviewTrendRow[],
  key: keyof SeoOverviewTrendRow
): DataPoint[] {
  return rows.map((row) => ({ date: row.date, value: toNumber(row[key]) }));
}

function combineSeoResults(
  results: Array<{
    target: GoogleSearchConsoleTarget;
    queries: SearchQuery[];
    trend: SeoOverviewTrendRow[];
  }>
): SeoOverview {
  const queries = results
    .flatMap((result) => result.queries)
    .toSorted((left, right) => right.clicks - left.clicks)
    .slice(0, MAX_QUERY_ROWS);
  const trendByDate = new Map<string, SeoOverviewTrendRow[]>();

  for (const row of results.flatMap((result) => result.trend)) {
    if (!row.date) continue;
    const existing = trendByDate.get(row.date) ?? [];
    existing.push(row);
    trendByDate.set(row.date, existing);
  }

  const overviewTrend = [...trendByDate.entries()]
    .map(([date, rows]) => ({
      date,
      clicks: sumBy(rows, "clicks"),
      impressions: sumBy(rows, "impressions"),
      ctr: weightedAverage(rows, "ctr", "impressions"),
      position: weightedAverage(rows, "position", "impressions"),
    }))
    .toSorted((left, right) => left.date.localeCompare(right.date));
  const totalClicks = sumBy(overviewTrend, "clicks");
  const totalImpressions = sumBy(overviewTrend, "impressions");
  const { previous, current } = splitTrend(overviewTrend);

  return {
    queries,
    clicksTrend: trendToDataPoints(overviewTrend, "clicks"),
    impressionsTrend: trendToDataPoints(overviewTrend, "impressions"),
    ctrTrend: trendToDataPoints(overviewTrend, "ctr"),
    positionTrend: trendToDataPoints(overviewTrend, "position"),
    overviewTrend,
    totalClicks,
    totalImpressions,
    avgCtr: weightedAverage(overviewTrend, "ctr", "impressions"),
    avgPosition: weightedAverage(overviewTrend, "position", "impressions"),
    clicksChange: percentChange(sumBy(current, "clicks"), sumBy(previous, "clicks")),
    impressionsChange: percentChange(sumBy(current, "impressions"), sumBy(previous, "impressions")),
    ctrChange: percentChange(
      weightedAverage(current, "ctr", "impressions"),
      weightedAverage(previous, "ctr", "impressions")
    ),
    positionChange: percentChange(
      weightedAverage(current, "position", "impressions"),
      weightedAverage(previous, "position", "impressions")
    ),
    latestAvailableDate: overviewTrend.at(-1)?.date ?? null,
  };
}

async function fetchTargetSeo(
  target: GoogleSearchConsoleTarget,
  credentials: GoogleAccessCredential,
  params: CommonRouteParams
) {
  const baseBody = buildDateBody(params, MAX_TREND_ROWS);
  const [queriesPayload, trendPayload] = await Promise.all([
    querySearchAnalytics(credentials, target.siteUrl, {
      ...baseBody,
      dimensions: ["query"],
      rowLimit: MAX_QUERY_ROWS,
    }),
    querySearchAnalytics(credentials, target.siteUrl, {
      ...baseBody,
      dimensions: ["date"],
      rowLimit: MAX_TREND_ROWS,
    }),
  ]);

  return {
    target,
    queries: (queriesPayload.rows ?? []).map((row) => normalizeQueryRow(row, target)),
    trend: (trendPayload.rows ?? []).map(normalizeTrendRow),
  };
}

function normalizeDetailRow<K extends string>(
  row: GoogleSearchConsoleRow,
  key: K
): Record<K, string> & SeoQueryDetailRow {
  return {
    [key]: row.keys?.[0] ?? "",
    clicks: toNumber(row.clicks),
    impressions: toNumber(row.impressions),
    ctr: normalizeCtr(row.ctr),
    position: normalizePosition(row.position),
  } as Record<K, string> & SeoQueryDetailRow;
}

async function fetchSeoQueryDetail(
  credentials: GoogleAccessCredential,
  siteUrl: string,
  query: string,
  params: CommonRouteParams
): Promise<SeoQueryDetail> {
  const baseBody = buildDateBody(params, MAX_TREND_ROWS);
  const queryFilter = {
    dimension: "query",
    operator: "equals",
    expression: query,
  };
  const filterBody = {
    ...baseBody,
    dimensionFilterGroups: [{ filters: [queryFilter] }],
  };
  const [trendPayload, pagesPayload, devicesPayload, countriesPayload] = await Promise.all([
    querySearchAnalytics(credentials, siteUrl, { ...filterBody, dimensions: ["date"] }),
    querySearchAnalytics(credentials, siteUrl, {
      ...filterBody,
      dimensions: ["page"],
      rowLimit: 20,
    }),
    querySearchAnalytics(credentials, siteUrl, {
      ...filterBody,
      dimensions: ["device"],
      rowLimit: 10,
    }),
    querySearchAnalytics(credentials, siteUrl, {
      ...filterBody,
      dimensions: ["country"],
      rowLimit: 10,
    }),
  ]);
  const trend = (trendPayload.rows ?? []).map(normalizeTrendRow);

  return {
    clicksTrend: trendToDataPoints(trend, "clicks"),
    impressionsTrend: trendToDataPoints(trend, "impressions"),
    positionTrend: trendToDataPoints(trend, "position"),
    pages: (pagesPayload.rows ?? []).map((row) => normalizeDetailRow(row, "page")),
    devices: (devicesPayload.rows ?? []).map((row) => normalizeDetailRow(row, "device")),
    countries: (countriesPayload.rows ?? []).map((row) => normalizeDetailRow(row, "country")),
  };
}

export const googleSearchConsoleDataSource: DataSourceDescriptor<
  GoogleSearchConsoleDataParams,
  unknown
> = {
  action: "data",
  description: "Fetches Search Console clicks, impressions, CTR, rankings, and top queries.",
  cacheTtlSeconds: 300,
  pollingSourceId: "seo",
  buildCacheKey: (params) =>
    `seo:${params.projectSlug ?? "all"}:${params.siteUrl ?? "auto"}:${params.range}:${params.timeZone}`,
  parseParams: (searchParams) => ({
    siteUrl: searchParams.get("siteUrl"),
  }),
  async fetch(params, ctx) {
    const credentials = await resolveGoogleCredential(ctx);
    if (!credentials) return { configured: false as const };

    const targets = await resolveGoogleSearchConsoleTargets(ctx, params, credentials);
    if (targets.length === 0) return missingProjectMappingState();

    const results = await Promise.all(
      targets.map((target) => fetchTargetSeo(target, credentials, params))
    );

    return {
      configured: true as const,
      seo: combineSeoResults(results),
    };
  },
};

export const googleSearchConsoleSitesDataSource: DataSourceDescriptor = {
  action: "sites",
  description: "Lists Search Console sites available to the connected Google account.",
  cacheTtlSeconds: 3600,
  buildCacheKey: () => "google-search-console:sites",
  async fetch(_params, ctx) {
    const credentials = await resolveGoogleCredential(ctx);
    if (!credentials) return { configured: false as const, sites: [] };

    const sites = await listGoogleSearchConsoleSites(credentials);
    return { configured: true as const, sites };
  },
};

export const googleSearchConsoleQueryDataSource: DataSourceDescriptor<
  GoogleSearchConsoleQueryParams,
  unknown
> = {
  action: "query",
  description: "Fetches per-query Search Console detail for the SEO query modal.",
  cacheTtlSeconds: 3600,
  buildCacheKey: (params) =>
    `seo:query:${params.siteUrl ?? "none"}:${params.query ?? "none"}:${params.range}:${params.timeZone}`,
  parseParams: (searchParams) => ({
    query: searchParams.get("query"),
    siteUrl: searchParams.get("siteUrl"),
  }),
  async fetch(params, ctx) {
    const credentials = await resolveGoogleCredential(ctx);
    if (!credentials) return { configured: false as const };
    if (!params.query || !params.siteUrl) return { configured: false as const, detail: null };

    const detail = await fetchSeoQueryDetail(credentials, params.siteUrl, params.query, params);
    return { configured: true as const, detail };
  },
};

// biome-ignore lint/suspicious/noExplicitAny: data-source registry stores heterogeneous descriptors
export const googleSearchConsoleDataSources: DataSourceDescriptor<any, any>[] = [
  googleSearchConsoleDataSource,
  googleSearchConsoleSitesDataSource,
  googleSearchConsoleQueryDataSource,
];
