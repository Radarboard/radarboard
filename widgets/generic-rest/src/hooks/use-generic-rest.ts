"use client";

/**
 * Generic REST — Data-fetching hook
 *
 * Fetches an integration's data source (via the `integrationRoute` helper) for
 * whatever integration + action the widget is configured with. When no
 * integration is configured the SWR key is null, so nothing is fetched.
 */

import { usePollingInterval } from "@radarboard/hooks/use-polling-interval";
import { integrationRoute } from "@radarboard/types/api-routes";
import { useCallback } from "react";
import useSWR from "swr";
import type { GenericRestData } from "../types";

async function fetcher(url: string): Promise<GenericRestData> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
  return res.json() as Promise<GenericRestData>;
}

function buildKey(integrationId: string, action: string, projectSlug: string | null): string {
  const base = integrationRoute(integrationId, action || "data");
  const params = new URLSearchParams();
  if (projectSlug) params.set("project", projectSlug);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export function useGenericRest(
  integrationId: string | null,
  action: string,
  projectSlug: string | null
) {
  const refreshInterval = usePollingInterval("generic-rest");
  const key = integrationId ? buildKey(integrationId, action, projectSlug) : null;

  const { data, error, isLoading, mutate } = useSWR<GenericRestData>(key, fetcher, {
    refreshInterval,
    shouldRetryOnError: false,
  });

  const refetch = useCallback(async () => {
    await mutate();
  }, [mutate]);

  return {
    data: data ?? null,
    error: error ?? null,
    isLoading,
    refetch,
  };
}
