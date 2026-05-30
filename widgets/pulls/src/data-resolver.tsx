"use client";

import {
  type DataSourceResolverProps,
  registerTemplateDataSource,
  reportResolverState,
} from "@radarboard/widget-sdk/data-source-registry";
import { useCallback, useEffect, useMemo } from "react";
import { useGithubOpenIssues } from "./hooks/use-github-open-issues";
import { useGithubOpenPrs } from "./hooks/use-github-open-prs";

function githubActivityAge(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function githubActivityAgeColor(iso: string): string {
  const days = (Date.now() - new Date(iso).getTime()) / 86_400_000;
  if (days > 30) return "#e63946";
  if (days > 7) return "#f5c542";
  return "#888";
}

const GITHUB_REPO_COLORS = ["#5b8af5", "#3fb950", "#f5c542", "#e63946", "#8b5cf6", "#f97316"];

function githubRepoColor(index: number): string {
  return GITHUB_REPO_COLORS[index % GITHUB_REPO_COLORS.length] ?? "#5b8af5";
}

function GitHubActivityResolver({
  projectSlug,
  timeRange = "30d",
  onState,
}: DataSourceResolverProps) {
  const prs = useGithubOpenPrs(projectSlug, timeRange);
  const issues = useGithubOpenIssues(projectSlug, timeRange);

  const fetchedAt = useMemo(() => {
    if (prs.fetchedAt && issues.fetchedAt) {
      return Math.min(prs.fetchedAt, issues.fetchedAt);
    }
    return prs.fetchedAt ?? issues.fetchedAt ?? null;
  }, [prs.fetchedAt, issues.fetchedAt]);

  const refetch = useCallback(async () => {
    await Promise.all([prs.refetch(), issues.refetch()]);
  }, [prs.refetch, issues.refetch]);

  const resolvedData = useMemo(() => {
    const repoOrder = Array.from(
      new Set([...prs.items.map((item) => item.repo), ...issues.items.map((item) => item.repo)])
    );
    const repoIndex = new Map(repoOrder.map((repo, index) => [repo, index]));

    return {
      prs: prs.items.map((item) => ({
        ...item,
        ageLabel: githubActivityAge(item.updatedAt),
        ageColor: githubActivityAgeColor(item.updatedAt),
        rowKind: "pull-request",
        repoColor: githubRepoColor(repoIndex.get(item.repo) ?? 0),
      })),
      issues: issues.items.map((item) => ({
        ...item,
        ageLabel: githubActivityAge(item.updatedAt),
        ageColor: githubActivityAgeColor(item.updatedAt),
        rowKind: "issue",
        repoColor: githubRepoColor(repoIndex.get(item.repo) ?? 0),
      })),
      prCount: prs.items.length,
      issueCount: issues.items.length,
      configured: prs.configured || issues.configured,
    };
  }, [issues.configured, issues.items, prs.configured, prs.items]);

  useEffect(() => {
    reportResolverState(onState, {
      data: resolvedData,
      fetchedAt,
      refetch,
      loading: prs.loading || issues.loading,
      error: prs.error ?? issues.error ?? null,
    });
  }, [
    fetchedAt,
    issues.error,
    issues.loading,
    onState,
    prs.error,
    prs.loading,
    refetch,
    resolvedData,
  ]);

  return null;
}

registerTemplateDataSource("github-activity", GitHubActivityResolver);
