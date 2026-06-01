"use client";

import { apiFetcher, buildUrl } from "@radarboard/hooks/fetcher";
import { useEffectiveTimeZone } from "@radarboard/hooks/use-effective-timezone";
import { usePollingInterval } from "@radarboard/hooks/use-polling-interval";
import { integrationRoute } from "@radarboard/types/api-routes";
import type { DisplayCurrency, TimeRange } from "@radarboard/types/dashboard";
import type { RevenueOverview, RevenueSeries } from "@radarboard/types/revenue";
import { formatTimeAgo } from "@radarboard/utils/format-time-ago";
import { useCallback, useMemo } from "react";
import useSWR from "swr";

interface RevenueRaw {
  overview: { id: string; name: string; value: number; unit: string }[];
  newCustomers: number;
  activeUsers: number;
}

interface RevenueResponse {
  configured: boolean;
  ctaLabel?: string;
  ctaTarget?: string;
  projectMappingRequired?: boolean;
  setupMessage?: string;
  revenue?: RevenueOverview;
  revenueSeries?: RevenueSeries[];
  raw?: RevenueRaw;
  _fetchedAt?: number;
  error?: string;
}

type RevenueUnconfiguredState = Omit<RevenueResponse, "revenue" | "revenueSeries" | "raw"> & {
  configured: false;
};

interface StripeRevenueResponse {
  configured: boolean;
  mrr?: number;
  revenueThisMonth?: number;
  revenueLastMonth?: number;
  activeSubscriptions?: number;
  newSubscriptions?: number;
  churnedSubscriptions?: number;
  currency?: string;
  _fetchedAt?: number;
  error?: string;
}

interface StripeDailyRevenuePoint {
  date: string;
  amount: number;
  count: number;
}

interface StripeCharge {
  id: string;
  amount: number;
  currency: string;
  status: "succeeded" | "pending" | "failed";
  created: number;
  description: string | null;
  customer: string | null;
}

function normalizeCurrency(value: string | undefined, fallback: DisplayCurrency): string {
  return value?.toUpperCase() || fallback;
}

async function fetchRevenuePayload(
  providerIntegrationId: string,
  params: Record<string, string | null | undefined>
): Promise<RevenueResponse> {
  const route = integrationRoute(providerIntegrationId, "data");
  const requestUrl = buildUrl(route, params);

  if (providerIntegrationId !== "stripe") {
    return apiFetcher<RevenueResponse>(requestUrl);
  }

  const [summary, dailyRevenue, charges] = await Promise.all([
    apiFetcher<StripeRevenueResponse>(requestUrl),
    apiFetcher<StripeDailyRevenuePoint[]>(integrationRoute("stripe", "daily-revenue")),
    apiFetcher<StripeCharge[]>(integrationRoute("stripe", "charges")),
  ]);

  const currency = normalizeCurrency(
    summary.currency,
    (params.currency as DisplayCurrency) ?? "USD"
  );
  const sparklineData = dailyRevenue.map((point) => ({ date: point.date, value: point.amount }));
  const lastCharge = charges[0] ?? null;

  return {
    configured: summary.configured,
    revenue: {
      grossRevenue: {
        value: summary.revenueThisMonth ?? 0,
        previousValue: summary.revenueLastMonth ?? 0,
        currency,
        sparklineData,
      },
      mrr: {
        value: summary.mrr ?? 0,
        previousValue: summary.mrr ?? 0,
        currency,
        sparklineData,
      },
      netRevenue: {
        value: summary.revenueThisMonth ?? 0,
        previousValue: summary.revenueLastMonth ?? 0,
        currency,
        sparklineData,
      },
      lastPayment: {
        amount: lastCharge?.amount ?? 0,
        currency: normalizeCurrency(
          lastCharge?.currency,
          (params.currency as DisplayCurrency) ?? "USD"
        ),
        country: "",
        countryCode: "",
        projectName: "Stripe",
        projectColor: "",
        timeAgo: lastCharge ? formatTimeAgo(new Date(lastCharge.created * 1000).toISOString()) : "",
      },
    },
    revenueSeries: [{ projectName: "Stripe", projectColor: "", data: sparklineData }],
    raw: {
      overview: [
        { id: "mrr", name: "MRR", value: summary.mrr ?? 0, unit: currency },
        {
          id: "revenue_this_month",
          name: "Revenue This Month",
          value: summary.revenueThisMonth ?? 0,
          unit: currency,
        },
        {
          id: "revenue_last_month",
          name: "Revenue Last Month",
          value: summary.revenueLastMonth ?? 0,
          unit: currency,
        },
      ],
      newCustomers: summary.newSubscriptions ?? 0,
      activeUsers: summary.activeSubscriptions ?? 0,
    },
    _fetchedAt: summary._fetchedAt,
    error: summary.error,
  };
}

export function useRevenue(
  providerIntegrationId: string,
  timeRange: TimeRange = "30d",
  currency: DisplayCurrency = "USD",
  projectSlug: string | null = null,
  demoMode = false
) {
  const effectiveTimezone = useEffectiveTimeZone();
  const refreshInterval = usePollingInterval("revenue");
  const requestParams = useMemo(
    () => ({
      range: timeRange,
      currency,
      project: projectSlug,
      timezone: effectiveTimezone,
      ...(demoMode ? { demo: "1" } : {}),
    }),
    [currency, effectiveTimezone, demoMode, projectSlug, timeRange]
  );
  const key = buildUrl(integrationRoute(providerIntegrationId, "data"), requestParams);

  const { data, error, isLoading, mutate } = useSWR<RevenueResponse>(
    key,
    () => fetchRevenuePayload(providerIntegrationId, requestParams),
    { refreshInterval, shouldRetryOnError: false }
  );

  const refetch = useCallback(async () => {
    const fresh = await fetchRevenuePayload(providerIntegrationId, {
      ...requestParams,
      refresh: "1",
    });
    await mutate(fresh, { revalidate: false });
  }, [providerIntegrationId, requestParams, mutate]);

  return {
    data: data?.configured === false ? (data as RevenueUnconfiguredState) : (data?.revenue ?? null),
    series: data?.revenueSeries ?? [],
    raw: data?.raw ?? null,
    configured: data?.configured ?? false,
    fetchedAt: data?._fetchedAt ?? null,
    loading: isLoading && !error,
    error: error?.message ?? data?.error ?? null,
    refetch,
  };
}
