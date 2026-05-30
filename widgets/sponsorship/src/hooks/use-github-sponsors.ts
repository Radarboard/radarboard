"use client";

import { apiFetcher } from "@radarboard/hooks/fetcher";
import { usePollingInterval } from "@radarboard/hooks/use-polling-interval";
import { integrationRoute } from "@radarboard/types/api-routes";
import type {
  GitHubSponsor,
  GitHubSponsorStats,
  GitHubSponsorTier,
} from "@radarboard/types/github-sponsors";
import { useCallback } from "react";
import useSWR from "swr";

const ROUTE = integrationRoute("github-sponsors", "data");

interface GitHubSponsorsResponse {
  configured: boolean;
  stats?: GitHubSponsorStats;
  sponsors?: GitHubSponsor[];
  tiers?: GitHubSponsorTier[];
  goal?: {
    title: string;
    targetValue: number;
    percentComplete: number;
  } | null;
  limitedAccess?: boolean;
  _fetchedAt?: number;
  error?: string;
}

export interface GitHubSponsorsOverviewData {
  stats: GitHubSponsorStats;
  sponsors: GitHubSponsor[];
  tiers: GitHubSponsorTier[];
  goal: {
    title: string;
    targetValue: number;
    percentComplete: number;
  } | null;
  limitedAccess: boolean;
}

export function useGitHubSponsors(login: string | null, enabled = true) {
  const refreshInterval = usePollingInterval("sponsorship");
  const getKey = () => {
    if (!enabled) return null;
    if (login) return `${ROUTE}?login=${encodeURIComponent(login)}`;
    return ROUTE;
  };
  const key = getKey();

  const { data, error, isLoading, mutate } = useSWR<GitHubSponsorsResponse>(key, apiFetcher, {
    refreshInterval,
    shouldRetryOnError: false,
  });

  const refetch = useCallback(async () => {
    const forceUrl = login
      ? `${ROUTE}?login=${encodeURIComponent(login)}&refresh=1`
      : `${ROUTE}?refresh=1`;
    const fresh = await apiFetcher<GitHubSponsorsResponse>(forceUrl);
    await mutate(fresh, { revalidate: false });
  }, [login, mutate]);

  const parsed: GitHubSponsorsOverviewData | null =
    data?.configured && data?.stats
      ? {
          stats: data.stats,
          sponsors: data.sponsors ?? [],
          tiers: data.tiers ?? [],
          goal: data.goal ?? null,
          limitedAccess: data.limitedAccess ?? false,
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
