"use client";

import { usePollingInterval } from "@radarboard/hooks/use-polling-interval";
import { formatNumber } from "@radarboard/utils/format-number";
import {
  type DataSourceResolverProps,
  registerTemplateDataSource,
  reportResolverState,
} from "@radarboard/widget-sdk/data-source-registry";
import { useCallback, useEffect, useMemo } from "react";
import useSWR from "swr";
import { useGitHubStarsHistory } from "./hooks/use-github-stars-history";
import { buildGitHubStarsUrl, extractSelectedReposFromConfig } from "./repo-query";
import type { GitHubStarsAddedPoint, GitHubStarsData, GitHubStarsHistoryPoint } from "./types";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Template API error: ${res.status}`);
  return res.json() as Promise<T>;
}

function GitHubStarsResolver({ projectSlug, timeRange, config, onState }: DataSourceResolverProps) {
  const refreshInterval = usePollingInterval("github-stars");
  const selectedRepos = useMemo(() => extractSelectedReposFromConfig(config), [config]);
  const key = buildGitHubStarsUrl(projectSlug, selectedRepos);
  const resolvedRange = timeRange ?? "all";

  const { data, error, isLoading, mutate } = useSWR<GitHubStarsData>(key, fetchJson, {
    refreshInterval,
  });
  const { data: historyData, refetch: refetchHistory } = useGitHubStarsHistory(
    projectSlug,
    selectedRepos,
    resolvedRange
  );

  const refetch = useCallback(async () => {
    const [fresh] = await Promise.all([
      fetchJson<GitHubStarsData>(buildGitHubStarsUrl(projectSlug, selectedRepos, true)),
      refetchHistory(),
    ]);
    await mutate(fresh, { revalidate: false });
  }, [mutate, projectSlug, refetchHistory, selectedRepos]);

  const repoHistoryMap = useMemo(
    () =>
      new Map(
        Object.entries(historyData?.repoDaily ?? {}).map(([repoKey, points]) => [repoKey, points])
      ),
    [historyData?.repoDaily]
  );
  const repoAddedMap = useMemo(
    () =>
      new Map(
        Object.entries(historyData?.repoAddedDaily ?? {}).map(([repoKey, points]) => [
          repoKey,
          points,
        ])
      ),
    [historyData?.repoAddedDaily]
  );
  const repoMetaMap = useMemo(
    () => new Map((historyData?.repos ?? []).map((repo) => [repo.repoKey, repo])),
    [historyData?.repos]
  );

  const getRepoHistory = useCallback(
    (repoFullName: string) => repoHistoryMap.get(repoFullName.toLowerCase()) ?? [],
    [repoHistoryMap]
  );
  const getRepoAdded = useCallback(
    (repoFullName: string) => repoAddedMap.get(repoFullName.toLowerCase()) ?? [],
    [repoAddedMap]
  );

  // The API returns { configured: false } when GitHub credentials are missing.
  // We must pass this through so useAnySourceUnconfigured detects it.
  const rawConfigured = (data as Record<string, unknown> | undefined)?.configured;

  const resolvedData = useMemo(() => {
    const resolveDeltaColor = (delta: number | null): string | null => {
      if (delta == null || delta <= 0) return null;
      if (delta >= 100) return "#4ade80";
      if (delta >= 25) return "#86efac";
      if (delta >= 5) return "#f5c451";
      return "#7dd3fc";
    };

    const formatDeltaLabel = (delta: number | null): string => {
      if (delta == null) return "0";
      if (delta <= 0) return "0";
      return `+${formatNumber(delta)}`;
    };

    const aggregateDaily = historyData?.aggregateDaily ?? [];
    const aggregateAddedDaily = historyData?.aggregateAddedDaily ?? [];
    const allReposCovered = (historyData?.repos ?? []).every(
      (repo) => repo.coverageStatus === "full"
    );
    const aggregateGrossDelta = aggregateAddedDaily.reduce((sum, point) => sum + point.count, 0);
    const aggregateFallbackDelta = aggregateDaily.reduce(
      (sum, point) => sum + point.starsGained,
      0
    );
    const aggregateDelta =
      aggregateAddedDaily.length > 0 ? aggregateGrossDelta : aggregateFallbackDelta;
    const repos = [...(data?.repos ?? [])]
      .map((repo) => {
        const historyPoints = getRepoHistory(repo.fullName);
        const addedPoints = getRepoAdded(repo.fullName);
        const repoMeta = repoMetaMap.get(repo.fullName.toLowerCase());
        const grossDelta = addedPoints.reduce(
          (sum, point: GitHubStarsAddedPoint) => sum + point.count,
          0
        );
        const fallbackDelta = historyPoints.reduce(
          (sum, point: GitHubStarsHistoryPoint) => sum + point.starsGained,
          0
        );
        const delta = addedPoints.length > 0 ? grossDelta : fallbackDelta;

        return {
          ...repo,
          repoKey: repo.fullName.toLowerCase(),
          repoUrl: repo.htmlUrl,
          historyPoints,
          addedPoints,
          starsDelta: delta,
          starsDeltaLabel: formatDeltaLabel(delta),
          starsDeltaColor: resolveDeltaColor(delta),
          backfillStatus: repoMeta?.backfillStatus,
          nextPage: repoMeta?.nextPage ?? null,
          historyMode: repoMeta?.historyMode,
          lastError: repoMeta?.lastError ?? null,
          trackingStartedAt: repoMeta?.trackingStartedAt ?? null,
          lastWebhookAt: repoMeta?.lastWebhookAt ?? null,
          coverageStatus: repoMeta?.coverageStatus,
          coverageMessage: repoMeta?.coverageMessage ?? null,
        };
      })
      .sort((left, right) => {
        if (resolvedRange !== "all") {
          const deltaDiff = (right.starsDelta ?? 0) - (left.starsDelta ?? 0);
          if (deltaDiff !== 0) return deltaDiff;
        }

        if (right.stars !== left.stars) return right.stars - left.stars;
        return left.fullName.localeCompare(right.fullName);
      });

    return {
      configured: rawConfigured !== false,
      repos,
      totalStars: data?.totalStars ?? 0,
      totalForks: data?.totalForks ?? 0,
      totalStarsDelta: aggregateDelta,
      totalStarsDeltaLabel: formatDeltaLabel(aggregateDelta),
      totalStarsDeltaColor: resolveDeltaColor(aggregateDelta),
      totalStarsCoverageStatus: allReposCovered ? "full" : "partial",
      totalStarsCoverageMessage: allReposCovered
        ? null
        : (historyData?.repos.find((repo) => repo.coverageStatus !== "full")?.coverageMessage ??
          null),
      repoCount: repos.length,
      totalWatchers: repos.reduce((sum, repo) => sum + repo.watchers, 0),
      aggregateDaily,
      aggregateAddedDaily,
      starHistory: data?.starHistory ?? [],
    };
  }, [data, getRepoAdded, getRepoHistory, historyData, rawConfigured, repoMetaMap, resolvedRange]);

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

registerTemplateDataSource("github-stars", GitHubStarsResolver);
