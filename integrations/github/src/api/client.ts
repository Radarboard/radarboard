/**
 * GitHub REST API client for the Radarboard dashboard.
 *
 * Uses the REST API v3 at https://api.github.com
 * Authenticated via personal access token (Bearer token).
 *
 * Rate limit: 5,000 requests per hour (authenticated).
 * All responses are cached server-side for 2 minutes.
 *
 * @see https://docs.github.com/en/rest
 */

import type {
  CreateIssueInput,
  CreateIssueResult,
  GitHubCommit,
  GitHubConfig,
  GitHubIssue,
  GitHubPullRequest,
  GitHubRelease,
  GitHubRepository,
  GitHubStargazer,
} from "../types";

const BASE_URL = "https://api.github.com";

// --- Cache ---

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache<T>(key: string, data: T, ttlMs = CACHE_TTL_MS): void {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

/** Evict all in-memory cache entries whose key starts with the given prefix. */
export function evictCacheByPrefix(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

// --- Error ---

export class GitHubAPIError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryable: boolean
  ) {
    super(message);
    this.name = "GitHubAPIError";
  }
}

// --- Fetcher ---

async function fetchGH<T>(
  config: GitHubConfig,
  path: string,
  cacheKey: string,
  options: { cacheTtlMs?: number; accept?: string } = {}
): Promise<T> {
  const cached = getCached<T>(cacheKey);
  if (cached) return cached;

  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {
    Accept: options.accept ?? "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (config.token) {
    headers.Authorization = `Bearer ${config.token}`;
  }
  const response = await fetch(url, { headers });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new GitHubAPIError(
      response.status,
      `GitHub API error ${response.status}: ${errorBody}`,
      response.status >= 500 || response.status === 429
    );
  }

  const data = (await response.json()) as T;
  setCache(cacheKey, data, options.cacheTtlMs ?? CACHE_TTL_MS);
  return data;
}

async function fetchGHGraphQL<T>(
  config: GitHubConfig,
  query: string,
  variables: Record<string, unknown>,
  cacheKey: string,
  cacheTtlMs = CACHE_TTL_MS
): Promise<T> {
  const cached = getCached<T>(cacheKey);
  if (cached) return cached;

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };
  if (config.token) {
    headers.Authorization = `Bearer ${config.token}`;
  }

  const response = await fetch(`${BASE_URL}/graphql`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new GitHubAPIError(
      response.status,
      `GitHub API error ${response.status}: ${errorBody}`,
      response.status >= 500 || response.status === 429
    );
  }

  const payload = (await response.json()) as { data?: T; errors?: Array<{ message: string }> };
  if (!payload.data) {
    const message =
      payload.errors?.map((error) => error.message).join("; ") ?? "Unknown GraphQL error";
    throw new GitHubAPIError(500, `GitHub GraphQL error: ${message}`, false);
  }

  setCache(cacheKey, payload.data, cacheTtlMs);
  return payload.data;
}

// --- Public API ---

/**
 * Get recently merged pull requests for a repository.
 *
 * Cache TTL: 2 minutes
 */
export async function getMergedPullRequests(
  config: GitHubConfig,
  owner: string,
  repo: string,
  limit = 20
): Promise<GitHubPullRequest[]> {
  const cacheKey = `gh:prs:${owner}/${repo}:${limit}`;
  const prs = await fetchGH<GitHubPullRequest[]>(
    config,
    `/repos/${owner}/${repo}/pulls?state=closed&sort=updated&direction=desc&per_page=${limit}`,
    cacheKey
  );
  // Only return actually merged PRs
  return prs.filter((pr) => pr.merged_at !== null);
}

/**
 * Get recent releases for a repository.
 *
 * Cache TTL: 2 minutes
 */
export async function getRecentReleases(
  config: GitHubConfig,
  owner: string,
  repo: string,
  limit = 10
): Promise<GitHubRelease[]> {
  const cacheKey = `gh:releases:${owner}/${repo}:${limit}`;
  return fetchGH<GitHubRelease[]>(
    config,
    `/repos/${owner}/${repo}/releases?per_page=${limit}`,
    cacheKey
  );
}

