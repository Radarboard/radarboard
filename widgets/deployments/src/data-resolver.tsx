"use client";

import { useDashboard } from "@radarboard/hooks/use-dashboard";
import { formatTimeAgo } from "@radarboard/utils/format-time-ago";
import {
  type DataSourceResolverProps,
  registerTemplateDataSource,
  reportResolverState,
} from "@radarboard/widget-sdk/data-source-registry";
import { useCallback, useEffect, useMemo } from "react";
import { useVercelDeployments } from "./hooks/use-deployments";
import { useVercelDomains } from "./hooks/use-domains";

function stateColor(state: string | null): string {
  if (state === "READY") return "#3fb950";
  if (state === "ERROR") return "#e63946";
  return "#f5c542";
}

function formatFrameworkLabel(fw: string | null): string {
  if (!fw) return "Other";
  const map: Record<string, string> = {
    nextjs: "Next.js",
    astro: "Astro",
    remix: "Remix",
    vite: "Vite",
    nuxtjs: "Nuxt",
    svelte: "SvelteKit",
    gatsby: "Gatsby",
  };
  return map[fw] ?? fw;
}

function formatDomainStatus(domain: { verified: boolean }): string {
  return domain.verified ? "verified" : "unverified";
}

function formatDurationSeconds(ms: number): number {
  if (ms <= 0) return 0;
  return Math.round(ms / 1000);
}

function buildDeploymentBuckets(
  deployments: Array<{ created: number; state: string }>,
  days: number
) {
  const now = Date.now();
  const startDate = now - (days - 1) * 86_400_000;
  const buckets = Array.from({ length: days }, (_, index) => {
    const dateId = new Date(startDate + index * 86_400_000).toISOString().slice(0, 10);
    return {
      id: dateId,
      title: `${dateId}: 0 ok, 0 failed, 0 building`,
      values: { ready: 0, error: 0, building: 0 },
    };
  });

  for (const deployment of deployments) {
    const daysAgo = Math.floor((now - deployment.created) / 86_400_000);
    const bucketIndex = days - 1 - daysAgo;
    const bucket = bucketIndex >= 0 && bucketIndex < days ? buckets[bucketIndex] : undefined;
    if (!bucket) continue;

    if (deployment.state === "READY") bucket.values.ready++;
    else if (deployment.state === "ERROR") bucket.values.error++;
    else bucket.values.building++;
  }

  for (const bucket of buckets) {
    bucket.title = `${bucket.id}: ${bucket.values.ready} ok, ${bucket.values.error} failed, ${bucket.values.building} building`;
  }

  return buckets;
}

function VercelResolver({ projectSlug, onState }: DataSourceResolverProps) {
  const { timeRange } = useDashboard();
  const deploymentsData = useVercelDeployments(projectSlug, timeRange);
  const domainsData = useVercelDomains(projectSlug);

  const fetchedAt = useMemo(() => {
    if (deploymentsData.fetchedAt && domainsData.fetchedAt) {
      return Math.min(deploymentsData.fetchedAt, domainsData.fetchedAt);
    }

    return deploymentsData.fetchedAt ?? domainsData.fetchedAt ?? null;
  }, [deploymentsData.fetchedAt, domainsData.fetchedAt]);

  const refetch = useCallback(async () => {
    await Promise.all([deploymentsData.refetch(), domainsData.refetch()]);
  }, [deploymentsData.refetch, domainsData.refetch]);

  const resolvedData = useMemo(() => {
    const totalDeploys = deploymentsData.deployments.length;
    const failedDeploys = deploymentsData.deployments.filter(
      (deployment) => deployment.state === "ERROR"
    ).length;
    const readyDeploys = deploymentsData.deployments.filter(
      (deployment) => deployment.state === "READY"
    ).length;
    const successRate = totalDeploys > 0 ? Math.round((readyDeploys / totalDeploys) * 100) : 0;

    const completedBuilds = deploymentsData.deployments.filter(
      (deployment) => deployment.buildDuration > 0
    );
    const durations = completedBuilds.map((deployment) => deployment.buildDuration);
    const averageBuildDuration =
      durations.length > 0
        ? Math.round(durations.reduce((sum, duration) => sum + duration, 0) / durations.length)
        : 0;
    const fastestBuildDuration = durations.length > 0 ? Math.min(...durations) : 0;
    const slowestBuildDuration = durations.length > 0 ? Math.max(...durations) : 0;

    const domainTotal = domainsData.domains.length;
    const verifiedDomains = domainsData.domains.filter((domain) => domain.verified).length;

    return {
      configured: deploymentsData.configured && domainsData.configured,
      deployments: deploymentsData.deployments.map((deployment) => ({
        ...deployment,
        commitMessage: deployment.commitMessage ?? "No commit message",
        stateColor: stateColor(deployment.state),
        timeAgo: formatTimeAgo(new Date(deployment.created).toISOString()),
        deploymentUrl: deployment.inspectorUrl.startsWith("http")
          ? deployment.inspectorUrl
          : `https://${deployment.inspectorUrl}`,
      })),
      deploymentMetrics: {
        total: totalDeploys,
        successRate,
        failed: failedDeploys,
      },
      deploymentBuckets7d: buildDeploymentBuckets(deploymentsData.deployments, 7),
      deploymentBuckets30d: buildDeploymentBuckets(deploymentsData.deployments, 30),
      buildMetrics: {
        averageBuildDuration: formatDurationSeconds(averageBuildDuration),
        fastestBuildDuration: formatDurationSeconds(fastestBuildDuration),
        slowestBuildDuration: formatDurationSeconds(slowestBuildDuration),
      },
      buildDurationBars: completedBuilds.slice(0, 20).map((deployment) => ({
        name: deployment.commitMessage ?? deployment.id,
        value: deployment.buildDuration,
      })),
      domains: domainsData.domains.map((domain) => ({
        ...domain,
        statusLabel: formatDomainStatus(domain),
      })),
      domainMetrics: {
        total: domainTotal,
        verified: verifiedDomains,
        unverified: domainTotal - verifiedDomains,
      },
      projects: deploymentsData.projects.map((project) => ({
        ...project,
        frameworkLabel: formatFrameworkLabel(project.framework),
        stateColor: stateColor(project.latestProductionState),
        deployedAgo: project.latestProductionReady
          ? formatTimeAgo(new Date(project.latestProductionReady).toISOString())
          : "never",
      })),
    };
  }, [
    deploymentsData.configured,
    deploymentsData.deployments,
    deploymentsData.projects,
    domainsData.configured,
    domainsData.domains,
  ]);

  useEffect(() => {
    reportResolverState(onState, {
      data: resolvedData,
      fetchedAt,
      refetch,
      loading: deploymentsData.loading || domainsData.loading,
      error: deploymentsData.error ?? domainsData.error ?? null,
    });
  }, [
    deploymentsData.error,
    deploymentsData.loading,
    domainsData.error,
    domainsData.loading,
    fetchedAt,
    onState,
    refetch,
    resolvedData,
  ]);

  return null;
}

registerTemplateDataSource("vercel", VercelResolver);
