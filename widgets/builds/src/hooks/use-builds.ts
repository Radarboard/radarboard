"use client";

/**
 * Vercel deployments hook — local copy.
 * Canonical version lives in @radarboard/hooks/use-vercel-deployments.
 * Copied here per 6-file convention; DO NOT delete the original (shared with other widgets).
 */

import { useEffectiveTimeZone } from "@radarboard/hooks/use-effective-timezone";
import { usePollingInterval } from "@radarboard/hooks/use-polling-interval";
import type { TimeRange } from "@radarboard/types/dashboard";
import type { VercelDeploymentItem, VercelProjectSummary } from "@radarboard/types/vercel";
import { useCallback } from "react";
import useSWR from "swr";
import { ROUTES } from "../routes";

interface VercelDeploymentsResponse {
  configured: boolean;
  deployments: VercelDeploymentItem[];
  projects: VercelProjectSummary[];
  _fetchedAt?: number;
  error?: string;
}

async function apiFetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json() as Promise<T>;
}

function buildUrl(base: string, params: Record<string, string | null | undefined>): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value != null) searchParams.set(key, value);
  }
  const qs = searchParams.toString();
  return qs ? `${base}?${qs}` : base;
}

export function useVercelDeployments(
  projectSlug: string | null = null,
  timeRange: TimeRange = "30d"
) {
  const effectiveTimezone = useEffectiveTimeZone();
  const refreshInterval = usePollingInterval("vercel-deployments");
  const key = buildUrl(ROUTES.vercelDeployments, {
    project: projectSlug,
    range: timeRange,
    timezone: effectiveTimezone,
  });

  const { data, error, isLoading, mutate } = useSWR<VercelDeploymentsResponse>(key, apiFetcher, {
    refreshInterval,
    shouldRetryOnError: false,
  });

  const refetch = useCallback(async () => {
    const forceUrl = buildUrl(ROUTES.vercelDeployments, {
      project: projectSlug,
      range: timeRange,
      timezone: effectiveTimezone,
      refresh: "1",
    });
    const fresh = await apiFetcher<VercelDeploymentsResponse>(forceUrl);
    await mutate(fresh, { revalidate: false });
  }, [projectSlug, timeRange, effectiveTimezone, mutate]);

  return {
    deployments: data?.deployments ?? [],
    projects: data?.projects ?? [],
    configured: data?.configured ?? false,
    fetchedAt: data?._fetchedAt ?? null,
    loading: isLoading && !error,
    error: error?.message ?? data?.error ?? null,
    refetch,
  };
}
