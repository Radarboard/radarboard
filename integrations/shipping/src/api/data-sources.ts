/**
 * Shipping data source — composite integration that aggregates
 * merged PRs (GitHub), completed issues (Linear), and production deploys (Vercel).
 *
 * This is a "virtual" integration with no registry descriptor of its own.
 * It lives here as a data-source so the unified route can serve it.
 */

import { getMergedPullRequests } from "@radarboard/integration-github/client";
import type { GitHubConfig } from "@radarboard/integration-github/types";
import { getRecentlyCompletedIssues } from "@radarboard/integration-linear/client";
import type { LinearConfig } from "@radarboard/integration-linear/types";
import type { DataSourceDescriptor } from "@radarboard/integration-sdk/types";
import { getRecentDeployments } from "@radarboard/integration-vercel/client";
import type { VercelConfig } from "@radarboard/integration-vercel/types";
import { isSameDayInTimeZone } from "@radarboard/utils/timezone";

type DbOverrides = Record<string, Record<string, Record<string, unknown>>>;

interface ShippingItem {
  id: string;
  title: string;
  projectName: string;
  projectColor: string;
  source: string;
  url: string;
  createdAt: string;
  timeAgo: string;
}

interface ShippingParams {
  limit: number;
}

function resolveOverrideString(
  overrides: DbOverrides,
  projectSlug: string,
  platformId: string,
  key: string
): string | null {
  const val = overrides[projectSlug]?.[platformId]?.[key];
  return typeof val === "string" && val ? val : null;
}