// In-memory TTL for open PRs/issues is intentionally shorter than the DB cache TTL (120s)
// so the in-memory cache always expires before the DB cache does. This prevents the two
// caches from refreshing each other in a 0-item cycle when GitHub was briefly unavailable.
const OPEN_ITEMS_CACHE_TTL_MS = 60_000; // 1 minute

/**
 * Get open (non-draft) pull requests for a repository.
 *
 * In-memory cache TTL: 1 minute (shorter than the 2-minute DB cache to avoid stale cycle)
 */
export async function getOpenPullRequests(
  config: GitHubConfig,
  owner: string,
  repo: string,
  limit = 30
): Promise<GitHubPullRequest[]> {
  const cacheKey = `gh:open-prs:${owner}/${repo}:${limit}`;
  const prs = await fetchGH<GitHubPullRequest[]>(
    config,
    `/repos/${owner}/${repo}/pulls?state=open&sort=updated&direction=desc&per_page=${limit}`,
    cacheKey,
    { cacheTtlMs: OPEN_ITEMS_CACHE_TTL_MS }
  );
  // Filter out draft PRs
  return prs.filter((pr) => !(pr as GitHubPullRequest & { draft?: boolean }).draft);
}

/**
 * Get open issues for a repository (excludes pull requests).
 *
 * In-memory cache TTL: 1 minute (shorter than the 2-minute DB cache to avoid stale cycle)
 */
export async function getOpenIssues(
  config: GitHubConfig,
  owner: string,
  repo: string,
  limit = 30
): Promise<GitHubIssue[]> {
  const cacheKey = `gh:open-issues:${owner}/${repo}:${limit}`;
  const issues = await fetchGH<GitHubIssue[]>(
    config,
    `/repos/${owner}/${repo}/issues?state=open&sort=updated&direction=desc&per_page=${limit}`,
    cacheKey,
    { cacheTtlMs: OPEN_ITEMS_CACHE_TTL_MS }
  );
  // The issues endpoint returns PRs too — filter them out by the presence of pull_request field
  return issues.filter((issue) => !issue.pull_request);
}

/**
 * Get recent commits on the default branch.
 *
 * Cache TTL: 2 minutes
 */
export async function getRecentCommits(
  config: GitHubConfig,
  owner: string,
  repo: string,
  limit = 20,
  path?: string
): Promise<GitHubCommit[]> {
  const pathSuffix = path ? `:${path}` : "";
  const cacheKey = `gh:commits:${owner}/${repo}${pathSuffix}:${limit}`;
  const pathParam = path ? `&path=${encodeURIComponent(path)}` : "";
  return fetchGH<GitHubCommit[]>(
    config,
    `/repos/${owner}/${repo}/commits?per_page=${limit}${pathParam}`,
    cacheKey
  );
}

/**
 * Get repository metadata used by the stars widgets and history sync.
 *
 * Cache TTL: 2 minutes
 */
export async function getRepository(
  config: GitHubConfig,
  owner: string,
  repo: string
): Promise<GitHubRepository> {
  const cacheKey = `gh:repo:${owner}/${repo}`;
  return fetchGH<GitHubRepository>(config, `/repos/${owner}/${repo}`, cacheKey);
}

/**
 * Get a page of stargazers with their star timestamps.
 *
 * Cache TTL: 2 minutes
 */
export async function getStargazersPage(
  config: GitHubConfig,
  owner: string,
  repo: string,
  page: number,
  perPage = 100
): Promise<GitHubStargazer[]> {
  const cacheKey = `gh:stargazers:${owner}/${repo}:${page}:${perPage}`;
  return fetchGH<GitHubStargazer[]>(
    config,
    `/repos/${owner}/${repo}/stargazers?page=${page}&per_page=${perPage}`,
    cacheKey,
    { accept: "application/vnd.github.star+json" }
  );
}

