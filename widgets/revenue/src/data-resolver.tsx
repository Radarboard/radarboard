"use client";

import { useDashboard } from "@radarboard/hooks/use-dashboard";
import type { RevenueOverview } from "@radarboard/types/revenue";
import { calculateChange } from "@radarboard/utils/format-percent";
import {
  type DataSourceResolverProps,
  registerTemplateDataSource,
  reportResolverState,
} from "@radarboard/widget-sdk/data-source-registry";
import { useEffect, useMemo, useRef } from "react";
import { resolveRevenueProviderIntegrationId } from "./capabilities";
import { useRevenue } from "./hooks/use-revenue";

function aggregateRevenueTrend(
  series: Array<{ projectName: string; data: Array<{ date: string; value: number }> }>
) {
  const totalsByDate = new Map<string, number>();

  for (const projectSeries of series) {
    for (const point of projectSeries.data) {
      totalsByDate.set(point.date, (totalsByDate.get(point.date) ?? 0) + point.value);
    }
  }

  return Array.from(totalsByDate.entries())
    .map(([date, value]) => ({ date, value }))
    .sort((left, right) => left.date.localeCompare(right.date));
}

function RevenueResolver({ projectSlug, config, onState }: DataSourceResolverProps) {
  const { timeRange, currency, projects } = useDashboard();
  const providerIntegrationId = resolveRevenueProviderIntegrationId(
    projects,
    projectSlug,
    typeof (config as Record<string, unknown> | undefined)?.providerIntegrationId === "string"
      ? ((config as Record<string, unknown>).providerIntegrationId as string)
      : null
  );
  const { data, series, raw, configured, fetchedAt, loading, error, refetch } = useRevenue(
    providerIntegrationId,
    timeRange,
    currency,
    projectSlug
  );

  const resolvedData = useMemo(() => {
    if ((data as { configured?: boolean } | null)?.configured === false) {
      return data;
    }

    const revenue = data as RevenueOverview | null;

    return {
      configured,
      overview: revenue,
      series,
      raw,
      trend: aggregateRevenueTrend(series),
      grossRevenue: revenue?.grossRevenue ?? null,
      grossRevenueChange: revenue
        ? calculateChange(revenue.grossRevenue.value, revenue.grossRevenue.previousValue)
        : null,
      mrr: revenue?.mrr ?? null,
      mrrChange: revenue ? calculateChange(revenue.mrr.value, revenue.mrr.previousValue) : null,
      netRevenue: revenue?.netRevenue ?? null,
      netRevenueChange: revenue
        ? calculateChange(revenue.netRevenue.value, revenue.netRevenue.previousValue)
        : null,
      breakdown: revenue?.breakdown ?? null,
      payments: revenue?.lastPayment
        ? [
            {
              id: "last-payment",
              projectName: revenue.lastPayment.projectName,
              country: revenue.lastPayment.country,
              amount: revenue.lastPayment.amount,
              currency: revenue.lastPayment.currency,
              timeAgo: revenue.lastPayment.timeAgo,
              projectColor: revenue.lastPayment.projectColor,
            },
          ]
        : [],
    };
  }, [configured, data, raw, series]);
  const previousResolvedSnapshot = useRef<string | null>(null);

  useEffect(() => {
    // Include loading and error in the snapshot so state changes propagate
    // even when resolvedData hasn't changed (e.g. loading → error transition
    // where the data stays null/empty).
    const snapshot = JSON.stringify({ d: resolvedData, l: loading, e: error });
    if (snapshot === previousResolvedSnapshot.current) {
      return;
    }
    previousResolvedSnapshot.current = snapshot;

    reportResolverState(onState, {
      data: resolvedData,
      fetchedAt,
      refetch,
      loading,
      error,
    });
  }, [resolvedData, fetchedAt, refetch, loading, error, onState]);

  return null;
}

registerTemplateDataSource("revenue", RevenueResolver);
