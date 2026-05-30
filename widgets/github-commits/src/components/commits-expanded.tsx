"use client";

import { useEffectiveLocale } from "@radarboard/hooks/use-effective-locale";
import { Button } from "@radarboard/ui/button";
import { type ContributionData, ContributionGraph } from "@radarboard/ui/contribution-graph";
import { EmptyState } from "@radarboard/ui/empty-state";
import { Tooltip, TooltipContent, TooltipTrigger } from "@radarboard/ui/tooltip";
import { cn } from "@radarboard/utils/cn";
import { useWidgetCallbacks } from "@radarboard/widget-engine/hooks/use-widget-callbacks";
import type { WidgetTemplateConfig } from "@radarboard/widget-engine/templates";
import type { WidgetRenderProps } from "@radarboard/widget-sdk/widget-types";
import { Globe, Lock } from "lucide-react";
import { type ReactElement, useMemo, useState } from "react";
import { type CommitRepoData, useGithubCommits } from "../hooks/use-github-commits";

type VisibilityTab = "all" | "public" | "private";

function TabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <Button
      type="button"
      onClick={onClick}
      variant={active ? "active" : "ghost"}
      size="sm"
      uppercase
      className={cn(!active && "text-dim hover:text-muted-foreground")}
    >
      {label} ({count})
    </Button>
  );
}

function aggregateContributions(repos: CommitRepoData[]): ContributionData[] {
  const dateMap = new Map<string, number>();

  for (const repo of repos) {
    for (const day of repo.dailyStats ?? []) {
      dateMap.set(day.date, (dateMap.get(day.date) || 0) + day.count);
    }
  }

  return Array.from(dateMap.entries()).map(([date, count]) => ({ date, count }));
}

function formatDateRange(locale: string): string {
  const now = new Date();
  const start = new Date(now);
  start.setFullYear(start.getFullYear() - 1);

  const fmt = (d: Date) =>
    d.toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" });

  return `${fmt(start)} – ${fmt(now)}`;
}

export function CommitsExpanded({
  projectSlug,
  timeRange,
  onRefetch,
  onFetchedAt,
}: WidgetRenderProps<WidgetTemplateConfig>) {
  const effectiveLocale = useEffectiveLocale();
  const { data, loading, error, configured, refetch, fetchedAt } = useGithubCommits(
    projectSlug,
    timeRange
  );
  const [activeTab, setActiveTab] = useState<VisibilityTab>("all");

  useWidgetCallbacks({
    projectSlug,
    timeRange,
    sourceIds: ["github"],
    fetchedAt,
    loading,
    error,
    refetch,
    onFetchedAt,
    onRefetch,
  });

  const repos = data?.repos ?? [];

  const filteredRepos = useMemo(() => {
    if (activeTab === "all") return repos;
    return repos.filter((r) => r.visibility === activeTab);
  }, [repos, activeTab]);

  const contributionData = useMemo(() => aggregateContributions(filteredRepos), [filteredRepos]);

  const totalCommits = contributionData.reduce((sum, day) => sum + day.count, 0);

  const sortedRepos = [...filteredRepos].sort((a, b) => b.totalCommits - a.totalCommits);

  const publicCount = repos.filter((repo) => repo.visibility === "public").length;
  const privateCount = repos.filter((repo) => repo.visibility === "private").length;

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-dim text-w-sm">Loading...</div>
    );
  }

  if (error) {
    return <EmptyState message={error} variant="compact" />;
  }

  if (!configured) {
    return (
      <EmptyState
        message="GitHub not connected"
        subMessage="Connect GitHub in Settings → Integrations"
        variant="compact"
      />
    );
  }

  if (repos.length === 0) {
    return (
      <EmptyState message="No commit activity in the connected repositories" variant="compact" />
    );
  }

  return (
    <div className="flex h-full w-full flex-col">
      {/* Tab bar */}
      <div className="flex shrink-0 items-center gap-3 border-border border-b px-4 py-2.5">
        <div className="flex items-center gap-1">
          <TabButton
            active={activeTab === "all"}
            onClick={() => setActiveTab("all")}
            label="All"
            count={repos.length}
          />
          <TabButton
            active={activeTab === "public"}
            onClick={() => setActiveTab("public")}
            label="Public"
            count={publicCount}
          />
          <TabButton
            active={activeTab === "private"}
            onClick={() => setActiveTab("private")}
            label="Private"
            count={privateCount}
          />
        </div>
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {/* Header with total and date range */}
        <div className="mb-4 flex items-baseline justify-between">
          <div className="flex items-baseline gap-3">
            <span className="font-mono font-semibold text-2xl text-foreground">
              {totalCommits.toLocaleString()}
            </span>
            <span className="font-mono text-dim text-w-sm uppercase tracking-wider">commits</span>
          </div>
          <span className="font-mono text-dim text-w-sm">{formatDateRange(effectiveLocale)}</span>
        </div>

        {contributionData.length === 0 ? (
          <EmptyState
            message={`No commit activity found for ${activeTab} repositories`}
            variant="compact"
          />
        ) : (
          <>
            <ContributionGraph
              data={contributionData}
              days={365}
              onRenderBlock={(block: ReactElement, day: ContributionData) => (
                <Tooltip key={day.date}>
                  <TooltipTrigger asChild>{block}</TooltipTrigger>
                  <TooltipContent className="z-[9999]" side="top">
                    {day.count} {day.count === 1 ? "commit" : "commits"} on {day.date}
                  </TooltipContent>
                </Tooltip>
              )}
            />

            {/* Repo breakdown */}
            <div className="mt-6">
              <div className="mb-3 font-mono text-dim text-w-sm uppercase tracking-wider">
                Repositories
              </div>
              <div className="space-y-1">
                {sortedRepos.map((repo) => (
                  <div
                    key={repo.repo}
                    className="flex items-center justify-between rounded-item border border-border bg-surface-raised px-3 py-2"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      {repo.visibility === "private" ? (
                        <Lock className="icon-xs shrink-0 text-dim" />
                      ) : (
                        <Globe className="icon-xs shrink-0 text-dim" />
                      )}
                      <span className="truncate font-mono text-foreground-secondary text-w-sm">
                        {repo.repo}
                      </span>
                    </div>
                    <span className="ml-3 shrink-0 font-mono text-foreground text-w-sm tabular-nums">
                      {repo.totalCommits.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
