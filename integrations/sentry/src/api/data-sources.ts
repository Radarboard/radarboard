import type {
  CommonRouteParams,
  DataSourceContext,
  DataSourceDescriptor,
} from "@radarboard/integration-sdk/types";
import { getStartOfTodayInTimeZone, isSameDayInTimeZone } from "@radarboard/utils/timezone";
import { sentryIssueDelta } from "../events/delta";
import type { SentryConfig } from "../types";
import { getProjectStats, getProjects, getUnresolvedIssues } from "./client";

type DbOverrides = Record<string, Record<string, Record<string, unknown>>>;

interface DataPoint {
  date: string;
  value: number;
}

interface SentryIssueItem {
  id: string;
  shortId: string;
  title: string;
  culprit: string;
  level: string;
  count: number;
  userCount: number;
  firstSeen: string;
  lastSeen: string;
  projectName: string;
  projectSlug: string;
  projectColor?: string;
  permalink: string;
  isUnhandled: boolean;
}

function normalizeSentryIssues(
  issues: Awaited<ReturnType<typeof getUnresolvedIssues>>,
  projectColor?: string
): SentryIssueItem[] {
  return issues.map((issue) => ({
    id: issue.id,
    shortId: issue.shortId,
    title: issue.title,
    culprit: issue.culprit,
    level: issue.level,
    count: Number.parseInt(issue.count, 10),
    userCount: issue.userCount,
    firstSeen: issue.firstSeen,
    lastSeen: issue.lastSeen,
    projectName: issue.project.name,
    projectSlug: issue.project.slug,
    ...(projectColor ? { projectColor } : {}),
    permalink: issue.permalink,
    isUnhandled: issue.isUnhandled,
  }));
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

async function resolveSentryProjectSlug(
  _projectSlug: string,
  _platformId: string,
  staticSlug: string | undefined,
  dbOverrides: DbOverrides
): Promise<string | null> {
  const override = dbOverrides[_projectSlug]?.[_platformId]?.["sentry.projectSlug"];
  if (typeof override === "string" && override.length > 0) return override;
  return staticSlug ?? null;
}

async function resolveConfig(ctx: DataSourceContext): Promise<SentryConfig | null> {
  const creds = await ctx.resolveCredential("sentry");
  if (creds?.authToken && creds?.orgSlug) {
    return { authToken: creds.authToken, orgSlug: creds.orgSlug };
  }
  return null;
}

function buildMissingSentryProjectSetupState() {
  return {
    configured: false as const,
    ctaLabel: "Open Project Settings",
    ctaTarget: "intent:sentry-project",
    projectMappingRequired: true,
    setupMessage:
      "Sentry is connected, but no project is linked yet. Add a Sentry project slug in Project Settings.",
  };
}

export const sentryDataSource: DataSourceDescriptor = {
  action: "data",
  description: "Fetches unresolved issues and error trends from Sentry.",
  cacheTtlSeconds: 120,
  pollingSourceId: "sentry",
  evictPrefixes: ["sentry:"],
  buildCacheKey: (params) =>
    `sentry:${params.projectSlug ?? "all"}:${params.range}:${params.timeZone}`,
  async fetch(params: CommonRouteParams, ctx: DataSourceContext) {
    const { projectSlug, range, timeZone } = params;

    const config = await resolveConfig(ctx);
    if (!config) return { configured: false as const };

    const [allProjects, dbOverrides] = await Promise.all([
      ctx.getAllProjects(),
      ctx.getProjectIntegrations().catch(() => ({}) as DbOverrides),
    ]);

    const since =
      range === "today"
        ? Math.floor(getStartOfTodayInTimeZone(timeZone).getTime() / 1000)
        : Math.floor(Date.now() / 1000) - 24 * 60 * 60;

    if (projectSlug) {
      const project = allProjects.find((p) => p.slug === projectSlug);
      const sentryPlatform = project?.platforms.find(
        (p) =>
          (p.integrations.sentry as { projectSlug?: string } | undefined)?.projectSlug ||
          dbOverrides[projectSlug]?.[p.id]?.["sentry.projectSlug"]
      );

      const sentryProjectSlug = sentryPlatform
        ? await resolveSentryProjectSlug(
            projectSlug,
            sentryPlatform.id,
            (sentryPlatform.integrations.sentry as { projectSlug?: string } | undefined)
              ?.projectSlug,
            dbOverrides
          )
        : null;

      if (!sentryProjectSlug) return buildMissingSentryProjectSetupState();

      const [issues, stats] = await Promise.all([
        getUnresolvedIssues(config, sentryProjectSlug, { limit: 20 }),
        getProjectStats(config, sentryProjectSlug, { resolution: "1h", since }),
      ]);
      const normalizedIssues = normalizeSentryIssues(issues);
      const filteredIssues =
        range === "today"
          ? normalizedIssues.filter((issue) => isSameDayInTimeZone(issue.lastSeen, timeZone))
          : normalizedIssues;

      return {
        configured: true as const,
        sentry: {
          unresolvedCount: filteredIssues.length,
          issues: filteredIssues,
          errorTrend: stats.map((point) => ({
            date: new Date(point.ts * 1000).toISOString(),
            value: point.count,
          })),
        },
      };
    }

    // All projects view
    const sentryPlatforms = (
      await Promise.all(
        allProjects.flatMap((project) =>
          project.platforms
            .filter(
              (pl) =>
                (pl.integrations.sentry as { projectSlug?: string } | undefined)?.projectSlug ||
                dbOverrides[project.slug]?.[pl.id]?.["sentry.projectSlug"]
            )
            .map(async (pl) => {
              const slug = await resolveSentryProjectSlug(
                project.slug,
                pl.id,
                (pl.integrations.sentry as { projectSlug?: string } | undefined)?.projectSlug,
                dbOverrides
              );
              return slug ? { sentryProjectSlug: slug, projectColor: project.color } : null;
            })
        )
      )
    ).filter((pl): pl is { sentryProjectSlug: string; projectColor: string } => pl !== null);

    if (sentryPlatforms.length === 0) return buildMissingSentryProjectSetupState();

    const results = await Promise.allSettled(
      sentryPlatforms.map(({ sentryProjectSlug }) =>
        Promise.all([
          getUnresolvedIssues(config, sentryProjectSlug, { limit: 25 }),
          getProjectStats(config, sentryProjectSlug, { resolution: "1h", since }),
        ])
      )
    );

    const allIssues: SentryIssueItem[] = [];
    const allTrends: DataPoint[][] = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const platform = sentryPlatforms[i];
      if (result?.status === "fulfilled" && platform) {
        const [issues, stats] = result.value;
        allIssues.push(...normalizeSentryIssues(issues, platform.projectColor));
        allTrends.push(
          stats.map((point) => ({
            date: new Date(point.ts * 1000).toISOString(),
            value: point.count,
          }))
        );
      }
    }

    const filteredIssues =
      range === "today"
        ? allIssues.filter((issue) => isSameDayInTimeZone(issue.lastSeen, timeZone))
        : allIssues;
    filteredIssues.sort((a, b) => b.count - a.count);

    return {
      configured: true as const,
      sentry: {
        unresolvedCount: filteredIssues.length,
        issues: filteredIssues.slice(0, 25),
        errorTrend: mergeTrends(allTrends),
      },
    };
  },
  delta: {
    // biome-ignore lint/suspicious/noExplicitAny: data-source descriptor requires heterogeneous type params
    extractData: (data: any) => data.sentry?.issues,
    detector: sentryIssueDelta,
    // biome-ignore lint/suspicious/noExplicitAny: data-source descriptor requires heterogeneous type params
    shouldDetect: (data: any) =>
      data.configured !== false && "sentry" in data && data.sentry?.issues,
  },
};

export const sentryProjectsDataSource: DataSourceDescriptor = {
  action: "projects",
  description: "Returns the list of projects in the authenticated Sentry organization.",
  cacheTtlSeconds: 600,
  pollingSourceId: "sentry-projects",
  buildCacheKey: () => "sentry:projects",
  async fetch(_params: CommonRouteParams, ctx: DataSourceContext) {
    const config = await resolveConfig(ctx);
    if (!config) return { configured: false, projects: [] };

    const projects = await getProjects(config);
    return { configured: true, projects };
  },
};

export const sentryDataSources: DataSourceDescriptor[] = [
  sentryDataSource,
  sentryProjectsDataSource,
];
