"use client";

import { type ContributionData, ContributionGraph } from "@radarboard/ui/contribution-graph";
import { EmptyState } from "@radarboard/ui/empty-state";
import { Tooltip, TooltipContent, TooltipTrigger } from "@radarboard/ui/tooltip";
import { useWidgetCallbacks } from "@radarboard/widget-engine/hooks/use-widget-callbacks";
import type { WidgetTemplateConfig } from "@radarboard/widget-engine/templates";
import { WidgetNotConfigured } from "@radarboard/widget-engine/widget-not-configured";
import type { WidgetRenderProps } from "@radarboard/widget-sdk/widget-types";
import { type ReactElement, useMemo } from "react";
import { useGithubCommits } from "../hooks/use-github-commits";

export const COMMITS_TEMPLATE_CONFIG: WidgetTemplateConfig = {
  dataSources: [{ id: "github-activity" }],
  sections: [
    {
      type: "headline-stat",
      source: { sourceId: "github-activity", field: "total", format: "number" },
      label: "Total Commits",
    },
  ],
};

export function isTemplateConfig(config: unknown): config is WidgetTemplateConfig {
  if (!config || typeof config !== "object") return false;
  const candidate = config as Partial<WidgetTemplateConfig>;
  return Array.isArray(candidate.dataSources) && Array.isArray(candidate.sections);
}

/** Compact view: show full year with responsive block sizing. */
const COMPACT_DAYS = 365;

export function CommitsCompact({
  widgetId,
  projectSlug,
  timeRange,
  onRefetch,
  onFetchedAt,
  onChromeStateChange,
  onConnectService,
}: WidgetRenderProps<WidgetTemplateConfig>) {
  const { data, loading, error, configured, refetch, fetchedAt } = useGithubCommits(
    projectSlug,
    timeRange
  );

  useWidgetCallbacks({
    widgetId,
    projectSlug,
    timeRange,
    sourceIds: ["github-activity"],
    fetchedAt: configured ? (fetchedAt ?? null) : null,
    loading,
    error,
    refetch,
    chromeStatus: !loading && !configured ? "disconnected" : "default",
    onFetchedAt,
    onRefetch,
    onChromeStateChange,
  });

  const contributionData = useMemo(() => {
    if (!data?.repos) return [];

    const dateMap = new Map<string, number>();

    for (const repo of data.repos) {
      for (const day of repo.dailyStats ?? []) {
        dateMap.set(day.date, (dateMap.get(day.date) || 0) + day.count);
      }
    }

    return Array.from(dateMap.entries()).map(([date, count]) => ({ date, count }));
  }, [data]);

  const isEmpty = contributionData.length === 0;

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-dim text-w-sm">Loading...</div>
    );
  }

  if (!configured) {
    return (
      <WidgetNotConfigured serviceName="GitHub" serviceId="github" onConnect={onConnectService} />
    );
  }

  if (error) {
    return <EmptyState message={error} variant="compact" />;
  }

  if (isEmpty) {
    return (
      <EmptyState message="No commit activity in the connected repositories" variant="compact" />
    );
  }

  return (
    <div className="flex h-full w-full flex-col justify-center px-4">
      <ContributionGraph
        data={contributionData}
        days={COMPACT_DAYS}
        responsive
        onRenderBlock={(block: ReactElement, day: ContributionData) => (
          <Tooltip key={day.date}>
            <TooltipTrigger asChild>{block}</TooltipTrigger>
            <TooltipContent className="z-[9999]" side="top">
              {day.count} {day.count === 1 ? "commit" : "commits"} on {day.date}
            </TooltipContent>
          </Tooltip>
        )}
      />
    </div>
  );
}
