import type {
  CommonRouteParams,
  DataSourceContext,
  DataSourceDescriptor,
} from "@radarboard/integration-sdk/types";
import { getTimeRangeWindow, type TimeRange as UtilsTimeRange } from "@radarboard/utils/timezone";
import type { OpenPanelConfig, TopPage } from "../types";
import {
  getCampaignData,
  getDetailedPages,
  getDeviceBreakdown,
  getLiveVisitors,
  getManagedProject,
  getMetrics,
  getReferrers,
  getTopPages,
  listManagedProjects,
} from "./client";

type _DbOverrides = Record<string, Record<string, Record<string, unknown>>>;

function cleanPagePath(raw: string): string {
  try {
    const decoded = decodeURIComponent(raw);
    return decoded.split(/[?#]/)[0] ?? decoded;
  } catch {
    return raw.split(/[?#]/)[0] ?? raw;
  }
}

function buildOpenPanelPagesUrl(organizationId: string, projectId: string): string {
  return `https://dashboard.openpanel.dev/${organizationId}/${projectId}/pages`;
}

async function resolveConfig(
  ctx: DataSourceContext,
  projectId: string
): Promise<OpenPanelConfig | null> {
  const creds = await ctx.resolveCredential("openpanel");
  if (creds?.clientId && creds?.clientSecret) {
    return { clientId: creds.clientId, clientSecret: creds.clientSecret, projectId };
  }
  return null;
}

async function resolveManageCredentials(
  ctx: DataSourceContext
): Promise<{ clientId: string; clientSecret: string } | null> {
  const creds = await ctx.resolveCredential("openpanel");
  if (creds?.clientId && creds?.clientSecret) {
    return { clientId: creds.clientId, clientSecret: creds.clientSecret };
  }
  return null;
}

function collectLinkedOpenPanelProjectIds(
  allProjects: Array<{
    slug: string;
    platforms: Array<{ id: string; integrations: Record<string, unknown> }>;
  }>,
  savedIntegrations: _DbOverrides,
  projectSlug: string | null
): string[] {
  const ids = new Set<string>();

  for (const project of allProjects) {
    if (projectSlug && project.slug !== projectSlug) continue;

    const projectOverrides = savedIntegrations[project.slug] ?? {};

    for (const platform of project.platforms) {
      const overrideId = projectOverrides[platform.id]?.["openPanel.projectId"];
      const staticId = (platform.integrations.openPanel as { projectId?: string } | undefined)
        ?.projectId;

      const projectId =
        typeof overrideId === "string" && overrideId.trim().length > 0
          ? overrideId.trim()
          : typeof staticId === "string" && staticId.trim().length > 0
            ? staticId.trim()
            : null;

      if (projectId) ids.add(projectId);
    }
  }

  return Array.from(ids);
}

export const openpanelDataSource: DataSourceDescriptor = {
  action: "data",
  description: "Returns analytics data from OpenPanel (visitors, sessions, pages, referrers).",
  cacheTtlSeconds: 60,
  pollingSourceId: "analytics",
  buildCacheKey: (params) =>
    `analytics:${params.projectSlug ?? "all"}:${params.range}:${params.timeZone}`,
  async fetch(params: CommonRouteParams, ctx: DataSourceContext) {
    const { projectSlug, range, timeZone } = params;
    const { startDate, endDate } = getTimeRangeWindow(range as UtilsTimeRange, timeZone);
    const analyticsRange = range === "today" ? { range: "today" } : { startDate, endDate };

    const allProjects = await ctx.getAllProjects();
    const savedIntegrations = await ctx.getProjectIntegrations().catch(() => ({}) as _DbOverrides);

    const opPlatforms = allProjects
      .filter((p) => !projectSlug || p.slug === projectSlug)
      .flatMap((p) =>
        p.platforms.flatMap((pl) => {
          const overrideId = savedIntegrations[p.slug]?.[pl.id]?.["openPanel.projectId"];
          const staticId = (pl.integrations.openPanel as { projectId?: string } | undefined)
            ?.projectId;
          const resolvedProjectId =
            typeof overrideId === "string" && overrideId.trim().length > 0
              ? overrideId.trim()
              : typeof staticId === "string" && staticId.trim().length > 0
                ? staticId.trim()
                : null;

          if (!resolvedProjectId) return [];

          return [
            {
              platformId: pl.id,
              platformName: pl.name,
              projectName: p.name,
              projectColor: p.color,
              openPanel: { projectId: resolvedProjectId },
            },
          ];
        })
      );

    const isAllView = !projectSlug;

    if (opPlatforms.length === 0) {
      const creds = await ctx.resolveCredential("openpanel");
      if (creds?.clientId && creds?.clientSecret) {
        return {
          configured: false as const,
          ctaLabel: "Open Project Settings",
          ctaTarget: "intent:openpanel-project",
          projectMappingRequired: true as const,
          setupMessage:
            "OpenPanel is connected, but no project is linked yet. Select an OpenPanel project in Project Settings.",
        };
      }
      return { configured: false as const };
    }

    const results = await Promise.allSettled(
      opPlatforms.map(async (pl) => {
        const config = await resolveConfig(ctx, pl.openPanel.projectId);
        if (!config) return null;

        const [metrics, live, pages, referrers, managedProject] = await Promise.all([
          getMetrics(config, analyticsRange),
          getLiveVisitors(config),
          getTopPages(config, analyticsRange, 10),
          getReferrers(config, analyticsRange, 10),
          getManagedProject(config).catch(() => null),
        ]);

        return {
          platformId: pl.platformId,
          platformName: pl.platformName,
          openPanelUrl: managedProject
            ? buildOpenPanelPagesUrl(managedProject.organizationId, config.projectId)
            : null,
          liveVisitors: live.visitors,
          metrics: metrics.metrics,
          series: metrics.series,
          topPages: pages,
          referrers,
        };
      })
    );

    interface PlatformResult {
      platformId: string;
      platformName: string;
      openPanelUrl: string | null;
      liveVisitors: number;
      metrics: {
        unique_visitors: number;
        total_sessions: number;
        total_screen_views: number;
        bounce_rate: number;
        avg_session_duration: number;
      };
      series: { date: string; unique_visitors: number }[];
      topPages: {
        path: string;
        title: string;
        sessions: number;
        bounce_rate: number;
        avg_duration: number;
        openPanelUrl?: string | null;
      }[];
      referrers: { name: string; sessions: number; bounce_rate: number }[];
    }

    const successful: PlatformResult[] = [];
    for (const r of results) {
      if (r.status === "fulfilled" && r.value != null) {
        successful.push(r.value as PlatformResult);
      }
    }

    const errors = results
      .filter((r): r is PromiseRejectedResult => r.status === "rejected")
      .map((r) => String(r.reason));

    if (successful.length === 0) {
      return { configured: false as const, errors };
    }

    const totalLive = successful.reduce((sum, s) => sum + s.liveVisitors, 0);
    const totalVisitors = successful.reduce((sum, s) => sum + s.metrics.unique_visitors, 0);
    const totalSessions = successful.reduce((sum, s) => sum + s.metrics.total_sessions, 0);
    const totalPageViews = successful.reduce((sum, s) => sum + s.metrics.total_screen_views, 0);
    const avgBounce =
      successful.reduce((sum, s) => sum + s.metrics.bounce_rate, 0) / successful.length;
    const avgDuration =
      successful.reduce((sum, s) => sum + s.metrics.avg_session_duration, 0) / successful.length;

    const allPages = successful.flatMap((s) => {
      const platform = opPlatforms.find((pl) => pl.platformId === s.platformId);
      return s.topPages.map((p) => ({
        path: cleanPagePath(p.path),
        title: p.title || cleanPagePath(p.path),
        sessions: p.sessions,
        bounceRate: p.bounce_rate ?? 0,
        avgDuration: p.avg_duration ?? 0,
        ...(s.openPanelUrl ? { openPanelUrl: s.openPanelUrl } : {}),
        ...(isAllView && platform
          ? {
              projectName: platform.projectName,
              projectColor: platform.projectColor,
              platformName: platform.platformName,
            }
          : {}),
      }));
    });

    const allReferrers = successful.flatMap((s) =>
      s.referrers.map((r) => ({
        name: r.name,
        sessions: r.sessions,
        bounceRate: r.bounce_rate,
      }))
    );

    const visitorTrend = (successful[0]?.series ?? []).map((s) => ({
      date: s.date.split("T")[0] ?? "",
      value: s.unique_visitors,
    }));

    const platformBreakdown = isAllView
      ? successful.map((s) => {
          const platform = opPlatforms.find((pl) => pl.platformId === s.platformId);
          return {
            platformId: s.platformId,
            platformName: platform?.platformName ?? s.platformName,
            projectName: platform?.projectName ?? "",
            projectColor: platform?.projectColor ?? "#888",
            uniqueVisitors: s.metrics.unique_visitors,
            totalSessions: s.metrics.total_sessions,
            totalPageViews: s.metrics.total_screen_views,
            bounceRate: Math.round(s.metrics.bounce_rate * 10) / 10,
            avgSessionDuration: Math.round(s.metrics.avg_session_duration),
            liveVisitors: s.liveVisitors,
          };
        })
      : undefined;

    const analytics = {
      liveVisitors: totalLive,
      metrics: {
        uniqueVisitors: totalVisitors,
        totalSessions: totalSessions,
        totalPageViews: totalPageViews,
        bounceRate: Math.round(avgBounce * 10) / 10,
        avgSessionDuration: Math.round(avgDuration),
      },
      topPages: allPages.sort((a, b) => b.sessions - a.sessions).slice(0, 10),
      referrers: allReferrers.sort((a, b) => b.sessions - a.sessions).slice(0, 10),
      visitorTrend,
      ...(platformBreakdown ? { platformBreakdown } : {}),
    };

    return {
      configured: true as const,
      analytics,
      platforms: successful.map((s) => ({
        id: s.platformId,
        name: s.platformName,
        liveVisitors: s.liveVisitors,
      })),
    };
  },
};

export const openpanelProjectsDataSource: DataSourceDescriptor = {
  action: "projects",
  description: "Returns the list of available OpenPanel projects for the authenticated account.",
  cacheTtlSeconds: 600,
  buildCacheKey: () => "openpanel:projects",
  async fetch(_params: CommonRouteParams, ctx: DataSourceContext) {
    const creds = await resolveManageCredentials(ctx);
    if (!creds) return { configured: false, projects: [] };

    try {
      const projects = await listManagedProjects(creds.clientId, creds.clientSecret);
      return { configured: true, projects };
    } catch {
      return { configured: false, projects: [] };
    }
  },
};

// ---------------------------------------------------------------------------
// New data sources (Round 8 — Analytics Intelligence)
// ---------------------------------------------------------------------------

/**
 * Resolve the first OpenPanel config from connected platforms.
 * Follows the same platform discovery pattern as the main data source.
 */
async function _resolveFirstPlatformConfig(
  ctx: DataSourceContext,
  projectSlug: string | null
): Promise<OpenPanelConfig | null> {
  const allProjects = await ctx.getAllProjects();
  const savedIntegrations = await ctx.getProjectIntegrations().catch(() => ({}) as _DbOverrides);
  const projectIds = collectLinkedOpenPanelProjectIds(allProjects, savedIntegrations, projectSlug);
  if (projectIds.length === 0) return null;
  return resolveConfig(ctx, projectIds[0]!);
}

export const openpanelPagesDataSource: DataSourceDescriptor = {
  action: "pages",
  description:
    "Detailed page analytics with engagement metrics (bounce rate, avg duration) from OpenPanel.",
  cacheTtlSeconds: 300,
  async fetch(params: CommonRouteParams, ctx: DataSourceContext) {
    const { projectSlug, range, timeZone } = params;
    const { startDate, endDate } = getTimeRangeWindow(range as UtilsTimeRange, timeZone);
    const analyticsRange = range === "today" ? { range: "today" } : { startDate, endDate };

    // Use the same platform discovery as the main data source
    const allProjects = await ctx.getAllProjects();
    const savedIntegrations = await ctx.getProjectIntegrations().catch(() => ({}) as _DbOverrides);
    const opPlatforms = collectLinkedOpenPanelProjectIds(
      allProjects,
      savedIntegrations,
      projectSlug
    );

    if (opPlatforms.length === 0) return { configured: false };

    // Fetch pages from all platforms and merge
    const allPages: TopPage[] = [];
    for (const opProjectId of opPlatforms) {
      const config = await resolveConfig(ctx, opProjectId);
      if (!config) continue;
      try {
        const pages = await getDetailedPages(
          config,
          analyticsRange as { startDate?: string; endDate?: string },
          50
        );
        allPages.push(...pages);
      } catch {
        /* skip failing platforms */
      }
    }

    // Sort by sessions descending, dedupe by path
    const seen = new Set<string>();
    const deduped = allPages
      .sort((a, b) => b.sessions - a.sessions)
      .filter((p) => {
        const key = p.path;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

    return { pages: deduped };
  },
};

export const openpanelCampaignsDataSource: DataSourceDescriptor = {
  action: "campaigns",
  description: "UTM campaign performance (sources, campaigns, search terms) from OpenPanel.",
  cacheTtlSeconds: 300,
  async fetch(params: CommonRouteParams, ctx: DataSourceContext) {
    const { projectSlug, range, timeZone } = params;
    const { startDate, endDate } = getTimeRangeWindow(range as UtilsTimeRange, timeZone);
    const analyticsRange = range === "today" ? { range: "today" } : { startDate, endDate };
    const allProjects = await ctx.getAllProjects();
    const savedIntegrations = await ctx.getProjectIntegrations().catch(() => ({}) as _DbOverrides);
    const opProjectId = collectLinkedOpenPanelProjectIds(
      allProjects,
      savedIntegrations,
      projectSlug
    )[0];
    if (!opProjectId) return { configured: false };
    const config = await resolveConfig(ctx, opProjectId);
    if (!config) return { configured: false };
    return getCampaignData(config, analyticsRange as { startDate?: string; endDate?: string });
  },
};

export const openpanelBreakdownDataSource: DataSourceDescriptor = {
  action: "breakdown",
  description: "Audience breakdown by country, device, and browser from OpenPanel.",
  cacheTtlSeconds: 300,
  async fetch(params: CommonRouteParams, ctx: DataSourceContext) {
    const { projectSlug, range, timeZone } = params;
    const { startDate, endDate } = getTimeRangeWindow(range as UtilsTimeRange, timeZone);
    const analyticsRange = range === "today" ? { range: "today" } : { startDate, endDate };
    const allProjects = await ctx.getAllProjects();
    const savedIntegrations = await ctx.getProjectIntegrations().catch(() => ({}) as _DbOverrides);
    const opProjectId = collectLinkedOpenPanelProjectIds(
      allProjects,
      savedIntegrations,
      projectSlug
    )[0];
    if (!opProjectId) return { configured: false };
    const config = await resolveConfig(ctx, opProjectId);
    if (!config) return { configured: false };
    return getDeviceBreakdown(config, analyticsRange as { startDate?: string; endDate?: string });
  },
};

export const openpanelDataSources: DataSourceDescriptor[] = [
  openpanelDataSource,
  openpanelProjectsDataSource,
  openpanelPagesDataSource,
  openpanelCampaignsDataSource,
  openpanelBreakdownDataSource,
];
