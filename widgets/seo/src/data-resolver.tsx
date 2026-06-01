"use client";

import { useDemoMode } from "@radarboard/hooks/use-demo-mode";
import {
  type DataSourceResolverProps,
  registerTemplateDataSource,
  reportResolverState,
} from "@radarboard/widget-sdk/data-source-registry";
import { useEffect, useMemo } from "react";
import { useSeo } from "./hooks/use-seo";

function getSeoQueryKey(query: { query: string; siteUrl?: string }) {
  return `${query.query}::${query.siteUrl ?? "default"}`;
}

type TrendPoint = { date: string; value: number };

function buildOverviewTrend(data: {
  clicksTrend?: TrendPoint[];
  impressionsTrend?: TrendPoint[];
  ctrTrend?: TrendPoint[];
  positionTrend?: TrendPoint[];
}) {
  const clicks = Array.isArray(data.clicksTrend) ? data.clicksTrend : [];
  const impressions = Array.isArray(data.impressionsTrend) ? data.impressionsTrend : [];
  const ctr = Array.isArray(data.ctrTrend) ? data.ctrTrend : [];
  const position = Array.isArray(data.positionTrend) ? data.positionTrend : [];

  const map = new Map<
    string,
    { clicks: number; impressions: number; ctr: number; position: number }
  >();
  for (const p of clicks) map.set(p.date, { clicks: p.value, impressions: 0, ctr: 0, position: 0 });
  for (const p of impressions) {
    const row = map.get(p.date);
    if (row) row.impressions = p.value;
    else map.set(p.date, { clicks: 0, impressions: p.value, ctr: 0, position: 0 });
  }
  for (const p of ctr) {
    const row = map.get(p.date);
    if (row) row.ctr = p.value;
    else map.set(p.date, { clicks: 0, impressions: 0, ctr: p.value, position: 0 });
  }
  for (const p of position) {
    const row = map.get(p.date);
    if (row) row.position = p.value;
    else map.set(p.date, { clicks: 0, impressions: 0, ctr: 0, position: p.value });
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, row]) => ({ date, ...row }));
}

function SeoResolver({ projectSlug, timeRange = "30d", onState }: DataSourceResolverProps) {
  const { isDemoMode } = useDemoMode();
  const { data, fetchedAt, loading, error, refetch } = useSeo(
    projectSlug,
    null,
    timeRange,
    isDemoMode
  );

  const resolvedData = useMemo(() => {
    if (!data) return data;
    if ((data as { configured?: boolean }).configured === false || !("queries" in data)) {
      return data;
    }

    return {
      ...data,
      overviewTrend: data.overviewTrend ?? buildOverviewTrend(data),
      queries: data.queries.map((query) => ({
        ...query,
        detailKey: getSeoQueryKey(query),
      })),
    };
  }, [data]);

  useEffect(() => {
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

registerTemplateDataSource("google-search-console", SeoResolver);
