"use client";

import { apiFetcher, buildUrl } from "@radarboard/hooks/fetcher";
import { useEffectiveTimeZone } from "@radarboard/hooks/use-effective-timezone";
import { usePollingInterval } from "@radarboard/hooks/use-polling-interval";
import { integrationRoute } from "@radarboard/types/api-routes";
import type { AppStoreOverview } from "@radarboard/types/app-store-connect";
import type { TimeRange } from "@radarboard/types/dashboard";
import { useCallback } from "react";
import useSWR from "swr";

const ROUTE = integrationRoute("app-store-connect", "data");

interface AppStoreResponse {
  configured: boolean;
  appStore?: AppStoreOverview;
  ctaLabel?: string;
  ctaTarget?: string;
  _fetchedAt?: number;
  error?: string;
  projectMappingRequired?: boolean;
  setupMessage?: string;
}

type AppStoreUnconfiguredState = Omit<AppStoreResponse, "appStore"> & {
  configured: false;
};

export function useAppStore(projectSlug: string | null = null, timeRange: TimeRange = "30d") {
  const effectiveTimezone = useEffectiveTimeZone();
  const refreshInterval = usePollingInterval("app-store");
  const key = buildUrl(ROUTE, {
    project: projectSlug,
    range: timeRange,
    timezone: effectiveTimezone,
  });

  const { data, error, isLoading, mutate } = useSWR<AppStoreResponse>(key, apiFetcher, {
    refreshInterval,
    shouldRetryOnError: false,
  });

  const refetch = useCallback(async () => {
    const forceUrl = buildUrl(ROUTE, {
      project: projectSlug,
      range: timeRange,
      timezone: effectiveTimezone,
      refresh: "1",
    });
    const fresh = await apiFetcher<AppStoreResponse>(forceUrl);
    await mutate(fresh, { revalidate: false });
  }, [projectSlug, timeRange, effectiveTimezone, mutate]);

  return {
    data:
      data?.configured === false ? (data as AppStoreUnconfiguredState) : (data?.appStore ?? null),
    configured: data?.configured ?? false,
    fetchedAt: data?._fetchedAt ?? null,
    loading: isLoading && !error,
    error: error?.message ?? data?.error ?? null,
    refetch,
  };
}
