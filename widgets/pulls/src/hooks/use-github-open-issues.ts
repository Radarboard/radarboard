"use client";

import { apiFetcher, buildUrl } from "@radarboard/hooks/fetcher";
import { useEffectiveTimeZone } from "@radarboard/hooks/use-effective-timezone";
import { usePollingInterval } from "@radarboard/hooks/use-polling-interval";
import { integrationRoute } from "@radarboard/types/api-routes";
import type { TimeRange } from "@radarboard/types/dashboard";
import type { GitHubOpenIssueItem } from "@radarboard/types/github-activity";
import { useCallback } from "react";
import useSWR from "swr";

const ROUTE = integrationRoute("github", "open-issues");

interface GitHubOpenIssuesResponse {
  configured: boolean;
  items: GitHubOpenIssueItem[];
  _fetchedAt?: number;
  _stale?: boolean;
}

const EMPTY_GITHUB_ISSUES: GitHubOpenIssueItem[] = [];

export function useGithubOpenIssues(
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

  const { data, error, isLoading, isValidating, mutate } = useSWR<GitHubOpenIssuesResponse>(
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
    const fresh = await apiFetcher<GitHubOpenIssuesResponse>(forceUrl);
    await mutate(fresh, { revalidate: false });
  }, [projectSlug, timeRange, effectiveTimezone, mutate]);

  return {
    items: data?.items ?? EMPTY_GITHUB_ISSUES,
    configured: data?.configured ?? false,
    fetchedAt: data?._fetchedAt ?? null,
    stale: data?._stale ?? false,
    loading: isLoading && !error,
    validating: isValidating,
    error: error?.message ?? null,
    refetch,
  };
}
