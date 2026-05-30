"use client";

import { ROUTES } from "./routes";
import type { GitHubRepoSelection } from "./types";

function normalizeGitHubRepoSelection(
  value: Pick<GitHubRepoSelection, "owner" | "repo"> | null | undefined
): GitHubRepoSelection | null {
  if (!value) return null;

  const owner = value.owner.trim();
  const repo = value.repo.trim();

  if (owner.length === 0 || repo.length === 0) return null;
  if (owner.includes("/") || repo.includes("/")) return null;

  return { owner, repo };
}

function getRepoKey(repo: GitHubRepoSelection): string {
  return `${repo.owner.toLowerCase()}/${repo.repo.toLowerCase()}`;
}

export function dedupeGitHubRepoSelections(
  repos: ReadonlyArray<Pick<GitHubRepoSelection, "owner" | "repo"> | null | undefined>
): GitHubRepoSelection[] {
  const next: GitHubRepoSelection[] = [];
  const seen = new Set<string>();

  for (const repo of repos) {
    const normalized = normalizeGitHubRepoSelection(repo);
    if (!normalized) continue;

    const key = getRepoKey(normalized);
    if (seen.has(key)) continue;

    seen.add(key);
    next.push(normalized);
  }

  return next;
}

export function extractSelectedReposFromConfig(config: object | undefined): GitHubRepoSelection[] {
  if (!config || typeof config !== "object") return [];
  const selectedRepos = (config as { selectedRepos?: unknown }).selectedRepos;
  if (!Array.isArray(selectedRepos)) return [];
  return dedupeGitHubRepoSelections(
    selectedRepos.map((value) =>
      typeof value === "object" && value !== null
        ? (value as Pick<GitHubRepoSelection, "owner" | "repo">)
        : null
    )
  );
}

export function buildGitHubStarsUrl(
  projectSlug: string | null,
  selectedRepos: ReadonlyArray<Pick<GitHubRepoSelection, "owner" | "repo"> | null | undefined> = [],
  refresh = false
): string {
  const params = new URLSearchParams();

  if (projectSlug) params.set("project", projectSlug);

  for (const repo of dedupeGitHubRepoSelections(selectedRepos)) {
    params.append("repo", `${repo.owner}/${repo.repo}`);
  }

  if (refresh) params.set("refresh", "1");

  return params.size > 0 ? `${ROUTES.githubStars}?${params.toString()}` : ROUTES.githubStars;
}

export function buildGitHubStarsHistoryUrl(
  projectSlug: string | null,
  range: string,
  timeZone: string | null,
  selectedRepos: ReadonlyArray<Pick<GitHubRepoSelection, "owner" | "repo"> | null | undefined> = [],
  refresh = false
): string {
  const params = new URLSearchParams();

  params.set("range", range);
  if (projectSlug) params.set("project", projectSlug);
  if (timeZone) params.set("timezone", timeZone);

  for (const repo of dedupeGitHubRepoSelections(selectedRepos)) {
    params.append("repo", `${repo.owner}/${repo.repo}`);
  }

  if (refresh) params.set("refresh", "1");

  return `${ROUTES.githubStarsHistory}?${params.toString()}`;
}
