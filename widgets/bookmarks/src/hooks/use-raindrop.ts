"use client";

import { apiFetcher, buildUrl } from "@radarboard/hooks/fetcher";
import { useEffectiveTimeZone } from "@radarboard/hooks/use-effective-timezone";
import { usePollingInterval } from "@radarboard/hooks/use-polling-interval";
import { integrationRoute } from "@radarboard/types/api-routes";
import type { TimeRange } from "@radarboard/types/dashboard";
import type { RaindropResponse } from "@radarboard/types/raindrop";
import { useCallback } from "react";
import useSWR from "swr";

const ROUTE = integrationRoute("raindrop", "data");

export function useRaindrop(timeRange: TimeRange = "30d") {
  const effectiveTimezone = useEffectiveTimeZone();
  const refreshInterval = usePollingInterval("raindrop");
  const key = buildUrl(ROUTE, {
    range: timeRange,
    timezone: effectiveTimezone,
  });

  const { data, error, isLoading, mutate } = useSWR<RaindropResponse>(key, apiFetcher, {
    refreshInterval,
    dedupingInterval: refreshInterval,
    revalidateOnReconnect: false,
    shouldRetryOnError: false,
  });

  const refetch = useCallback(async () => {
    const fresh = await apiFetcher<RaindropResponse>(
      buildUrl(ROUTE, {
        range: timeRange,
        timezone: effectiveTimezone,
        refresh: "1",
      })
    );
    await mutate(fresh, { revalidate: false });
  }, [effectiveTimezone, mutate, timeRange]);

  return {
    data: data ?? null,
    configured: data?.configured ?? false,
    fetchedAt: data?._fetchedAt ?? null,
    loading: isLoading && !error,
    error: error?.message ?? data?.error ?? null,
    refetch,
  };
}
