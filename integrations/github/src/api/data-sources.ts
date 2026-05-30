import type {
  CommonRouteParams,
  DataSourceContext,
  DataSourceDescriptor,
} from "@radarboard/integration-sdk/types";
import { isDateInTimeRange, type TimeRange as UtilsTimeRange } from "@radarboard/utils/timezone";
import { githubIssueDelta, githubPrDelta } from "../events/delta";
import type { GitHubConfig, GitHubRepository } from "../types";
import {
  fetchRepoCommits,
  getOpenIssues,
  getOpenPullRequests,
  getPullRequestFiles,
  getRepository,
} from "./client";
import { fetchGitHubStarsHistory } from "./star-history";

type SavedIntegrations = Record<string, Record<string, Record<string, unknown>>>;
type RepoRef = { owner: string; repo: string; path?: string };
type GitHubStarsParams = {
  selectedRepos?: RepoRef[];
  syncMode?: "incremental" | "full";
};

function normalizeRepoRef(owner: string, repo: string, path?: string): RepoRef | null {
  const normalizedOwner = owner.trim();
  const normalizedRepo = repo.trim();
  const normalizedPath = path?.trim().replace(/^\/+|\/+$/g, "") || undefined;

  if (normalizedOwner.length === 0 || normalizedRepo.length === 0) return null;
  if (normalizedOwner.includes("/") || normalizedRepo.includes("/")) return null;

  return {
    owner: normalizedOwner,
    repo: normalizedRepo,
    ...(normalizedPath ? { path: normalizedPath } : {}),
  };
}

function repoKey(repo: RepoRef): string {
  const base = `${repo.owner.toLowerCase()}/${repo.repo.toLowerCase()}`;
  return repo.path ? `${base}:${repo.path}` : base;
}

function dedupeRepoRefs(repos: RepoRef[]): RepoRef[] {
  const next: RepoRef[] = [];
  const seen = new Set<string>();

  for (const repo of repos) {
    const normalized = normalizeRepoRef(repo.owner, repo.repo, repo.path);
    if (!normalized) continue;

    const key = repoKey(normalized);
    if (seen.has(key)) continue;

    seen.add(key);
    next.push(normalized);
  }

  return next;
}

function dedupeRepoRefsForRepoMetrics(repos: RepoRef[]): RepoRef[] {
  const next: RepoRef[] = [];
  const seen = new Set<string>();

  for (const repo of repos) {
    const normalized = normalizeRepoRef(repo.owner, repo.repo);
    if (!normalized) continue;

    const key = `${normalized.owner.toLowerCase()}/${normalized.repo.toLowerCase()}`;
    if (seen.has(key)) continue;

    seen.add(key);
    next.push(normalized);
  }

  return next;
}

function parseRepoParam(value: string): RepoRef | null {
  const trimmed = value.trim();
  const parts = trimmed.split("/");
  if (parts.length !== 2) return null;
  const [owner, repo] = parts;
  if (!owner || !repo) return null;
  return normalizeRepoRef(owner, repo);
}

function serializeRepoRefs(repos: RepoRef[] | undefined): string {
  const normalized = dedupeRepoRefs(repos ?? []);
  if (normalized.length === 0) return "none";

  return normalized
    .slice()
    .sort((left, right) => repoKey(left).localeCompare(repoKey(right)))
    .map((repo) =>
      repo.path ? `${repo.owner}/${repo.repo}:${repo.path}` : `${repo.owner}/${repo.repo}`
    )
    .join(",");
}

function collectForProject(
  project: {
    slug: string;
    platforms: Array<{ id: string; integrations: Record<string, unknown> }>;
  },
  saved: SavedIntegrations,
  addUnique: (owner: string, repo: string, path?: string) => void
) {
  const savedProject = saved[project.slug] ?? {};

  // Project-level override
  const projectGh = (savedProject as Record<string, Record<string, unknown>>)._project
    ?.github as RepoRef | null;
  if (projectGh?.owner && projectGh?.repo)
    addUnique(projectGh.owner, projectGh.repo, projectGh.path);

  // Platform-level saved overrides
  for (const [key, platformData] of Object.entries(savedProject)) {
    if (key === "_project") continue;
    const gh = (platformData as Record<string, unknown>)?.github as RepoRef | null;
    if (gh?.owner && gh?.repo) addUnique(gh.owner, gh.repo, gh.path);
  }

  // Static config
  for (const platform of project.platforms) {
    const gh = platform.integrations.github as
      | { owner?: string; repo?: string; path?: string }
      | undefined;
    if (gh?.owner && gh?.repo) addUnique(gh.owner, gh.repo, gh.path);
  }
}

