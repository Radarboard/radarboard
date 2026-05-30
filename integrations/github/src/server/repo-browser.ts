import type { GitHubConfig } from "../types";

export interface GitHubRepoBrowserItem {
  owner: string;
  repo: string;
  fullName: string;
  description: string | null;
  stars: number;
  language: string | null;
  isPrivate: boolean;
  isFork: boolean;
}

export interface GitHubRepoDirectory {
  name: string;
  path: string;
}

interface GitHubApiRepo {
  full_name: string;
  name: string;
  owner: { login: string };
  description: string | null;
  stargazers_count: number;
  language: string | null;
  private: boolean;
  fork: boolean;
}

interface GitHubContentEntry {
  name: string;
  path: string;
  type: "file" | "dir" | "symlink" | "submodule";
}

function buildGitHubHeaders(token: string | undefined): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "radarboard",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

const GITHUB_REPOS_PAGE_SIZE = 100;
const GITHUB_REPOS_SEARCH_MAX_PAGES = 10;

function buildUserReposUrl(page = 1): string {
  const params = new URLSearchParams({
    per_page: String(GITHUB_REPOS_PAGE_SIZE),
    sort: "pushed",
    direction: "desc",
    type: "all",
    page: String(page),
  });
  return `https://api.github.com/user/repos?${params.toString()}`;
}

function mapRepos(items: GitHubApiRepo[]): GitHubRepoBrowserItem[] {
  return items
    .filter((repo) => !repo.fork)
    .map((repo) => ({
      owner: repo.owner.login,
      repo: repo.name,
      fullName: repo.full_name,
      description: repo.description,
      stars: repo.stargazers_count,
      language: repo.language,
      isPrivate: repo.private,
      isFork: repo.fork,
    }));
}

function filterReposByQuery(items: GitHubApiRepo[], query: string): GitHubApiRepo[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return items;

  return items.filter((repo) => {
    const haystack = [repo.name, repo.full_name, repo.description ?? ""].join(" ").toLowerCase();
    return haystack.includes(normalizedQuery);
  });
}

async function fetchAccessibleGitHubRepos(
  token: string,
  query: string | null
): Promise<GitHubApiRepo[]> {
  const headers = buildGitHubHeaders(token);
  const isSearch = Boolean(query && query.trim().length > 0);
  const repos: GitHubApiRepo[] = [];

  const maxPages = isSearch ? GITHUB_REPOS_SEARCH_MAX_PAGES : 1;
  for (let page = 1; page <= maxPages; page += 1) {
    const response = await fetch(buildUserReposUrl(page), { headers });
    if (!response.ok) {
      const error = new Error(`GitHub API returned ${response.status}`);
      Object.assign(error, { response });
      throw error;
    }

    const pageRepos = (await response.json()) as GitHubApiRepo[];
    repos.push(...pageRepos);

    if (pageRepos.length < GITHUB_REPOS_PAGE_SIZE) {
      break;
    }
  }

  return isSearch ? filterReposByQuery(repos, query ?? "") : repos;
}

export async function listGitHubRepos(
  config: GitHubConfig | null,
  query: string | null
): Promise<GitHubRepoBrowserItem[]> {
  if (!config?.token) {
    throw new Error("GitHub not connected");
  }

  const repos = await fetchAccessibleGitHubRepos(config.token, query);
  return mapRepos(repos);
}

export function getGitHubRateLimitError(response: Response | undefined): string | null {
  if (!response) return null;
  if (response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0") {
    return "GitHub API rate limit exceeded. Please try again later or connect your account.";
  }
  return null;
}

export async function browseGitHubRepositoryContents(
  config: GitHubConfig,
  input: { owner: string; repo: string; path?: string }
): Promise<Response> {
  const encodedPath = input.path
    ? `/${input.path.split("/").map(encodeURIComponent).join("/")}`
    : "";

  return fetch(
    `https://api.github.com/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/contents${encodedPath}`,
    {
      headers: {
        Accept: "application/vnd.github.v3+json",
        Authorization: `Bearer ${config.token}`,
        "User-Agent": "radarboard",
      },
    }
  );
}

export async function parseGitHubRepositoryContents(
  response: Response,
  path: string
): Promise<{ directories: GitHubRepoDirectory[]; isMonorepo?: boolean }> {
  const raw = (await response.json()) as GitHubContentEntry | GitHubContentEntry[];
  const items = Array.isArray(raw) ? raw : [];
  const directories = items
    .filter((entry) => entry.type === "dir")
    .map((entry) => ({ name: entry.name, path: entry.path }))
    .sort((left, right) => left.name.localeCompare(right.name));

  const MONOREPO_DIR_NAMES = new Set(["apps", "packages", "libs", "modules", "services"]);
  const MONOREPO_FILE_NAMES = new Set([
    "pnpm-workspace.yaml",
    "lerna.json",
    "turbo.json",
    "nx.json",
    "rush.json",
  ]);

  if (path) {
    return { directories };
  }

  const hasMonorepoDirs = directories.some((directory) => MONOREPO_DIR_NAMES.has(directory.name));
  const hasMonorepoFiles = items.some(
    (entry) => entry.type === "file" && MONOREPO_FILE_NAMES.has(entry.name)
  );

  return {
    directories,
    isMonorepo: hasMonorepoDirs || hasMonorepoFiles,
  };
}
