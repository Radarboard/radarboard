"use client";

import { apiFetcher, buildUrl } from "@radarboard/hooks/fetcher";
import { useEffectiveTimeZone } from "@radarboard/hooks/use-effective-timezone";
import { usePollingInterval } from "@radarboard/hooks/use-polling-interval";
import { integrationRoute } from "@radarboard/types/api-routes";
import type { TimeRange } from "@radarboard/types/dashboard";
import type { GitHubOpenPRItem } from "@radarboard/types/github-activity";
import { useCallback } from "react";
import useSWR from "swr";

const ROUTE = integrationRoute("github", "open-prs");

interface GitHubOpenPRsResponse {
  configured: boolean;
  items: GitHubOpenPRItem[];
  _fetchedAt?: number;
  _stale?: boolean;
}

const EMPTY_GITHUB_PRS: GitHubOpenPRItem[] = [];

export function useGithubOpenPrs(
  projectSlug: string | null = null,
  timeRange: TimeRange = "30d",
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

  const { data, error, isLoading, isValidating, mutate } = useSWR<GitHubOpenPRsResponse>(
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
    const fresh = await apiFetcher<GitHubOpenPRsResponse>(forceUrl);
    await mutate(fresh, { revalidate: false });
  }, [projectSlug, timeRange, effectiveTimezone, mutate]);

  return {
    items: data?.items ?? EMPTY_GITHUB_PRS,
    configured: data?.configured ?? false,
    fetchedAt: data?._fetchedAt ?? null,
    stale: data?._stale ?? false,
    loading: isLoading && !error,
    validating: isValidating,
    error: error?.message ?? null,
    refetch,
  };
}
