/**
 * Umami — Data Sources
 *
 * The main "data" source normalizes Umami responses to the shared
 * AnalyticsOverview shape so cross-analysis tools work with either
 * OpenPanel or Umami without code changes.
 */

import type { DataSourceDescriptor } from "@radarboard/integration-sdk/types";
import type { AnalyticsOverview, ReferrerData, TopPage } from "@radarboard/types/analytics";
import type { DataPoint } from "@radarboard/types/dashboard";
import type { UmamiConfig, UmamiMetric, UmamiPageviewsTimeSeries, UmamiStats } from "../types";
import { getActiveVisitors, getMetrics, getPageviews, getStats } from "./client";

async function resolveConfig(ctx: {
  resolveCredential(key: string): Promise<Record<string, string> | null>;
}): Promise<UmamiConfig | null> {
  const creds = await ctx.resolveCredential("umami");
  if (!creds?.apiKey || !creds?.baseUrl || !creds?.websiteId) return null;
  return { apiKey: creds.apiKey, baseUrl: creds.baseUrl, websiteId: creds.websiteId };
}

/**
 * Transform Umami raw responses into the shared AnalyticsOverview shape.
 */
function normalizeToAnalyticsOverview(
  stats: UmamiStats,
  activeVisitors: number,
  pageviews: UmamiPageviewsTimeSeries,
  urlMetrics: UmamiMetric[],
  referrerMetrics: UmamiMetric[]
): AnalyticsOverview {
  const totalPageViews = stats.pageviews.value;
  const totalSessions = stats.visits.value;
  const uniqueVisitors = stats.visitors.value;
  const bounces = stats.bounces.value;
  const bounceRate = totalSessions > 0 ? Math.round((bounces / totalSessions) * 1000) / 10 : 0;
  const avgSessionDuration =
    uniqueVisitors > 0 ? Math.round(stats.totaltime.value / uniqueVisitors) : 0;

  const topPages: TopPage[] = urlMetrics.slice(0, 50).map((m) => ({
    path: m.x,
    title: m.x,
    sessions: m.y,
    bounceRate: 0,
    avgDuration: 0,
  }));

  const referrers: ReferrerData[] = referrerMetrics.slice(0, 10).map((m) => ({
    name: m.x || "Direct",
    sessions: m.y,
    bounceRate: 0,
  }));

  const visitorTrend: DataPoint[] = (pageviews.sessions ?? []).map((s) => ({
    date: s.x.split("T")[0] ?? s.x,
    value: s.y,
  }));

  return {
    liveVisitors: activeVisitors,
    metrics: {
      uniqueVisitors,
      totalSessions,
      totalPageViews,
      bounceRate,
      avgSessionDuration,
    },
    topPages,
    referrers,
    visitorTrend,
  };
}

export const umamiDataSource: DataSourceDescriptor = {
  action: "data",
  description:
    "Overview stats normalized to AnalyticsOverview (visitors, sessions, pages, referrers, trend) from Umami.",
  cacheTtlSeconds: 60,
  async fetch(_params, ctx) {
    const config = await resolveConfig(ctx);
    if (!config) return { configured: false };

    const [stats, active, pageviews, urlMetrics, referrerMetrics] = await Promise.all([
      getStats(config),
      getActiveVisitors(config),
      getPageviews(config),
      getMetrics(config, "url"),
      getMetrics(config, "referrer"),
    ]);

    const analytics = normalizeToAnalyticsOverview(
      stats,
      active.visitors,
      pageviews,
      urlMetrics,
      referrerMetrics
    );

    return {
      configured: true,
      analytics,
      platforms: [{ id: config.websiteId, name: "Umami", liveVisitors: active.visitors }],
    };
  },
};

export const umamiPagesDataSource: DataSourceDescriptor = {
  action: "pages",
  description: "Top URLs with view counts from Umami, normalized to TopPage shape.",
  cacheTtlSeconds: 60,
  async fetch(_params, ctx) {
    const config = await resolveConfig(ctx);
    if (!config) return { configured: false };
    const metrics = await getMetrics(config, "url");
    const pages: TopPage[] = metrics.map((m) => ({
      path: m.x,
      title: m.x,
      sessions: m.y,
      bounceRate: 0,
      avgDuration: 0,
    }));
    return { pages };
  },
};

export const umamiBreakdownDataSource: DataSourceDescriptor = {
  action: "breakdown",
  description: "Audience breakdown by country, device, and browser from Umami.",
  cacheTtlSeconds: 60,
  async fetch(_params, ctx) {
    const config = await resolveConfig(ctx);
    if (!config) return { configured: false };

    const [countries, devices, browsers] = await Promise.all([
      getMetrics(config, "country"),
      getMetrics(config, "device"),
      getMetrics(config, "browser"),
    ]);

    return { countries, devices, browsers };
  },
};

export const umamiDataSources = [umamiDataSource, umamiPagesDataSource, umamiBreakdownDataSource];
