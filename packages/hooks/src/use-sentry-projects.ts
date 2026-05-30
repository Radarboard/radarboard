"use client";

import { integrationRoute } from "@radarboard/types/api-routes";
import useSWR from "swr";
import { apiFetcher } from "./fetcher";
import { usePollingInterval } from "./use-polling-interval";

interface SentryProject {
  id: string;
  name: string;
  slug: string;
  platform: string | null;
  status: "active" | "disabled";
}

interface SentryProjectsResponse {
  configured: boolean;
  projects: SentryProject[];
  error?: string;
}

/**
 * Fetches the list of Sentry projects in the authenticated organization.
 * Used to populate the project slug dropdown in platform settings.
 */
export function useSentryProjects() {
  const refreshInterval = usePollingInterval("sentry-projects");
  const { data, error, isLoading } = useSWR<SentryProjectsResponse>(
    integrationRoute("sentry", "projects"),
    apiFetcher,
    {
      refreshInterval,
      revalidateOnFocus: false,
    }
  );

  return {
    projects: data?.projects ?? [],
    slugs: (data?.projects ?? []).map((p) => p.slug),
    configured: data?.configured ?? true,
    loading: isLoading,
    error: error?.message ?? data?.error ?? null,
  };
}
