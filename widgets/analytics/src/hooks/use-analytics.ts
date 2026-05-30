"use client";

import { apiFetcher, buildUrl } from "@radarboard/hooks/fetcher";
import { useEffectiveTimeZone } from "@radarboard/hooks/use-effective-timezone";
import { usePollingInterval } from "@radarboard/hooks/use-polling-interval";
import type { AnalyticsOverview } from "@radarboard/types/analytics";
import type { TimeRange } from "@radarboard/types/dashboard";
import { useCallback } from "react";
import useSWR from "swr";

const ROUTE = "/api/analytics/data";

interface AnalyticsResponse {
  configured: boolean;
  analytics?: AnalyticsOverview;
  ctaLabel?: string;
  ctaTarget?: string;
  _fetchedAt?: number;
  error?: string;
  projectMappingRequired?: boolean;
  setupMessage?: string;
}

type AnalyticsUnconfiguredState = Omit<AnalyticsResponse, "analytics"> & {
  configured: false;
};

export function useAnalytics(timeRange: TimeRange = "30d", projectSlug: string | null = null) {
  const effectiveTimezone = useEffectiveTimeZone();
  const refreshInterval = usePollingInterval("analytics");
  const key = buildUrl(ROUTE, {
    range: timeRange,
    project: projectSlug,
    timezone: effectiveTimezone,
  });

  const { data, error, isLoading, mutate } = useSWR<AnalyticsResponse>(key, apiFetcher, {
    refreshInterval,
    shouldRetryOnError: false,
  });

  const refetch = useCallback(async () => {
    const forceUrl = buildUrl(ROUTE, {
      range: timeRange,
      project: projectSlug,
      timezone: effectiveTimezone,
      refresh: "1",
    });
    const fresh = await apiFetcher<AnalyticsResponse>(forceUrl);
    await mutate(fresh, { revalidate: false });
  }, [timeRange, projectSlug, effectiveTimezone, mutate]);

  return {
    data:
      data?.configured === false ? (data as AnalyticsUnconfiguredState) : (data?.analytics ?? null),
    configured: data?.configured ?? false,
    fetchedAt: data?._fetchedAt ?? null,
    loading: isLoading && !error,
    error: error?.message ?? data?.error ?? null,
    refetch,
  };
}
