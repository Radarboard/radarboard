import type { DataSourceContext, DataSourceDescriptor } from "@radarboard/integration-sdk/types";
import type { AnalyticsOverview, PlatformMetrics, TopPage } from "@radarboard/types/analytics";
import { getTimeRangeWindow } from "@radarboard/utils/timezone";

const OPENPANEL_API_BASE = "https://api.openpanel.dev";
const MAX_AUTO_PROJECTS = 20;

interface OpenPanelProject {
  id: string;
  name: string;
  domain?: string;
}

interface OpenPanelCredentials {
  clientId: string;
  clientSecret: string;
}

type ProjectIntegrationsMap = Record<string, Record<string, Record<string, unknown>>>;

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function toStringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const record = readRecord(value);
  for (const key of ["data", "items", "results", "projects", "rows"]) {
    const candidate = record[key];
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}

function authHeaders(credentials: OpenPanelCredentials): HeadersInit {
  return {
    "openpanel-client-id": credentials.clientId,
    "openpanel-client-secret": credentials.clientSecret,
  };
}

async function fetchOpenPanelJson<T>(
  path: string,
  credentials: OpenPanelCredentials,
  params?: Record<string, string | number | undefined>
): Promise<T> {
  const url = new URL(path, OPENPANEL_API_BASE);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, { headers: authHeaders(credentials) });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`OpenPanel API error ${response.status}: ${body || response.statusText}`);
  }
  return (await response.json()) as T;
}

async function listOpenPanelProjects(
  credentials: OpenPanelCredentials
): Promise<OpenPanelProject[]> {
  const payload = await fetchOpenPanelJson<unknown>("/manage/projects", credentials);
  return readArray(payload).flatMap((item) => {
    const record = readRecord(item);
    const id = toStringValue(record.id) ?? toStringValue(record.projectId);
    if (!id) return [];
    const project: OpenPanelProject = {
      id,
      name: toStringValue(record.name) ?? id,
      domain: toStringValue(record.domain) ?? undefined,
    };
    return [project];
  });
}

function resolveOpenPanelCredential(
  raw: Record<string, string> | null
): OpenPanelCredentials | null {
  if (!raw?.clientId || !raw.clientSecret) return null;
  return {
    clientId: raw.clientId,
    clientSecret: raw.clientSecret,
  };
}

function resolveProjectIdFromPlatform(
  platform: {
    id: string;
    name: string;
    integrations: Record<string, unknown>;
  },
  projectSlug: string,
  overrides: ProjectIntegrationsMap
): string | null {
  const override = toStringValue(overrides[projectSlug]?.[platform.id]?.["openPanel.projectId"]);
  const baseConfig = readRecord(platform.integrations.openPanel);
  return override ?? toStringValue(baseConfig.projectId);
}

async function resolveOpenPanelTargets(
  ctx: DataSourceContext,
  projectSlug: string | null,
  credentials: OpenPanelCredentials
): Promise<Array<OpenPanelProject & { projectSlug?: string; color?: string }>> {
  const [projects, overrides] = await Promise.all([
    ctx.getAllProjects().catch(() => []),
    ctx.getProjectIntegrations().catch(() => ({}) as ProjectIntegrationsMap),
  ]);
  const targets: Array<OpenPanelProject & { projectSlug?: string; color?: string }> = [];

  for (const project of projects) {
    if (projectSlug && project.slug !== projectSlug) continue;

    for (const platform of project.platforms) {
      const id = resolveProjectIdFromPlatform(platform, project.slug, overrides);
      if (!id) continue;
      targets.push({
        id,
        name: platform.name || id,
        projectSlug: project.slug,
        color: project.color,
      });
    }
  }

  if (targets.length > 0 || projectSlug) {
    return targets;
  }

  return (await listOpenPanelProjects(credentials)).slice(0, MAX_AUTO_PROJECTS);
}

function buildOpenPanelRangeParams(
  range: string,
  timeZone: string
): Record<string, string | undefined> {
  if (range === "1y") return { range: "12m" };
  if (range === "all") return { range: "12m" };
  if (range === "15d") {
    const { startDate, endDate } = getTimeRangeWindow(range, timeZone);
    return { range: "custom", startDate, endDate };
  }
  return { range };
}

