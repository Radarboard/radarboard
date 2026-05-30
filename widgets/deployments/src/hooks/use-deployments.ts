"use client";

import { apiFetcher, buildUrl } from "@radarboard/hooks/fetcher";
import { useEffectiveTimeZone } from "@radarboard/hooks/use-effective-timezone";
import { usePollingInterval } from "@radarboard/hooks/use-polling-interval";
import { integrationRoute } from "@radarboard/types/api-routes";
import type { TimeRange } from "@radarboard/types/dashboard";
import type { VercelDeploymentItem, VercelProjectSummary } from "@radarboard/types/vercel";
import { useCallback, useMemo } from "react";
import useSWR from "swr";

const ROUTE = integrationRoute("vercel", "deployments");

interface VercelDeploymentsResponse {
  configured: boolean;
  deployments: VercelDeploymentItem[];
  projects: VercelProjectSummary[];
  _fetchedAt?: number;
  error?: string;
}

export function useVercelDeployments(
  projectSlug: string | null = null,
  timeRange: TimeRange = "30d"
) {
  const effectiveTimezone = useEffectiveTimeZone();
  const refreshInterval = usePollingInterval("vercel-deployments");
  const key = buildUrl(ROUTE, {
    project: projectSlug,
    range: timeRange,
    timezone: effectiveTimezone,
  });

  const { data, error, isLoading, mutate } = useSWR<VercelDeploymentsResponse>(key, apiFetcher, {
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
    const fresh = await apiFetcher<VercelDeploymentsResponse>(forceUrl);
    await mutate(fresh, { revalidate: false });
  }, [projectSlug, timeRange, effectiveTimezone, mutate]);

  return useMemo(
    () => ({
      deployments: data?.deployments ?? [],
      projects: data?.projects ?? [],
      configured: data?.configured ?? false,
      fetchedAt: data?._fetchedAt ?? null,
      loading: isLoading && !error,
      error: error?.message ?? data?.error ?? null,
      refetch,
    }),
    [data, error, isLoading, refetch]
  );
}
