import type { CacheRepository, GitHubStarHistoryRepository } from "@radarboard/types/database";
import type { GitHubRepository } from "../types";

export interface RepoRef {
  owner: string;
  repo: string;
}

type SavedIntegrations = Record<string, Record<string, Record<string, unknown>>>;
type ProjectLike = {
  slug: string;
  platforms: Array<{
    id: string;
    integrations: Record<string, unknown>;
  }>;
};

export interface GitHubStarTrackingRepoState {
  repoKey: string;
  fullName: string;
  trackingStartedAt: number | null;
  baselineStars: number | null;
  lastWebhookAt: number | null;
  tracked: boolean;
}

export function normalizeRepoRef(owner: string, repo: string): RepoRef | null {
  const normalizedOwner = owner.trim();
  const normalizedRepo = repo.trim();

  if (!normalizedOwner || !normalizedRepo) return null;
  if (normalizedOwner.includes("/") || normalizedRepo.includes("/")) return null;

  return { owner: normalizedOwner, repo: normalizedRepo };
}

export function repoKey(repo: RepoRef): string {
  return `${repo.owner.toLowerCase()}/${repo.repo.toLowerCase()}`;
}

export function dedupeRepoRefs(repos: RepoRef[]): RepoRef[] {
  const next: RepoRef[] = [];
  const seen = new Set<string>();

  for (const repo of repos) {
    const normalized = normalizeRepoRef(repo.owner, repo.repo);
    if (!normalized) continue;
    const key = repoKey(normalized);
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(normalized);
  }

  return next;
}

function collectRepoFromProject(project: ProjectLike, saved: SavedIntegrations, repos: RepoRef[]) {
  const savedProject = saved[project.slug] ?? {};
  const projectGh = (savedProject as Record<string, Record<string, unknown>>)._project?.github as
    | RepoRef
    | undefined;
  if (projectGh?.owner && projectGh?.repo) repos.push(projectGh);

  for (const [key, platformData] of Object.entries(savedProject)) {
    if (key === "_project") continue;
    const gh = (platformData as Record<string, unknown>).github as RepoRef | undefined;
    if (gh?.owner && gh?.repo) repos.push(gh);
  }

  for (const platform of project.platforms) {
    const gh = platform.integrations.github as { owner?: string; repo?: string } | undefined;
    if (gh?.owner && gh?.repo) repos.push({ owner: gh.owner, repo: gh.repo });
  }
}

export function collectConfiguredRepos(
  projects: ProjectLike[],
  saved: SavedIntegrations
): RepoRef[] {
  const repos: RepoRef[] = [];
  for (const project of projects) {
    collectRepoFromProject(project, saved, repos);
  }
  return dedupeRepoRefs(repos);
}

export function resolveWidgetSelectedRepos(widgetLayout: unknown): RepoRef[] {
  if (!widgetLayout || typeof widgetLayout !== "object") return [];
  const configs = (widgetLayout as { configs?: Record<string, unknown> }).configs;
  const starsConfig = configs?.stars;
  if (!starsConfig || typeof starsConfig !== "object") return [];
  const selectedRepos = (starsConfig as { selectedRepos?: unknown }).selectedRepos;
  if (!Array.isArray(selectedRepos)) return [];

  return dedupeRepoRefs(
    selectedRepos.flatMap((value) => {
      if (!value || typeof value !== "object") return [];
      const owner = "owner" in value && typeof value.owner === "string" ? value.owner : "";
      const repo = "repo" in value && typeof value.repo === "string" ? value.repo : "";
      const normalized = normalizeRepoRef(owner, repo);
      return normalized ? [normalized] : [];
    })
  );
}

export function resolveTrackedRepos(
  projects: ProjectLike[],
  widgetLayout: unknown,
  savedIntegrations: SavedIntegrations
): RepoRef[] {
  return dedupeRepoRefs([
    ...resolveWidgetSelectedRepos(widgetLayout),
    ...collectConfiguredRepos(projects, savedIntegrations),
  ]);
}

function formatRepoName(repo: RepoRef): string {
  return `${repo.owner}/${repo.repo}`;
}

export async function listGitHubStarTrackingStates(
  repos: RepoRef[],
  historyRepo: GitHubStarHistoryRepository
): Promise<GitHubStarTrackingRepoState[]> {
  const states = await historyRepo.getTrackingStates(repos.map(repoKey));
  const stateByRepo = new Map(states.map((state) => [state.repoKey, state]));

  return repos.map((repo) => {
    const key = repoKey(repo);
    const state = stateByRepo.get(key);
    return {
      repoKey: key,
      fullName: formatRepoName(repo),
      trackingStartedAt: state?.trackingStartedAt ?? null,
      baselineStars: state?.baselineStars ?? null,
      lastWebhookAt: state?.lastWebhookAt ?? null,
      tracked: state?.trackingStartedAt != null && state?.baselineStars != null,
    };
  });
}

export async function initializeGitHubStarTracking(options: {
  repos: RepoRef[];
  token: string;
  historyRepo: GitHubStarHistoryRepository;
  cacheRepo: CacheRepository;
  getRepository: (
    config: { token: string },
    owner: string,
    repo: string
  ) => Promise<GitHubRepository>;
  starsHistoryRoute: string;
}): Promise<GitHubStarTrackingRepoState[]> {
  const now = Math.floor(Date.now() / 1000);
  const existing = await options.historyRepo.getTrackingStates(options.repos.map(repoKey));
  const existingByRepo = new Map(existing.map((row) => [row.repoKey, row]));

  const repositoryResults = await Promise.allSettled(
    options.repos.map(async (repo) => ({
      repo,
      data: await options.getRepository({ token: options.token }, repo.owner, repo.repo),
    }))
  );

  const fulfilled = repositoryResults.filter(
    (
      result
    ): result is PromiseFulfilledResult<{
      repo: RepoRef;
      data: GitHubRepository;
    }> => result.status === "fulfilled"
  );

  if (fulfilled.length === 0) {
    throw new Error("Failed to resolve repository star baselines");
  }

  await Promise.all(
    fulfilled.map(({ value }) => {
      const key = repoKey(value.repo);
      const previous = existingByRepo.get(key);
      return options.historyRepo.upsertTrackingState({
        repoKey: key,
        trackingStartedAt: previous?.trackingStartedAt ?? now,
        baselineStars: previous?.baselineStars ?? value.data.stargazers_count,
        lastWebhookAt: previous?.lastWebhookAt ?? null,
        updatedAt: now,
      });
    })
  );

  const cachedKeys = await options.cacheRepo.getKeysByRoute(options.starsHistoryRoute);
  await Promise.all(cachedKeys.map((key) => options.cacheRepo.delete(key)));

  return listGitHubStarTrackingStates(options.repos, options.historyRepo);
}
