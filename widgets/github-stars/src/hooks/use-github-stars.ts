"use client";

import { usePollingInterval } from "@radarboard/hooks/use-polling-interval";
import { useCallback } from "react";
import useSWR from "swr";
import { buildGitHubStarsUrl } from "../repo-query";
import type { GitHubRepoSelection, GitHubStarsData } from "../types";

async function fetchGitHubStars(url: string): Promise<GitHubStarsData> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  return res.json() as Promise<GitHubStarsData>;
}

export function useGitHubStars(
  projectSlug: string | null,
  selectedRepos: GitHubRepoSelection[] = []
) {
  const refreshInterval = usePollingInterval("github-stars");
  const key = buildGitHubStarsUrl(projectSlug, selectedRepos);

  const { data, error, isLoading, mutate } = useSWR<GitHubStarsData>(key, fetchGitHubStars, {
    refreshInterval,
    shouldRetryOnError: false,
  });

  const refetch = useCallback(async () => {
    const fresh = await fetchGitHubStars(buildGitHubStarsUrl(projectSlug, selectedRepos, true));
    await mutate(fresh, { revalidate: false });
  }, [projectSlug, selectedRepos, mutate]);

  return {
    data: data ?? null,
    fetchedAt: data?._fetchedAt ?? null,
    loading: isLoading,
    error: error?.message ?? null,
    refetch,
  };
}
