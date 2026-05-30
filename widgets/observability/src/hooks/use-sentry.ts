"use client";

import { apiFetcher, buildUrl } from "@radarboard/hooks/fetcher";
import { useEffectiveTimeZone } from "@radarboard/hooks/use-effective-timezone";
import { usePollingInterval } from "@radarboard/hooks/use-polling-interval";
import { integrationRoute } from "@radarboard/types/api-routes";
import type { TimeRange } from "@radarboard/types/dashboard";
import type { SentryOverview } from "@radarboard/types/sentry";
import { useCallback } from "react";
import useSWR from "swr";

const ROUTE = integrationRoute("sentry", "data");

interface SentryResponse {
  configured: boolean;
  sentry?: SentryOverview | null;
  ctaLabel?: string;
  ctaTarget?: string;
  _fetchedAt?: number;
  _stale?: boolean;
  error?: string;
  projectMappingRequired?: boolean;
  setupMessage?: string;
}

type SentryUnconfiguredState = Omit<SentryResponse, "sentry"> & {
  configured: false;
};

export function useSentry(projectSlug: string | null = null, timeRange: TimeRange = "30d") {
  const effectiveTimezone = useEffectiveTimeZone();
  const refreshInterval = usePollingInterval("sentry");
  const key = buildUrl(ROUTE, {
    project: projectSlug,
    range: timeRange,
    timezone: effectiveTimezone,
  });

  const { data, error, isLoading, mutate } = useSWR<SentryResponse>(key, apiFetcher, {
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
    const fresh = await apiFetcher<SentryResponse>(forceUrl);
    await mutate(fresh, { revalidate: false });
  }, [projectSlug, timeRange, effectiveTimezone, mutate]);

  return {
    data: data?.configured === false ? (data as SentryUnconfiguredState) : (data?.sentry ?? null),
    configured: data?.configured ?? false,
    fetchedAt: data?._fetchedAt ?? null,
    loading: isLoading && !error,
    error: error?.message ?? data?.error ?? null,
    refetch,
  };
}
