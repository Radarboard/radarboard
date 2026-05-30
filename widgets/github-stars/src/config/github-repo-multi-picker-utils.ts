import { API_ROUTES } from "@radarboard/types/api-routes";
import type { ProjectIntegrationsConfig } from "@radarboard/types/database";
import type { Project } from "@radarboard/types/project";

export interface WidgetGitHubRepoSelection {
  owner: string;
  repo: string;
}

export interface GitHubRepoPickerItem extends WidgetGitHubRepoSelection {
  fullName: string;
  description: string | null;
  stars: number;
  language: string | null;
}

function normalizeRepoSelection(
  value: Pick<WidgetGitHubRepoSelection, "owner" | "repo"> | null | undefined
): WidgetGitHubRepoSelection | null {
  if (!value) return null;

  const owner = value.owner.trim();
  const repo = value.repo.trim();

  if (owner.length === 0 || repo.length === 0) return null;
  if (owner.includes("/") || repo.includes("/")) return null;

  return { owner, repo };
}

function repoKey(repo: WidgetGitHubRepoSelection): string {
  return `${repo.owner.toLowerCase()}/${repo.repo.toLowerCase()}`;
}

export function resolveWidgetGitHubRepoSelections(value: unknown): WidgetGitHubRepoSelection[] {
  if (!Array.isArray(value)) return [];

  const next: WidgetGitHubRepoSelection[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    const normalized =
      typeof item === "object" && item !== null
        ? normalizeRepoSelection(item as Pick<WidgetGitHubRepoSelection, "owner" | "repo">)
        : null;

    if (!normalized) continue;

    const key = repoKey(normalized);
    if (seen.has(key)) continue;

    seen.add(key);
    next.push(normalized);
  }

  return next;
}

export function buildRepoPickerUrl(search: string): string {
  const query = search.trim();
  if (query.length === 0) return API_ROUTES.githubRepos;

  const params = new URLSearchParams({ q: query });
  return `${API_ROUTES.githubRepos}?${params.toString()}`;
}

export function sortGitHubRepoPickerItems(
  repos: ReadonlyArray<GitHubRepoPickerItem>
): GitHubRepoPickerItem[] {
  return [...repos].sort((left, right) => {
    if (right.stars !== left.stars) return right.stars - left.stars;
    return left.fullName.localeCompare(right.fullName);
  });
}

function extractGitHubFromPlatformConfig(
  platformConfig: unknown
): WidgetGitHubRepoSelection | null {
  if (
    typeof platformConfig !== "object" ||
    platformConfig === null ||
    !("github" in platformConfig)
  ) {
    return null;
  }
  const github = (platformConfig as { github?: unknown }).github;
  if (!github || typeof github !== "object") return null;

  const owner = "owner" in github && typeof github.owner === "string" ? github.owner : undefined;
  const repo = "repo" in github && typeof github.repo === "string" ? github.repo : undefined;

  return owner && repo ? { owner, repo } : null;
}

export function collectProjectLinkedRepoSelections(
  projects: Project[],
  projectIntegrations: ProjectIntegrationsConfig
): WidgetGitHubRepoSelection[] {
  const staticRepos = projects.flatMap((project) =>
    project.platforms.flatMap((platform) => {
      const github = platform.integrations.github;
      return github ? [{ owner: github.owner, repo: github.repo }] : [];
    })
  );

  const overrideRepos = Object.values(projectIntegrations).flatMap((projectConfig) =>
    Object.values(projectConfig).flatMap((platformConfig) => {
      const result = extractGitHubFromPlatformConfig(platformConfig);
      return result ? [result] : [];
    })
  );

  return resolveWidgetGitHubRepoSelections([...staticRepos, ...overrideRepos]);
}