function metricValue(metrics: Record<string, unknown>, ...keys: string[]): number {
  for (const key of keys) {
    const value = toNumber(metrics[key]);
    if (value !== 0) return value;
  }
  return 0;
}

function normalizeMetrics(metricsPayload: unknown) {
  const payload = readRecord(metricsPayload);
  const metrics = readRecord(payload.metrics);
  const series = readArray(payload.series);
  const totalPageViews = metricValue(
    metrics,
    "total_screen_views",
    "total_page_views",
    "pageviews"
  );
  return {
    metrics: {
      uniqueVisitors: metricValue(metrics, "unique_visitors", "visitors"),
      totalSessions: metricValue(metrics, "total_sessions", "sessions"),
      totalPageViews,
      bounceRate: metricValue(metrics, "bounce_rate", "bounceRate"),
      avgSessionDuration: metricValue(metrics, "avg_session_duration", "avgSessionDuration"),
    },
    visitorTrend: series.map((item) => {
      const record = readRecord(item);
      return {
        date: toStringValue(record.date) ?? toStringValue(record.day) ?? "",
        value: metricValue(record, "unique_visitors", "visitors", "total_sessions", "sessions"),
      };
    }),
  };
}

function normalizeTopPages(
  pagesPayload: unknown,
  project: OpenPanelProject & { projectSlug?: string; color?: string }
): TopPage[] {
  return readArray(pagesPayload).map((item) => {
    const record = readRecord(item);
    const path = toStringValue(record.path) ?? toStringValue(record.name) ?? "/";
    return {
      path,
      title: toStringValue(record.title) ?? path,
      sessions: metricValue(record, "sessions", "total_sessions", "count", "value"),
      bounceRate: metricValue(record, "bounce_rate", "bounceRate"),
      avgDuration: metricValue(record, "avg_duration", "avgDuration", "avg_session_duration"),
      openPanelUrl: `https://dashboard.openpanel.dev/${project.id}/pages`,
      projectName: project.projectSlug ? project.name : undefined,
      projectColor: project.color,
      platformName: project.name,
    };
  });
}

function normalizeReferrers(referrersPayload: unknown) {
  return readArray(referrersPayload).map((item) => {
    const record = readRecord(item);
    return {
      name: toStringValue(record.name) ?? toStringValue(record.referrer) ?? "direct",
      sessions: metricValue(record, "sessions", "total_sessions", "count", "value"),
      bounceRate: metricValue(record, "bounce_rate", "bounceRate"),
    };
  });
}

function normalizeLiveVisitors(livePayload: unknown): number {
  const live = readRecord(livePayload);
  return metricValue(live, "visitors", "liveVisitors", "count", "value");
}

async function fetchProjectAnalytics(
  project: OpenPanelProject & { projectSlug?: string; color?: string },
  credentials: OpenPanelCredentials,
  params: { range: string; timeZone: string }
) {
  const rangeParams = buildOpenPanelRangeParams(params.range, params.timeZone);
  const base = `/insights/${encodeURIComponent(project.id)}`;
  const [metricsPayload, livePayload, pagesPayload, referrersPayload] = await Promise.all([
    fetchOpenPanelJson<unknown>(`${base}/metrics`, credentials, rangeParams),
    fetchOpenPanelJson<unknown>(`${base}/live`, credentials),
    fetchOpenPanelJson<unknown>(`${base}/pages`, credentials, { ...rangeParams, limit: 20 }),
    fetchOpenPanelJson<unknown>(`${base}/referrer`, credentials, { ...rangeParams, limit: 15 }),
  ]);
  const normalizedMetrics = normalizeMetrics(metricsPayload);
  return {
    project,
    liveVisitors: normalizeLiveVisitors(livePayload),
    metrics: normalizedMetrics.metrics,
    topPages: normalizeTopPages(pagesPayload, project),
    referrers: normalizeReferrers(referrersPayload),
    visitorTrend: normalizedMetrics.visitorTrend,
  };
}

