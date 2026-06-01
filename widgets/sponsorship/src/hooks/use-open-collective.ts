"use client";

import { apiFetcher } from "@radarboard/hooks/fetcher";
import { useEffectiveTimeZone } from "@radarboard/hooks/use-effective-timezone";
import { usePollingInterval } from "@radarboard/hooks/use-polling-interval";
import { integrationRoute } from "@radarboard/types/api-routes";
import type { TimeRange } from "@radarboard/types/dashboard";
import type {
  OpenCollectiveMember,
  OpenCollectiveStats,
  OpenCollectiveTransaction,
} from "@radarboard/types/open-collective";
import { useCallback } from "react";
import useSWR from "swr";

const ROUTE = integrationRoute("open-collective", "data");

interface OpenCollectiveResponse {
  configured: boolean;
  stats?: OpenCollectiveStats;
  recentTransactions?: OpenCollectiveTransaction[];
  topMembers?: OpenCollectiveMember[];
  _fetchedAt?: number;
  error?: string;
}

export interface OpenCollectiveOverviewData {
  stats: OpenCollectiveStats;
  recentTransactions: OpenCollectiveTransaction[];
  topMembers: OpenCollectiveMember[];
}

export function useOpenCollective(
  slug: string | null,
  timeRange: TimeRange = "30d",
  demoMode = false
) {
  const effectiveTimezone = useEffectiveTimeZone();
  const refreshInterval = usePollingInterval("sponsorship");
  const key = slug
    ? `${ROUTE}?slug=${encodeURIComponent(slug)}&range=${encodeURIComponent(timeRange)}&timezone=${encodeURIComponent(effectiveTimezone)}${demoMode ? "&demo=1" : ""}`
    : null;

  const { data, error, isLoading, mutate } = useSWR<OpenCollectiveResponse>(key, apiFetcher, {
    refreshInterval,
    shouldRetryOnError: false,
  });

  const refetch = useCallback(async () => {
    if (!slug) return;
    const forceUrl = `${ROUTE}?slug=${encodeURIComponent(slug)}&range=${encodeURIComponent(timeRange)}&timezone=${encodeURIComponent(effectiveTimezone)}&refresh=1${demoMode ? "&demo=1" : ""}`;
    const fresh = await apiFetcher<OpenCollectiveResponse>(forceUrl);
    await mutate(fresh, { revalidate: false });
  }, [slug, timeRange, effectiveTimezone, demoMode, mutate]);

  const parsed: OpenCollectiveOverviewData | null =
    data?.configured && data?.stats
      ? {
          stats: data.stats,
          recentTransactions: data.recentTransactions ?? [],
          topMembers: data.topMembers ?? [],
        }
      : null;

  return {
    data: parsed,
    configured: data?.configured ?? false,
    fetchedAt: data?._fetchedAt ?? null,
    loading: isLoading && !error,
    error: error?.message ?? data?.error ?? null,
    refetch,
  };
}
