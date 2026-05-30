"use client";

import { useEffectiveTimeZone } from "@radarboard/hooks/use-effective-timezone";
import { usePollingInterval } from "@radarboard/hooks/use-polling-interval";
import type { TimeRange } from "@radarboard/types/dashboard";
import { useCallback } from "react";
import useSWR from "swr";
import { buildGitHubStarsHistoryUrl } from "../repo-query";
import type { GitHubRepoSelection, GitHubStarsHistoryData } from "../types";

async function fetchGitHubStarsHistory(url: string): Promise<GitHubStarsHistoryData> {
  const res = await fetch(url);
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? `GitHub history API error: ${res.status}`);
  }
  return res.json() as Promise<GitHubStarsHistoryData>;
}

export function useGitHubStarsHistory(
  projectSlug: string | null,
  selectedRepos: GitHubRepoSelection[] = [],
  timeRange: TimeRange = "all"
) {
  const refreshInterval = usePollingInterval("github-stars");
  const effectiveTimezone = useEffectiveTimeZone();
  const key = buildGitHubStarsHistoryUrl(projectSlug, timeRange, effectiveTimezone, selectedRepos);

  const { data, error, isLoading, mutate } = useSWR<GitHubStarsHistoryData>(
    key,
    fetchGitHubStarsHistory,
    {
      refreshInterval,
      shouldRetryOnError: false,
      dedupingInterval: refreshInterval,
      revalidateOnReconnect: false,
    }
  );

  const refetch = useCallback(async () => {
    const fresh = await fetchGitHubStarsHistory(
      buildGitHubStarsHistoryUrl(projectSlug, timeRange, effectiveTimezone, selectedRepos, true)
    );
    await mutate(fresh, { revalidate: false });
  }, [effectiveTimezone, mutate, projectSlug, selectedRepos, timeRange]);

  return {
    data: data ?? null,
    fetchedAt: data?._fetchedAt ?? null,
    loading: isLoading,
    error: error?.message ?? null,
    refetch,
  };
}