function formatTimeAgo(dateStr: string | number): string {
  const dateMs = typeof dateStr === "number" ? dateStr : new Date(dateStr).getTime();
  const seconds = Math.floor((Date.now() - dateMs) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

type ProjectLike = {
  slug: string;
  name: string;
  color: string;
  platforms: Array<{ id: string; integrations: Record<string, unknown> }>;
};

type RepoRef = { owner: string; repo: string };

function getRepoRefsForProject(project: ProjectLike, savedProject: DbOverrides[string]): RepoRef[] {
  const projectGh = savedProject._project?.github as RepoRef | undefined;
  if (projectGh?.owner && projectGh?.repo)
    return [{ owner: projectGh.owner, repo: projectGh.repo }];

  const refs: RepoRef[] = [];
  for (const platform of project.platforms) {
    const gh = savedProject[platform.id]?.github as RepoRef | undefined;
    if (gh?.owner && gh?.repo) refs.push({ owner: gh.owner, repo: gh.repo });
  }
  for (const platform of project.platforms) {
    const gh = platform.integrations.github as { owner?: string; repo?: string } | undefined;
    if (gh?.owner && gh?.repo) refs.push({ owner: gh.owner, repo: gh.repo });
  }
  return refs;
}

function collectGitHubProjectRefs(
  projects: ProjectLike[],
  dbOverrides: DbOverrides
): Array<{ project: ProjectLike; owner: string; repo: string }> {
  const seen = new Set<string>();
  const result: Array<{ project: ProjectLike; owner: string; repo: string }> = [];
  for (const project of projects) {
    const savedProject = dbOverrides[project.slug] ?? {};
    for (const { owner, repo } of getRepoRefsForProject(project, savedProject)) {
      const key = `${project.slug}:${owner}/${repo}`;
      if (!seen.has(key)) {
        result.push({ project, owner, repo });
        seen.add(key);
      }
    }
  }
  return result;
}

function collectFulfilled(results: PromiseSettledResult<ShippingItem[]>[]): ShippingItem[] {
  const items: ShippingItem[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") items.push(...result.value);
  }
  return items;
}

async function fetchGitHubItems(
  config: GitHubConfig,
  projects: ProjectLike[],
  dbOverrides: DbOverrides,
  limit: number
): Promise<ShippingItem[]> {
  const refs = collectGitHubProjectRefs(projects, dbOverrides);
  const results = await Promise.allSettled(
    refs.map(({ project, owner, repo }) =>
      getMergedPullRequests(config, owner, repo, limit).then((prs) =>
        prs.map(
          (pr): ShippingItem => ({
            id: `gh-pr-${pr.id}`,
            title: pr.title,
            projectName: project.name,
            projectColor: project.color,
            source: "github",
            url: pr.html_url,
            createdAt: pr.merged_at ?? pr.updated_at,
            timeAgo: formatTimeAgo(pr.merged_at ?? pr.updated_at),
          })
        )
      )
    )
  );
  return collectFulfilled(results);
}

async function fetchLinearItems(
  config: LinearConfig,
  projects: ProjectLike[],
  dbOverrides: DbOverrides,
  limit: number
): Promise<ShippingItem[]> {
  const platforms = projects.flatMap((p) =>
    p.platforms.flatMap((pl) => {
      const teamId =
        resolveOverrideString(dbOverrides, p.slug, pl.id, "linear.teamId") ??
        (pl.integrations.linear as { teamId?: string } | undefined)?.teamId ??
        null;
      if (!teamId) return [];
      return [{ project: p, teamId }];
    })
  );
  const results = await Promise.allSettled(
    platforms.map(({ project, teamId }) =>
      getRecentlyCompletedIssues(config, { teamId, limit }).then((issues) =>
        issues.map(
          (issue): ShippingItem => ({
            id: `linear-${issue.id}`,
            title: `${issue.identifier} ${issue.title}`,
            projectName: project.name,
            projectColor: project.color,
            source: "linear",
            url: issue.url,
            createdAt: issue.completedAt ?? issue.updatedAt,
            timeAgo: formatTimeAgo(issue.completedAt ?? issue.updatedAt),
          })
        )
      )
    )
  );
  return collectFulfilled(results);
}

async function fetchVercelItems(
  config: VercelConfig,
  projects: ProjectLike[],
  dbOverrides: DbOverrides,
  limit: number
): Promise<ShippingItem[]> {
  const platforms = projects.flatMap((p) =>
    p.platforms.flatMap((pl) => {
      const projectId =
        resolveOverrideString(dbOverrides, p.slug, pl.id, "vercel.projectId") ??
        (pl.integrations.vercel as { projectId?: string } | undefined)?.projectId ??
        null;
      if (!projectId) return [];
      return [{ project: p, projectId }];
    })
  );
  const results = await Promise.allSettled(
    platforms.map(({ project, projectId }) =>
      getRecentDeployments(config, {
        projectId,
        target: "production",
        limit,
      }).then((deploys) =>
        deploys
          .filter((d) => d.readyState === "READY")
          .map(
            (deploy): ShippingItem => ({
              id: `vercel-${deploy.uid}`,
              title: deploy.meta?.githubCommitMessage ?? `Deploy ${deploy.url}`,
              projectName: project.name,
              projectColor: project.color,
              source: "vercel",
              url: deploy.inspectorUrl,
              createdAt: new Date(deploy.ready).toISOString(),
              timeAgo: formatTimeAgo(deploy.ready),
            })
          )
      )
    )
  );
  return collectFulfilled(results);
}

export const shippingDataSource: DataSourceDescriptor<ShippingParams> = {
  action: "data",
  description:
    "Aggregates recently shipped items from GitHub (merged PRs), Linear (completed issues), and Vercel (production deploys).",
  cacheTtlSeconds: 120,
  pollingSourceId: "shipping",
  parseParams: (sp) => ({ limit: Number(sp.get("limit") ?? "20") }),
  buildCacheKey: (params) =>
    `shipping:${params.projectSlug ?? "all"}:${params.range}:${params.timeZone}`,
  async fetch(params, ctx) {
    const { projectSlug, limit, range, timeZone } = params;

    const [allProjects, dbOverrides] = await Promise.all([
      ctx.getAllProjects(),
      ctx.getProjectIntegrations().catch(() => ({}) as DbOverrides),
    ]);

    const projects = projectSlug ? allProjects.filter((p) => p.slug === projectSlug) : allProjects;

    const ghCreds = await ctx.resolveCredential("github");
    const ghToken = ghCreds?.token ?? ghCreds?.accessToken;
    const ghConfig: GitHubConfig | null = ghToken ? { token: ghToken } : null;

    const linearCreds = await ctx.resolveCredential("linear");
    const linearConfig: LinearConfig | null = linearCreds?.apiKey
      ? { apiKey: linearCreds.apiKey }
      : null;

    const vercelCreds = await ctx.resolveCredential("vercel");
    const vercelConfig: VercelConfig | null = vercelCreds?.token
      ? { token: vercelCreds.token, teamId: vercelCreds.teamId || undefined }
      : null;

    const fetches = await Promise.all([
      ghConfig ? fetchGitHubItems(ghConfig, projects, dbOverrides, limit) : [],
      linearConfig ? fetchLinearItems(linearConfig, projects, dbOverrides, limit) : [],
      vercelConfig ? fetchVercelItems(vercelConfig, projects, dbOverrides, limit) : [],
    ]);

    const items = fetches.flat();
    const filteredItems =
      range === "today"
        ? items.filter((item) => isSameDayInTimeZone(item.createdAt, timeZone))
        : items;
    filteredItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return {
      configured: !!(ghConfig || linearConfig || vercelConfig),
      items: filteredItems.slice(0, limit),
    };
  },
};

// biome-ignore lint/suspicious/noExplicitAny: data-source descriptor requires heterogeneous type params
export const shippingDataSources: DataSourceDescriptor<any, any>[] = [shippingDataSource];
