"use client";

import { usePollingInterval } from "@radarboard/hooks/use-polling-interval";
import { useCallback, useMemo } from "react";
import useSWR from "swr";
import { ROUTES } from "../routes";
import type { NpmDownloadsConfig, NpmDownloadsData, NpmDownloadsRange } from "../types";

async function fetchNpmData(url: string): Promise<NpmDownloadsData> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`npm API error: ${res.status}`);
  return res.json() as Promise<NpmDownloadsData>;
}

function appendPackageFilters(searchParams: URLSearchParams, config: NpmDownloadsConfig) {
  for (const pattern of config.includePackages ?? []) {
    if (pattern.trim().length > 0) searchParams.append("include", pattern);
  }

  for (const pattern of config.excludePackages ?? []) {
    if (pattern.trim().length > 0) searchParams.append("exclude", pattern);
  }
}

function appendRange(searchParams: URLSearchParams, range: NpmDownloadsRange) {
  searchParams.set("range", range);
}

export function useNpmDownloads(
  _projectSlug: string | null,
  config: NpmDownloadsConfig,
  range: NpmDownloadsRange
) {
  const refreshInterval = usePollingInterval("npm-downloads");
  const filterKey = useMemo(
    () =>
      JSON.stringify({
        includePackages: config.includePackages ?? [],
        excludePackages: config.excludePackages ?? [],
      }),
    [config.excludePackages, config.includePackages]
  );
  const filterConfig = useMemo(() => JSON.parse(filterKey) as NpmDownloadsConfig, [filterKey]);
  const params = useMemo(() => {
    const next = new URLSearchParams();
    appendPackageFilters(next, filterConfig);
    appendRange(next, range);
    return next;
  }, [filterConfig, range]);
  const key = params.size > 0 ? `${ROUTES.npmDownloads}?${params.toString()}` : ROUTES.npmDownloads;

  const {
    data: rawData,
    error,
    isLoading,
    mutate,
  } = useSWR<NpmDownloadsData>(key, fetchNpmData, {
    refreshInterval,
  });

  const configured = Array.isArray(rawData?.packages);
  const data = configured ? rawData : null;

  const refetch = useCallback(async () => {
    const forceParams = new URLSearchParams();
    appendPackageFilters(forceParams, filterConfig);
    appendRange(forceParams, range);
    forceParams.set("refresh", "1");
    const fresh = await fetchNpmData(`${ROUTES.npmDownloads}?${forceParams.toString()}`);
    await mutate(fresh, { revalidate: false });
  }, [filterConfig, mutate, range]);

  return {
    configured,
    data,
    fetchedAt: rawData?._fetchedAt ?? null,
    loading: isLoading,
    error: error?.message ?? null,
    refetch,
  };
}
