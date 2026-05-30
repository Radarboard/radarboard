"use client";

import { apiFetcher, buildUrl } from "@radarboard/hooks/fetcher";
import { useEffectiveTimeZone } from "@radarboard/hooks/use-effective-timezone";
import { usePollingInterval } from "@radarboard/hooks/use-polling-interval";
import { integrationRoute } from "@radarboard/types/api-routes";
import type { TimeRange } from "@radarboard/types/dashboard";
import { useCallback } from "react";
import useSWR from "swr";

const ROUTE = integrationRoute("github", "commit-activity");

export interface CommitDailyStats {
  date: string; // YYYY-MM-DD
  count: number;
}

export interface CommitRepoData {
  repo: string;
  totalCommits: number;
  dailyStats: CommitDailyStats[];
  visibility?: "public" | "private";
}

interface CommitsData {
  repos: CommitRepoData[];
}

interface CommitsResponse extends CommitsData {
  configured?: boolean;
  _fetchedAt?: number;
  _stale?: boolean;
}

export function useGithubCommits(
  projectSlug: string | null = null,
  timeRange: TimeRange = "1y",
  pollInterval?: number
) {
  const effectiveTimezone = useEffectiveTimeZone();
  const defaultRefreshInterval = usePollingInterval("github-activity");
  const refreshInterval = pollInterval ?? defaultRefreshInterval;

  const key = buildUrl(ROUTE, {
    project: projectSlug,
    range: timeRange,
    timezone: effectiveTimezone,
  });

  const { data, error, isLoading, isValidating, mutate } = useSWR<CommitsResponse>(
    key,
    apiFetcher,
    { refreshInterval, shouldRetryOnError: false }
  );

  const refetch = useCallback(async () => {
    const forceUrl = buildUrl(ROUTE, {
      project: projectSlug,
      range: timeRange,
      timezone: effectiveTimezone,
      refresh: "1",
    });
    const fresh = await apiFetcher<CommitsResponse>(forceUrl);
    await mutate(fresh, { revalidate: false });
  }, [projectSlug, timeRange, effectiveTimezone, mutate]);

  return {
    data,
    configured: data?.configured ?? false,
    fetchedAt: data?._fetchedAt ?? null,
    stale: data?._stale ?? false,
    loading: isLoading && !error,
    validating: isValidating,
    error: error?.message ?? null,
    refetch,
    mutate,
  };
}
