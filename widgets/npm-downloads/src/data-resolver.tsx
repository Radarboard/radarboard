"use client";

import { usePollingInterval } from "@radarboard/hooks/use-polling-interval";
import {
  type DataSourceResolverProps,
  registerTemplateDataSource,
  reportResolverState,
} from "@radarboard/widget-sdk/data-source-registry";
import { useCallback, useEffect, useMemo } from "react";
import useSWR from "swr";
import { ROUTES } from "./routes";

interface NpmPackageData {
  name: string;
  weeklyDownloads: number;
  monthlyDownloads: number;
  version: string;
}

interface NpmDownloadsData {
  packages: NpmPackageData[];
  totalWeekly: number;
  totalMonthly: number;
  _fetchedAt?: number;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Template API error: ${res.status}`);
  return res.json() as Promise<T>;
}

function appendNpmFilterParams(searchParams: URLSearchParams, config?: Record<string, unknown>) {
  const includePackages = Array.isArray(config?.includePackages)
    ? (config.includePackages as unknown[])
    : [];
  const excludePackages = Array.isArray(config?.excludePackages)
    ? (config.excludePackages as unknown[])
    : [];

  for (const pattern of includePackages) {
    if (typeof pattern === "string" && pattern.trim().length > 0) {
      searchParams.append("include", pattern);
    }
  }

  for (const pattern of excludePackages) {
    if (typeof pattern === "string" && pattern.trim().length > 0) {
      searchParams.append("exclude", pattern);
    }
  }
}

function NpmDownloadsResolver({
  projectSlug: _projectSlug,
  config,
  onState,
}: DataSourceResolverProps) {
  const refreshInterval = usePollingInterval("npm-downloads");
  // _projectSlug is unused for npm-downloads but required by DataSourceResolverProps
  const filterConfig = (config ?? {}) as Record<string, unknown>;
  const filterKey = useMemo(
    () =>
      JSON.stringify({
        includePackages: Array.isArray(filterConfig.includePackages)
          ? filterConfig.includePackages
          : [],
        excludePackages: Array.isArray(filterConfig.excludePackages)
          ? filterConfig.excludePackages
          : [],
        npmRange: typeof filterConfig.npmRange === "string" ? filterConfig.npmRange : "30d",
      }),
    [filterConfig.excludePackages, filterConfig.includePackages, filterConfig.npmRange]
  );
  const resolvedFilterConfig = useMemo(
    () => JSON.parse(filterKey) as Record<string, unknown>,
    [filterKey]
  );
  const params = useMemo(() => {
    const next = new URLSearchParams();
    appendNpmFilterParams(next, resolvedFilterConfig);
    if (typeof resolvedFilterConfig.npmRange === "string") {
      next.set("range", resolvedFilterConfig.npmRange);
    }
    return next;
  }, [resolvedFilterConfig]);
  const key = params.size > 0 ? `${ROUTES.npmDownloads}?${params.toString()}` : ROUTES.npmDownloads;

  const { data, error, isLoading, mutate } = useSWR<NpmDownloadsData>(key, fetchJson, {
    refreshInterval,
  });

  const refetch = useCallback(async () => {
    const forceParams = new URLSearchParams();
    appendNpmFilterParams(forceParams, resolvedFilterConfig);
    if (typeof resolvedFilterConfig.npmRange === "string") {
      forceParams.set("range", resolvedFilterConfig.npmRange);
    }
    forceParams.set("refresh", "1");
    const fresh = await fetchJson<NpmDownloadsData>(
      `${ROUTES.npmDownloads}?${forceParams.toString()}`
    );
    await mutate(fresh, { revalidate: false });
  }, [mutate, resolvedFilterConfig]);

  const rawConfigured = (data as Record<string, unknown> | undefined)?.configured;

  const resolvedData = useMemo(
    () => ({
      configured: rawConfigured !== false,
      packages: (data?.packages ?? []).map((pkg) => ({
        ...pkg,
        packageUrl: `https://www.npmjs.com/package/${pkg.name}`,
        versionLabel: `v${pkg.version}`,
        weeklyDownloadsLabel: `${pkg.weeklyDownloads}/w`,
      })),
      totalWeekly: data?.totalWeekly ?? 0,
      totalMonthly: data?.totalMonthly ?? 0,
    }),
    [data, rawConfigured]
  );

  useEffect(() => {
    reportResolverState(onState, {
      data: resolvedData,
      fetchedAt: data?._fetchedAt ?? null,
      refetch,
      loading: isLoading,
      error: error?.message ?? null,
    });
  }, [data?._fetchedAt, error, isLoading, onState, refetch, resolvedData]);

  return null;
}

registerTemplateDataSource("npm-downloads", NpmDownloadsResolver);
