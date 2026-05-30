"use client";

import { apiFetcher } from "@radarboard/hooks/fetcher";
import { usePollingInterval } from "@radarboard/hooks/use-polling-interval";
import { integrationRoute } from "@radarboard/types/api-routes";
import type { HealthCheck, HealthIncident } from "@radarboard/types/health";
import { useCallback } from "react";
import useSWR from "swr";

const ROUTE = integrationRoute("betterstack", "data");

interface HealthResponse {
  configured: boolean;
  checks: HealthCheck[];
  incidents: HealthIncident[];
  _fetchedAt?: number;
  error?: string;
}

export function useHealth() {
  const refreshInterval = usePollingInterval("health");
  const key = ROUTE;
  const { data, error, isLoading, mutate } = useSWR<HealthResponse>(key, apiFetcher, {
    refreshInterval,
    shouldRetryOnError: false,
  });

  const refetch = useCallback(async () => {
    const fresh = await apiFetcher<HealthResponse>(`${ROUTE}?refresh=1`);
    await mutate(fresh, { revalidate: false });
  }, [mutate]);

  return {
    checks: data?.checks ?? [],
    incidents: data?.incidents ?? [],
    configured: data?.configured ?? false,
    fetchedAt: data?._fetchedAt ?? null,
    loading: isLoading && !error,
    error: error?.message ?? data?.error ?? null,
    refetch,
  };
}