function combineAnalytics(
  results: Awaited<ReturnType<typeof fetchProjectAnalytics>>[]
): AnalyticsOverview {
  const divisor = Math.max(results.length, 1);
  const topPages = results.flatMap((result) => result.topPages);
  const referrers = results.flatMap((result) => result.referrers);
  return {
    liveVisitors: results.reduce((sum, result) => sum + result.liveVisitors, 0),
    metrics: {
      uniqueVisitors: results.reduce((sum, result) => sum + result.metrics.uniqueVisitors, 0),
      totalSessions: results.reduce((sum, result) => sum + result.metrics.totalSessions, 0),
      totalPageViews: results.reduce((sum, result) => sum + result.metrics.totalPageViews, 0),
      bounceRate: results.reduce((sum, result) => sum + result.metrics.bounceRate, 0) / divisor,
      avgSessionDuration:
        results.reduce((sum, result) => sum + result.metrics.avgSessionDuration, 0) / divisor,
    },
    topPages: topPages.toSorted((left, right) => right.sessions - left.sessions).slice(0, 20),
    referrers: referrers.toSorted((left, right) => right.sessions - left.sessions).slice(0, 15),
    visitorTrend: results[0]?.visitorTrend ?? [],
    platformBreakdown: results.map(
      (result): PlatformMetrics => ({
        platformId: result.project.id,
        platformName: result.project.name,
        projectName: result.project.projectSlug ?? result.project.name,
        projectColor: result.project.color ?? "#64748b",
        uniqueVisitors: result.metrics.uniqueVisitors,
        totalSessions: result.metrics.totalSessions,
        totalPageViews: result.metrics.totalPageViews,
        bounceRate: result.metrics.bounceRate,
        avgSessionDuration: result.metrics.avgSessionDuration,
        liveVisitors: result.liveVisitors,
      })
    ),
  };
}

function missingProjectMappingState() {
  return {
    configured: false as const,
    ctaLabel: "Open Project Settings",
    ctaTarget: "intent:openpanel-project",
    projectMappingRequired: true,
    setupMessage:
      "OpenPanel is connected, but no project is linked yet. Select an OpenPanel project in Project Settings.",
  };
}

export const openPanelDataSource: DataSourceDescriptor = {
  action: "data",
  description: "Fetches OpenPanel visitor metrics, live visitors, top pages, and referrers.",
  cacheTtlSeconds: 60,
  pollingSourceId: "analytics",
  buildCacheKey: (params) =>
    `analytics:data:${params.projectSlug ?? "all"}:${params.range}:${params.timeZone}`,
  async fetch(params, ctx) {
    const credentials = resolveOpenPanelCredential(await ctx.resolveCredential("openpanel"));
    if (!credentials) return { configured: false as const };

    const targets = await resolveOpenPanelTargets(ctx, params.projectSlug, credentials);
    if (targets.length === 0) return missingProjectMappingState();

    const results = await Promise.all(
      targets.map((target) =>
        fetchProjectAnalytics(target, credentials, {
          range: params.range,
          timeZone: params.timeZone,
        })
      )
    );

    return {
      configured: true as const,
      analytics: combineAnalytics(results),
    };
  },
};

export const openPanelProjectsDataSource: DataSourceDescriptor = {
  action: "projects",
  description: "Lists OpenPanel projects available to the configured root client.",
  cacheTtlSeconds: 3600,
  buildCacheKey: () => "openpanel:projects",
  async fetch(_params, ctx) {
    const credentials = resolveOpenPanelCredential(await ctx.resolveCredential("openpanel"));
    if (!credentials) return { configured: false as const, projects: [] };
    const projects = await listOpenPanelProjects(credentials);
    return { configured: true as const, projects };
  },
};

// biome-ignore lint/suspicious/noExplicitAny: data-source registry stores heterogeneous descriptors
export const openPanelDataSources: DataSourceDescriptor<any, any>[] = [
  openPanelDataSource,
  openPanelProjectsDataSource,
];