function collectGitHubRepoRefs(
  projects: Array<{
    slug: string;
    platforms: Array<{ id: string; integrations: Record<string, unknown> }>;
  }>,
  saved: SavedIntegrations
): RepoRef[] {
  const repos: RepoRef[] = [];
  const seen = new Set<string>();

  const addUnique = (owner: string, repo: string, path?: string) => {
    const normalized = normalizeRepoRef(owner, repo, path);
    if (!normalized) return;

    const key = repoKey(normalized);
    if (seen.has(key)) return;
    repos.push(normalized);
    seen.add(key);
  };

  for (const project of projects) {
    collectForProject(project, saved, addUnique);
  }

  return repos;
}

async function resolveConfig(ctx: DataSourceContext): Promise<GitHubConfig> {
  const creds = await ctx.resolveCredential("github");
  const token = creds?.token ?? creds?.accessToken;
  return { token: token ?? "" };
}

async function resolveRepos(
  ctx: DataSourceContext,
  projectSlug: string | null
): Promise<RepoRef[]> {
  const allProjects = await ctx.getAllProjects();
  const saved = await ctx.getProjectIntegrations().catch(() => ({}) as SavedIntegrations);
  const projects = projectSlug ? allProjects.filter((p) => p.slug === projectSlug) : allProjects;
  return collectGitHubRepoRefs(projects, saved);
}