export async function getStargazersGraphqlPage(
  config: GitHubConfig,
  owner: string,
  repo: string,
  after: string | null = null,
  first = 100
): Promise<{
  edges: Array<{ starredAt: string }>;
  pageInfo: { endCursor: string | null; hasNextPage: boolean };
  totalCount: number;
}> {
  const cacheKey = `gh:gql-stargazers:${owner}/${repo}:${after ?? "start"}:${first}`;
  const query = `
    query RepoStargazers($owner: String!, $name: String!, $first: Int!, $after: String) {
      repository(owner: $owner, name: $name) {
        stargazers(first: $first, after: $after, orderBy: { field: STARRED_AT, direction: ASC }) {
          totalCount
          pageInfo {
            endCursor
            hasNextPage
          }
          edges {
            starredAt
          }
        }
      }
    }
  `;

  const data = await fetchGHGraphQL<{
    repository: {
      stargazers: {
        totalCount: number;
        pageInfo: { endCursor: string | null; hasNextPage: boolean };
        edges: Array<{ starredAt: string }>;
      };
    } | null;
  }>(
    config,
    query,
    {
      owner,
      name: repo,
      first,
      after,
    },
    cacheKey
  );

  if (!data.repository) {
    throw new GitHubAPIError(404, `GitHub repository not found: ${owner}/${repo}`, false);
  }

  return data.repository.stargazers;
}

/**
 * Get the last year of commit activity data.
 * Returns an array of 52 weeks, each containing an array of daily commit counts.
 *
 * Cache TTL: 2 minutes
 */
export async function getCommitActivity(
  config: GitHubConfig,
  owner: string,
  repo: string
): Promise<Array<{ days: number[]; total: number; week: number }>> {
  const cacheKey = `gh:commit-activity:${owner}/${repo}`;
  return fetchGH<Array<{ days: number[]; total: number; week: number }>>(
    config,
    `/repos/${owner}/${repo}/stats/commit_activity`,
    cacheKey
  );
}

// ---------------------------------------------------------------------------
// Paginated commit fetching
// ---------------------------------------------------------------------------

export interface CommitDailyStats {
  date: string; // YYYY-MM-DD
  count: number;
}

export interface RepoCommitResult {
  repo: string;
  visibility: "public" | "private";
  totalCommits: number;
  dailyStats: CommitDailyStats[];
}

interface RateLimitInfo {
  remaining: number;
  resetAt: number; // Unix seconds
}

function extractRateLimit(response: Response): RateLimitInfo {
  return {
    remaining: Number(response.headers.get("x-ratelimit-remaining") ?? 5000),
    resetAt: Number(response.headers.get("x-ratelimit-reset") ?? 0),
  };
}

