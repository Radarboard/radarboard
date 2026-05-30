"use client";

import { apiFetcher, buildUrl } from "@radarboard/hooks/fetcher";
import { usePollingInterval } from "@radarboard/hooks/use-polling-interval";
import { integrationRoute } from "@radarboard/types/api-routes";
import type { VercelDomainItem } from "@radarboard/types/vercel";
import { useCallback, useMemo } from "react";
import useSWR from "swr";

const ROUTE = integrationRoute("vercel", "domains");

interface VercelDomainsResponse {
  configured: boolean;
  domains: VercelDomainItem[];
  _fetchedAt?: number;
  error?: string;
}

export function useVercelDomains(projectSlug: string | null = null) {
  const refreshInterval = usePollingInterval("vercel-domains");
  const key = buildUrl(ROUTE, { project: projectSlug });

  const { data, error, isLoading, mutate } = useSWR<VercelDomainsResponse>(key, apiFetcher, {
    refreshInterval,
    revalidateOnReconnect: false,
    dedupingInterval: refreshInterval,
    shouldRetryOnError: false,
  });

  const refetch = useCallback(async () => {
    const forceUrl = buildUrl(ROUTE, { project: projectSlug, refresh: "1" });
    const fresh = await apiFetcher<VercelDomainsResponse>(forceUrl);
    await mutate(fresh, { revalidate: false });
  }, [projectSlug, mutate]);

  return useMemo(
    () => ({
      domains: data?.domains ?? [],
      configured: data?.configured ?? false,
      fetchedAt: data?._fetchedAt ?? null,
      loading: isLoading && !error,
      error: error?.message ?? data?.error ?? null,
      refetch,
    }),
    [data, error, isLoading, refetch]
  );
}