async function resolveRepositoryMetadata(
  config: GitHubConfig,
  repos: RepoRef[]
): Promise<GitHubRepository[]> {
  const results = await Promise.allSettled(
    dedupeRepoRefsForRepoMetrics(repos).map(({ owner, repo }) =>
      getRepository(config, owner, repo).catch(() => null)
    )
  );

  const fulfilled = results.filter(
    (result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof getRepository>> | null> =>
      result.status === "fulfilled"
  );

  return fulfilled
    .map((result) => result.value)
    .filter((repo): repo is GitHubRepository => repo !== null);
}

// ---------------------------------------------------------------------------
// open-issues
// ---------------------------------------------------------------------------

export const githubOpenIssuesDataSource: DataSourceDescriptor = {
  action: "open-issues",
  description: "Open issues across connected GitHub repos (excludes PRs).",
  cacheTtlSeconds: 120,
  pollingSourceId: "github-activity",
  evictPrefixes: ["gh:open-issues:"],
  buildCacheKey: (params) =>
    `github-open-issues:${params.projectSlug ?? "all"}:${params.range}:${params.timeZone}`,
  async fetch(params: CommonRouteParams, ctx: DataSourceContext) {
    const { projectSlug, range, timeZone } = params;
    const creds = await ctx.resolveCredential("github");
    if (!creds?.token && !creds?.accessToken) return { configured: false, items: [] };

    const repos = await resolveRepos(ctx, projectSlug);
    if (repos.length === 0) return { configured: false, items: [] };

    const config = await resolveConfig(ctx);

    const results = await Promise.allSettled(
      repos.map(async ({ owner, repo }) => {
        const issues = await getOpenIssues(config, owner, repo);
        return issues.map((issue) => ({
          id: issue.id,
          number: issue.number,
          title: issue.title,
          htmlUrl: issue.html_url,
          user: { login: issue.user.login, avatarUrl: issue.user.avatar_url },
          labels: issue.labels,
          repo: `${owner}/${repo}`,
          createdAt: issue.created_at,
          updatedAt: issue.updated_at,
        }));
      })
    );

    const fulfilled = results.filter(
      // biome-ignore lint/suspicious/noExplicitAny: data-source descriptor requires heterogeneous type params
      (r): r is PromiseFulfilledResult<any[]> => r.status === "fulfilled"
    );

    if (fulfilled.length === 0 && repos.length > 0) {
      throw new Error("All GitHub API requests failed");
    }

    const items = fulfilled
      .flatMap((r) => r.value)
      .filter((item) => isDateInTimeRange(item.updatedAt, range as UtilsTimeRange, timeZone))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return { configured: true, items };
  },
  delta: {
    // biome-ignore lint/suspicious/noExplicitAny: data-source descriptor requires heterogeneous type params
    extractData: (data: any) => data.items ?? [],
    detector: githubIssueDelta,
    // biome-ignore lint/suspicious/noExplicitAny: data-source descriptor requires heterogeneous type params
    shouldDetect: (data: any) => data.configured !== false,
  },
};

// ---------------------------------------------------------------------------
// open-prs
// ---------------------------------------------------------------------------

export const githubOpenPrsDataSource: DataSourceDescriptor = {
  action: "open-prs",
  description: "Open (non-draft) pull requests across connected GitHub repos.",
  cacheTtlSeconds: 120,
  pollingSourceId: "github-activity",
  evictPrefixes: ["gh:open-prs:"],
  buildCacheKey: (params) =>
    `github-open-prs:${params.projectSlug ?? "all"}:${params.range}:${params.timeZone}`,
  async fetch(params: CommonRouteParams, ctx: DataSourceContext) {
    const { projectSlug, range, timeZone } = params;
    const creds = await ctx.resolveCredential("github");
    if (!creds?.token && !creds?.accessToken) return { configured: false, items: [] };

    const repos = await resolveRepos(ctx, projectSlug);
    if (repos.length === 0) return { configured: false, items: [] };

    const config = await resolveConfig(ctx);

    const results = await Promise.allSettled(
      repos.map(async ({ owner, repo, path }) => {
        const prs = await getOpenPullRequests(config, owner, repo);
        const mapped = prs.map((pr) => ({
          id: pr.id,
          number: pr.number,
          title: pr.title,
          htmlUrl: pr.html_url,
          user: { login: pr.user.login, avatarUrl: pr.user.avatar_url },
          labels: pr.labels,
          repo: `${owner}/${repo}`,
          createdAt: pr.created_at,
          updatedAt: pr.updated_at,
        }));

        // When a monorepo path is configured, filter PRs to only those touching files under that path
        if (!path) return mapped;

        const MaxPrFileChecks = 15;
        const toCheck = mapped.slice(0, MaxPrFileChecks);
        const fileResults = await Promise.allSettled(
          toCheck.map(async (pr) => {
            const files = await getPullRequestFiles(config, owner, repo, pr.number);
            const touchesPath = files.some((f) => f.filename.startsWith(path));
            return touchesPath ? pr : null;
          })
        );

        return fileResults
          .filter(
            (r): r is PromiseFulfilledResult<(typeof mapped)[number] | null> =>
              r.status === "fulfilled"
          )
          .map((r) => r.value)
          .filter((pr): pr is NonNullable<typeof pr> => pr !== null);
      })
    );

    const fulfilled = results.filter(
      // biome-ignore lint/suspicious/noExplicitAny: data-source descriptor requires heterogeneous type params
      (r): r is PromiseFulfilledResult<any[]> => r.status === "fulfilled"
    );

    if (fulfilled.length === 0 && repos.length > 0) {
      throw new Error("All GitHub API requests failed");
    }

    const items = fulfilled
      .flatMap((r) => r.value)
      .filter((item) => isDateInTimeRange(item.updatedAt, range as UtilsTimeRange, timeZone))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return { configured: true, items };
  },
  delta: {
    // biome-ignore lint/suspicious/noExplicitAny: data-source descriptor requires heterogeneous type params
    extractData: (data: any) => data.items ?? [],
    detector: githubPrDelta,
    // biome-ignore lint/suspicious/noExplicitAny: data-source descriptor requires heterogeneous type params
    shouldDetect: (data: any) => data.configured !== false,
  },
};

// ---------------------------------------------------------------------------
// stars
// ---------------------------------------------------------------------------

export const githubStarsDataSource: DataSourceDescriptor<GitHubStarsParams> = {
  action: "stars",
  description: "GitHub repository stars, forks, and activity.",
  cacheTtlSeconds: 600,
  pollingSourceId: "github-stars",
  evictPrefixes: ["gh:repo:"],
  buildCacheKey: (params) =>
    `github-stars:${params.projectSlug ?? "all"}:${serializeRepoRefs(params.selectedRepos)}`,
  parseParams: (searchParams) => ({
    selectedRepos: dedupeRepoRefs(
      searchParams
        .getAll("repo")
        .map((value) => parseRepoParam(value))
        .filter((repo): repo is RepoRef => repo !== null)
    ),
    syncMode: searchParams.get("sync") === "full" ? "full" : "incremental",
  }),
  async fetch(params: CommonRouteParams & GitHubStarsParams, ctx: DataSourceContext) {
    const creds = await ctx.resolveCredential("github");
    if (!creds?.token && !creds?.accessToken) return { configured: false };

    const repos = [
      ...(await resolveRepos(ctx, params.projectSlug)),
      ...(params.selectedRepos ?? []),
    ];
    if (repos.length === 0)
      return { configured: true, repos: [], totalStars: 0, totalForks: 0, starHistory: [] };

    const config = await resolveConfig(ctx);
    const repositories = await resolveRepositoryMetadata(config, repos);
    if (repositories.length === 0 && repos.length > 0) {
      throw new Error("All GitHub API requests failed");
    }

    const repoData = repositories
      .filter((repository) => repository.private !== true)
      .map((repository) => ({
        stars: repository.stargazers_count,
        forks: repository.forks_count,
        openIssues: repository.open_issues_count,
        watchers: repository.watchers_count,
        fullName: repository.full_name,
        description: repository.description,
        language: repository.language,
        htmlUrl: repository.html_url,
        updatedAt: repository.updated_at,
      }))
      .sort((left, right) => {
        if (right.stars !== left.stars) return right.stars - left.stars;
        return left.fullName.localeCompare(right.fullName);
      });

    return {
      repos: repoData,
      totalStars: repoData.reduce((sum, r) => sum + r.stars, 0),
      totalForks: repoData.reduce((sum, r) => sum + r.forks, 0),
      starHistory: [],
    };
  },
};

export const githubStarsHistoryDataSource: DataSourceDescriptor<GitHubStarsParams> = {
  action: "stars-history",
  description: "GitHub repository star history and daily deltas.",
  cacheTtlSeconds: 600,
  pollingSourceId: "github-stars",
  evictPrefixes: ["gh:repo:", "gh:stargazers:"],
  buildCacheKey: (params) =>
    `github-stars-history:${params.projectSlug ?? "all"}:${params.range}:${params.timeZone}:${serializeRepoRefs(params.selectedRepos)}`,
  parseParams: githubStarsDataSource.parseParams,
  async fetch(params: CommonRouteParams & GitHubStarsParams, ctx: DataSourceContext) {
    const creds = await ctx.resolveCredential("github");
    if (!creds?.token && !creds?.accessToken) return { configured: false };

    const repos = [
      ...(await resolveRepos(ctx, params.projectSlug)),
      ...(params.selectedRepos ?? []),
    ];
    if (repos.length === 0) {
      return {
        configured: true,
        aggregateDaily: [],
        repoDaily: {},
        aggregateAddedDaily: [],
        repoAddedDaily: {},
        repos: [],
        latestSyncAt: null,
      };
    }

    const config = await resolveConfig(ctx);
    const repositories = await resolveRepositoryMetadata(config, repos);
    if (repositories.length === 0 && repos.length > 0) {
      throw new Error("All GitHub API requests failed");
    }

    const publicRepos = repositories
      .filter((repository) => repository.private !== true)
      .flatMap((repository) => {
        const [owner, repo] = repository.full_name.split("/");
        return owner && repo ? [{ owner, repo }] : [];
      });

    return fetchGitHubStarsHistory(publicRepos, params.range, ctx, {
      syncMode: params.syncMode ?? "incremental",
      timeZone: params.timeZone,
    });
  },
};

interface GitHubBillingUsageItem {
  product?: string;
  sku?: string;
  netAmount?: number;
  grossAmount?: number;
}

export const githubBillingDataSource: DataSourceDescriptor = {
  action: "billing",
  description: "Fetches organization billing usage and cost breakdown from GitHub.",
  cacheTtlSeconds: 3600,
  buildCacheKey: () => "github-billing:current-month",
  async fetch(_params: CommonRouteParams, ctx: DataSourceContext) {
    const config = await resolveConfig(ctx);
    if (!config.token) return { configured: false as const, total: null, breakdown: [] };

    try {
      // Get user's orgs — pick the first one
      const orgsRes = await fetch("https://api.github.com/user/orgs", {
        headers: {
          Authorization: `Bearer ${config.token}`,
          Accept: "application/vnd.github+json",
        },
      });

      if (!orgsRes.ok) {
        return { configured: true as const, total: null, breakdown: [] };
      }

      const orgs = (await orgsRes.json()) as Array<{ login: string }>;
      if (orgs.length === 0) {
        return { configured: true as const, total: null, breakdown: [] };
      }

      const org = orgs[0]?.login;
      if (!org) return { configured: true as const, total: null, breakdown: [] };

      // Fetch billing usage
      const billingRes = await fetch(`https://api.github.com/orgs/${org}/settings/billing/usage`, {
        headers: {
          Authorization: `Bearer ${config.token}`,
          Accept: "application/vnd.github+json",
        },
      });

      if (billingRes.status === 403 || billingRes.status === 401) {
        return { configured: true as const, total: null, breakdown: [] };
      }
      if (!billingRes.ok) {
        return { configured: true as const, total: null, breakdown: [] };
      }

      const data = (await billingRes.json()) as {
        usageItems?: GitHubBillingUsageItem[];
      };

      const items = data.usageItems ?? [];

      // Aggregate by product
      const byProduct = new Map<string, number>();
      let total = 0;
      for (const item of items) {
        const amount = item.netAmount ?? item.grossAmount ?? 0;
        total += amount;
        const label = item.product ?? item.sku ?? "Other";
        byProduct.set(label, (byProduct.get(label) ?? 0) + amount);
      }

      const breakdown = Array.from(byProduct.entries())
        .map(([label, amount]) => ({ label, amount }))
        .sort((a, b) => b.amount - a.amount);

      return { configured: true as const, total, breakdown };
    } catch {
      return { configured: true as const, total: null, breakdown: [] };
    }
  },
};

export const githubCommitActivityDataSource: DataSourceDescriptor<GitHubStarsParams> = {
  action: "commit-activity",
  description: "GitHub repository commit activity over the last year.",
  cacheTtlSeconds: 3600,
  pollingSourceId: "github-activity",
  evictPrefixes: ["gh:commit-activity:", "gh:commits-paginated:"],
  buildCacheKey: (params) =>
    `github-commit-activity:${params.projectSlug ?? "all"}:${serializeRepoRefs(params.selectedRepos)}`,
  parseParams: githubStarsDataSource.parseParams,
  async fetch(params: CommonRouteParams & GitHubStarsParams, ctx: DataSourceContext) {
    const creds = await ctx.resolveCredential("github");
    if (!creds?.token && !creds?.accessToken) return { configured: false };

    const repos = dedupeRepoRefs([
      ...(await resolveRepos(ctx, params.projectSlug)),
      ...(params.selectedRepos ?? []),
    ]);
    if (repos.length === 0) return { configured: true, repos: [] };

    const config = await resolveConfig(ctx);
    const since = new Date();
    since.setFullYear(since.getFullYear() - 1);

    const results = await Promise.allSettled(
      repos.map(async ({ owner, repo, path }) => {
        const [commitResult, repoMeta] = await Promise.all([
          fetchRepoCommits(config, owner, repo, since, path).catch(() => ({
            totalCommits: 0,
            dailyStats: [],
          })),
          getRepository(config, owner, repo).catch(() => null),
        ]);
        return {
          repo: path ? `${owner}/${repo}:${path}` : `${owner}/${repo}`,
          totalCommits: commitResult.totalCommits,
          dailyStats: commitResult.dailyStats,
          visibility: repoMeta?.private ? ("private" as const) : ("public" as const),
        };
      })
    );

    const fulfilled = results.filter(
      (
        r
      ): r is PromiseFulfilledResult<{
        repo: string;
        totalCommits: number;
        dailyStats: Array<{ date: string; count: number }>;
        visibility: "public" | "private";
      }> => r.status === "fulfilled"
    );

    if (fulfilled.length === 0 && repos.length > 0) {
      throw new Error("All GitHub API requests failed");
    }

    return {
      repos: fulfilled.map((r) => r.value),
    };
  },
};

export const githubDataSources: DataSourceDescriptor[] = [
  githubOpenIssuesDataSource,
  githubOpenPrsDataSource,
  githubStarsDataSource,
  githubStarsHistoryDataSource,
  githubBillingDataSource,
  githubCommitActivityDataSource,
];