async function rateLimitDelay(rateLimit: RateLimitInfo): Promise<void> {
  if (rateLimit.remaining < 10) {
    // Close to exhaustion — wait until reset
    const waitMs = Math.max(0, (rateLimit.resetAt - Math.floor(Date.now() / 1000)) * 1000) + 1000;
    await new Promise((resolve) => setTimeout(resolve, Math.min(waitMs, 60_000)));
  } else if (rateLimit.remaining < 100) {
    await new Promise((resolve) => setTimeout(resolve, 500));
  } else {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

async function fetchCommitsPage(
  headers: Record<string, string>,
  owner: string,
  repo: string,
  since: Date,
  page: number,
  path?: string
) {
  let url = `${BASE_URL}/repos/${owner}/${repo}/commits?per_page=100&page=${page}&since=${since.toISOString()}`;
  if (path) url += `&path=${encodeURIComponent(path)}`;
  const response = await fetch(url, { headers });

  if (!response.ok) {
    if (response.status === 409) return { empty: true };
    const errorBody = await response.text().catch(() => "");
    throw new GitHubAPIError(
      response.status,
      `GitHub API error ${response.status}: ${errorBody}`,
      response.status >= 500 || response.status === 429
    );
  }

  const commits = (await response.json()) as GitHubCommit[];
  return { commits, response };
}

/**
 * Fetch all commits for a repository since a given date using paginated REST API.
 * Returns aggregated daily stats.
 *
 * Uses rate-limit-aware delays between pages. Caps at 50 pages (5,000 commits)
 * to avoid runaway requests on very large repos.
 */
export async function fetchRepoCommits(
  config: GitHubConfig,
  owner: string,
  repo: string,
  since: Date,
  path?: string
): Promise<{ totalCommits: number; dailyStats: CommitDailyStats[] }> {
  const pathSuffix = path ? `:${path}` : "";
  const cacheKey = `gh:commits-paginated:${owner}/${repo}${pathSuffix}:${since.toISOString().split("T")[0]}`;
  const cached = getCached<{ totalCommits: number; dailyStats: CommitDailyStats[] }>(cacheKey);
  if (cached) return cached;

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (config.token) headers.Authorization = `Bearer ${config.token}`;

  const dateMap = new Map<string, number>();
  let totalCommits = 0;
  let page = 1;
  const maxPages = 50;

  while (page <= maxPages) {
    const { empty, commits, response } = await fetchCommitsPage(
      headers,
      owner,
      repo,
      since,
      page,
      path
    );
    if (empty || !commits || commits.length === 0) break;

    for (const commit of commits) {
      const dateStr = commit.commit.author.date.split("T")[0];
      if (dateStr) {
        dateMap.set(dateStr, (dateMap.get(dateStr) || 0) + 1);
        totalCommits++;
      }
    }

    if (commits.length < 100) break;

    const rateLimit = extractRateLimit(response);
    await rateLimitDelay(rateLimit);
    page++;
  }

  const dailyStats = Array.from(dateMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const result = { totalCommits, dailyStats };
  setCache(cacheKey, result, 30 * 60 * 1000);
  return result;
}

// --- Monorepo helpers ---

/**
 * Browse directory contents of a repository.
 * Used by the RepoPicker to let users select a monorepo subpath.
 *
 * Cache TTL: 5 minutes (directory structure changes infrequently)
 */
export async function getRepoContents(
  config: GitHubConfig,
  owner: string,
  repo: string,
  path?: string
): Promise<Array<{ name: string; type: "file" | "dir"; path: string }>> {
  const dirPath = path ? `/${path.split("/").map(encodeURIComponent).join("/")}` : "";
  const cacheKey = `gh:contents:${owner}/${repo}:${path ?? "root"}`;
  return fetchGH<Array<{ name: string; type: "file" | "dir"; path: string }>>(
    config,
    `/repos/${owner}/${repo}/contents${dirPath}`,
    cacheKey,
    { cacheTtlMs: 5 * 60 * 1000 }
  );
}

/**
 * Get the list of files changed in a pull request.
 * Used for client-side path filtering of PRs in monorepo setups.
 *
 * Cache TTL: 2 minutes
 */
export async function getPullRequestFiles(
  config: GitHubConfig,
  owner: string,
  repo: string,
  prNumber: number
): Promise<Array<{ filename: string }>> {
  const cacheKey = `gh:pr-files:${owner}/${repo}:${prNumber}`;
  return fetchGH<Array<{ filename: string }>>(
    config,
    `/repos/${owner}/${repo}/pulls/${prNumber}/files?per_page=100`,
    cacheKey
  );
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Create a new issue in a GitHub repository.
 */
export async function createIssue(
  config: GitHubConfig,
  input: CreateIssueInput
): Promise<CreateIssueResult> {
  const { owner, repo, title, body, labels } = input;

  const url = `${BASE_URL}/repos/${owner}/${repo}/issues`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (config.token) {
    headers.Authorization = `Bearer ${config.token}`;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ title, body: body ?? "", labels: labels ?? [] }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new GitHubAPIError(
      response.status,
      `GitHub API error ${response.status}: ${errorBody}`,
      response.status >= 500 || response.status === 429
    );
  }

  return (await response.json()) as CreateIssueResult;
}
