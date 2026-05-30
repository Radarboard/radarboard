"use client";

/**
 * __WIDGET_NAME__ — Data-fetching hook
 *
 * SWR-based hook for fetching and caching widget data.
 */

import { usePollingInterval } from "@radarboard/hooks/use-polling-interval";
import useSWR from "swr";
import { ROUTES } from "../routes";
import type { __WIDGET_PASCAL__Data } from "../types";

async function fetcher(url: string): Promise<__WIDGET_PASCAL__Data> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
  return res.json() as Promise<__WIDGET_PASCAL__Data>;
}

export function use__WIDGET_PASCAL__(projectSlug: string | null) {
  const refreshInterval = usePollingInterval("__WIDGET_KEBAB__");
  const url = projectSlug
    ? `${ROUTES.__WIDGET_CAMEL__}?project=${projectSlug}`
    : ROUTES.__WIDGET_CAMEL__;

  const { data, error, isLoading, mutate } = useSWR<__WIDGET_PASCAL__Data>(url, fetcher, {
    refreshInterval,
  });

  return {
    data: data ?? null,
    error: error ?? null,
    isLoading,
    refetch: () => mutate(),
  };
}
