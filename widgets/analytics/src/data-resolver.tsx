"use client";

import {
  type DataSourceResolverProps,
  registerTemplateDataSource,
  reportResolverState,
} from "@radarboard/widget-sdk/data-source-registry";
import { useEffect, useMemo } from "react";
import { useAnalytics } from "./hooks/use-analytics";

function getAnalyticsPageKey(page: { path: string; platformName?: string }) {
  return `${page.path}::${page.platformName ?? "default"}`;
}

function AnalyticsResolver({ projectSlug, timeRange = "30d", onState }: DataSourceResolverProps) {
  const { data, fetchedAt, loading, error, refetch } = useAnalytics(timeRange, projectSlug);
  const resolvedData = useMemo(() => {
    if (!data) return data;

    if ((data as { configured?: boolean }).configured === false || !("topPages" in data)) {
      return data;
    }

    return {
      ...data,
      topPages: data.topPages.map((page) => ({
        ...page,
        detailKey: getAnalyticsPageKey(page),
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

registerTemplateDataSource("analytics", AnalyticsResolver);
