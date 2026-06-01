"use client";

import { apiFetcher, buildUrl } from "@radarboard/hooks/fetcher";
import { usePollingInterval } from "@radarboard/hooks/use-polling-interval";
import { integrationRoute } from "@radarboard/types/api-routes";
import type { RoadmapInProgressIssue, RoadmapProject } from "@radarboard/types/roadmap";
import { useCallback } from "react";
import useSWR from "swr";

const ROUTE = integrationRoute("linear", "roadmap");

interface RoadmapResponse {
  configured: boolean;
  projects: RoadmapProject[];
  inProgressIssues: RoadmapInProgressIssue[];
  _fetchedAt?: number;
  error?: string;
}

const EMPTY_PROJECTS: RoadmapProject[] = [];
const EMPTY_ISSUES: RoadmapInProgressIssue[] = [];

export function useRoadmap(projectSlug: string | null = null, demoMode = false) {
  const refreshInterval = usePollingInterval("roadmap");
  const key = buildUrl(ROUTE, {
    project: projectSlug,
    ...(demoMode ? { demo: "1" } : {}),
  });

  const { data, error, isLoading, mutate } = useSWR<RoadmapResponse>(key, apiFetcher, {
    refreshInterval,
    shouldRetryOnError: false,
  });

  const refetch = useCallback(async () => {
    const forceUrl = buildUrl(ROUTE, {
      project: projectSlug,
      refresh: "1",
      ...(demoMode ? { demo: "1" } : {}),
    });
    const fresh = await apiFetcher<RoadmapResponse>(forceUrl);
    await mutate(fresh, { revalidate: false });
  }, [projectSlug, demoMode, mutate]);

  return {
    projects: data?.projects ?? EMPTY_PROJECTS,
    inProgressIssues: data?.inProgressIssues ?? EMPTY_ISSUES,
    configured: data?.configured ?? false,
    fetchedAt: data?._fetchedAt ?? null,
    loading: isLoading && !error,
    error: error?.message ?? data?.error ?? null,
    refetch,
  };
}
