"use client";

import { apiFetcher, buildUrl } from "@radarboard/hooks/fetcher";
import { useEffectiveTimeZone } from "@radarboard/hooks/use-effective-timezone";
import { usePollingInterval } from "@radarboard/hooks/use-polling-interval";
import { integrationRoute } from "@radarboard/types/api-routes";
import type { TimeRange } from "@radarboard/types/dashboard";
import type { SeoOverview } from "@radarboard/types/seo";
import { useCallback } from "react";
import useSWR from "swr";

const ROUTE = integrationRoute("google-search-console", "data");

interface SeoResponse {
  configured: boolean;
  seo?: SeoOverview;
  ctaLabel?: string;
  ctaTarget?: string;
  _fetchedAt?: number;
  error?: string;
  projectMappingRequired?: boolean;
  setupMessage?: string;
}

type SeoUnconfiguredState = Omit<SeoResponse, "seo"> & {
  configured: false;
};

export function useSeo(
  projectSlug: string | null = null,
  siteUrl: string | null = null,
  timeRange: TimeRange = "30d",
  demoMode = false
) {
  const effectiveTimezone = useEffectiveTimeZone();
  const refreshInterval = usePollingInterval("seo");
  const key = buildUrl(ROUTE, {
    project: projectSlug,
    siteUrl,
    range: timeRange,
    timezone: effectiveTimezone,
    ...(demoMode ? { demo: "1" } : {}),
  });

  const { data, error, isLoading, mutate } = useSWR<SeoResponse>(key, apiFetcher, {
    refreshInterval,
  });

  const refetch = useCallback(async () => {
    const forceUrl = buildUrl(ROUTE, {
      project: projectSlug,
      siteUrl,
      range: timeRange,
      timezone: effectiveTimezone,
      refresh: "1",
      ...(demoMode ? { demo: "1" } : {}),
    });
    const fresh = await apiFetcher<SeoResponse>(forceUrl);
    await mutate(fresh, { revalidate: false });
  }, [projectSlug, siteUrl, timeRange, effectiveTimezone, demoMode, mutate]);

  return {
    data: data?.configured === false ? (data as SeoUnconfiguredState) : (data?.seo ?? null),
    configured: data?.configured ?? false,
    fetchedAt: data?._fetchedAt ?? null,
    loading: isLoading,
    error: error?.message ?? data?.error ?? null,
    refetch,
  };
}
