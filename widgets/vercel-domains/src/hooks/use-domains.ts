"use client";

/**
 * Vercel domains hook — local copy.
 * Canonical version lives in @radarboard/hooks/use-vercel-domains.
 */

import { usePollingInterval } from "@radarboard/hooks/use-polling-interval";
import type { VercelDomainItem } from "@radarboard/types/vercel";
import { useCallback } from "react";
import useSWR from "swr";
import { ROUTES } from "../routes";

interface VercelDomainsResponse {
  configured: boolean;
  domains: VercelDomainItem[];
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

export function useVercelDomains(projectSlug: string | null = null) {
  const refreshInterval = usePollingInterval("vercel-domains");
  const key = buildUrl(ROUTES.vercelDomains, { project: projectSlug });

  const { data, error, isLoading, mutate } = useSWR<VercelDomainsResponse>(key, apiFetcher, {
    refreshInterval,
    revalidateOnReconnect: false,
    dedupingInterval: refreshInterval,
    shouldRetryOnError: false,
  });

  const refetch = useCallback(async () => {
    const forceUrl = buildUrl(ROUTES.vercelDomains, { project: projectSlug, refresh: "1" });
    const fresh = await apiFetcher<VercelDomainsResponse>(forceUrl);
    await mutate(fresh, { revalidate: false });
  }, [projectSlug, mutate]);

  return {
    domains: data?.domains ?? [],
    configured: data?.configured ?? false,
    fetchedAt: data?._fetchedAt ?? null,
    loading: isLoading && !error,
    error: error?.message ?? data?.error ?? null,
    refetch,
  };
}
