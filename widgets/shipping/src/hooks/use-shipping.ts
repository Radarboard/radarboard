"use client";

import { apiFetcher, buildUrl } from "@radarboard/hooks/fetcher";
import { useEffectiveTimeZone } from "@radarboard/hooks/use-effective-timezone";
import { usePollingInterval } from "@radarboard/hooks/use-polling-interval";
import { integrationRoute } from "@radarboard/types/api-routes";
import type { TimeRange } from "@radarboard/types/dashboard";
import type { ShippingItem } from "@radarboard/types/shipping";
import { useCallback } from "react";
import useSWR from "swr";

const ROUTE = integrationRoute("shipping", "data");

interface ShippingResponse {
  configured: boolean;
  items: ShippingItem[];
  _fetchedAt?: number;
  error?: string;
}

const EMPTY_SHIPPING_ITEMS: ShippingItem[] = [];

export function useShipping(projectSlug: string | null = null, timeRange: TimeRange = "30d") {
  const effectiveTimezone = useEffectiveTimeZone();
  const refreshInterval = usePollingInterval("shipping");
  const key = buildUrl(ROUTE, {
    project: projectSlug,
    range: timeRange,
    timezone: effectiveTimezone,
  });

  const { data, error, isLoading, mutate } = useSWR<ShippingResponse>(key, apiFetcher, {
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
    const fresh = await apiFetcher<ShippingResponse>(forceUrl);
    await mutate(fresh, { revalidate: false });
  }, [projectSlug, timeRange, effectiveTimezone, mutate]);

  return {
    items: data?.items ?? EMPTY_SHIPPING_ITEMS,
    configured: data?.configured ?? false,
    fetchedAt: data?._fetchedAt ?? null,
    loading: isLoading && !error,
    error: error?.message ?? data?.error ?? null,
    refetch,
  };
}
