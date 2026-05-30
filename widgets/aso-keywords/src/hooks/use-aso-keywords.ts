"use client";

import { apiFetcher, buildUrl } from "@radarboard/hooks/fetcher";
import { usePollingInterval } from "@radarboard/hooks/use-polling-interval";
import { integrationRoute } from "@radarboard/types/api-routes";
import type { AsoKeywordsData } from "@radarboard/types/aso-keywords";
import { useCallback } from "react";
import useSWR from "swr";

const ROUTE = integrationRoute("astro", "keywords");

export function useAsoKeywords(projectSlug: string | null = null, store: string | null = null) {
  const refreshInterval = usePollingInterval("aso-keywords");
  const key = buildUrl(ROUTE, {
    project: projectSlug,
    store: store,
  });

  const { data, error, isLoading, mutate } = useSWR<AsoKeywordsData>(key, apiFetcher, {
    refreshInterval,
    shouldRetryOnError: false,
  });

  const refetch = useCallback(async () => {
    const forceUrl = buildUrl(ROUTE, {
      project: projectSlug,
      store: store,
      refresh: "1",
    });
    const fresh = await apiFetcher<AsoKeywordsData>(forceUrl);
    await mutate(fresh, { revalidate: false });
  }, [projectSlug, store, mutate]);

  return {
    data: data ?? null,
    configured: data?.configured ?? false,
    fetchedAt: data?._fetchedAt ?? null,
    isStale: data?._stale ?? false,
    loading: isLoading && !error,
    error: error?.message ?? null,
    refetch,
  };
}
