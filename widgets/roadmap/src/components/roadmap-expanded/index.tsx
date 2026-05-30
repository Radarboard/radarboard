"use client";

/**
 * Roadmap — Expanded fullscreen view
 *
 * Two tabs:
 * - Releases: active Linear projects with progress bars
 * - In Progress: issues currently being worked on
 */

import { useDashboard } from "@radarboard/hooks/use-dashboard";
import { useEffectiveLocale } from "@radarboard/hooks/use-effective-locale";
import type { RoadmapInProgressIssue, RoadmapProject } from "@radarboard/types/roadmap";
import { Button } from "@radarboard/ui/button";
import { EmptyState } from "@radarboard/ui/empty-state";
import { SkeletonShimmer } from "@radarboard/ui/skeleton-shimmer";
import { cn } from "@radarboard/utils/cn";
import { formatDate } from "@radarboard/utils/format-date-time";
import { resolveProjectName } from "@radarboard/utils/project-helpers";
import type { WidgetTemplateConfig } from "@radarboard/widget-engine/templates";
import type { WidgetRenderProps } from "@radarboard/widget-sdk/widget-types";
import { useState } from "react";
import { useRoadmap } from "../../hooks/use-roadmap";

type TabId = "releases" | "in-progress";

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

function ProgressBar({ progress }: { progress: number }) {
  const pct = Math.round(progress * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            (() => {
              if (pct >= 90) return "bg-success";
              if (pct >= 50) return "bg-accent";
              return "bg-warning";
            })()
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="shrink-0 font-mono text-dim text-w-xs">{pct}%</span>
    </div>
  );
}

function HealthBadge({ health }: { health: RoadmapProject["health"] }) {
  if (!health) return null;
  const config = {
    onTrack: { label: "On track", className: "text-success" },
    atRisk: { label: "At risk", className: "text-warning" },
    offTrack: { label: "Off track", className: "text-destructive" },
  }[health];

  return <span className={cn("font-mono text-w-xs", config.className)}>{config.label}</span>;
}

function ReleaseRow({ project }: { project: RoadmapProject }) {
  const effectiveLocale = useEffectiveLocale();
  const total = project.issueCountDone + project.issueCountInProgress + project.issueCountOpen;
  return (
    <div className="border-border border-b px-3 py-2.5 transition-colors last:border-b-0 hover:bg-secondary/30">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="truncate font-medium text-foreground text-w-sm">{project.name}</span>
        <div className="flex shrink-0 items-center gap-2">
          <HealthBadge health={project.health} />
          {project.targetDate ? (
            <span className="font-mono text-dim text-w-xs">
              {formatDate(project.targetDate, {
                compact: true,
                locale: effectiveLocale,
              })}
            </span>
          ) : null}
        </div>
      </div>
      <ProgressBar progress={project.progress} />
      <div className="mt-1 flex items-center gap-2">
        <span className="font-mono text-dim text-w-xs">{project.issueCountDone} done</span>
        <span className="font-mono text-dim text-w-xs">·</span>
        <span className="font-mono text-dim text-w-xs">{project.issueCountInProgress} WIP</span>
        <span className="font-mono text-dim text-w-xs">·</span>
        <span className="font-mono text-dim text-w-xs">{project.issueCountOpen} open</span>
        {total > 0 && (
          <>
            <span className="font-mono text-dim text-w-xs">·</span>
            <span className="font-mono text-dim text-w-xs">{total} total</span>
          </>
        )}
      </div>
    </div>
  );
}

function priorityColor(priority: RoadmapInProgressIssue["priority"]): string {
  switch (priority) {
    case "critical":
      return "bg-destructive";
    case "high":
      return "bg-warning";
    case "medium":
      return "bg-warning/60";
    default:
      return "bg-secondary";
  }
}

function InProgressRow({ issue }: { issue: RoadmapInProgressIssue }) {
  return (
    <a
      href={issue.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-start gap-2 border-border border-b px-3 py-2.5 transition-colors last:border-b-0 hover:bg-secondary/30"
    >
      <span
        className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", priorityColor(issue.priority))}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="shrink-0 font-mono text-dim text-w-xs">{issue.identifier}</span>
          <span className="truncate text-foreground text-w-sm">{issue.title}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          {issue.projectName ? (
            <span className="font-mono text-dim text-w-xs">{issue.projectName}</span>
          ) : null}
          {issue.assignee ? (
            <>
              <span className="font-mono text-dim text-w-xs">·</span>
              <span className="font-mono text-dim text-w-xs">{issue.assignee.name}</span>
            </>
          ) : null}
          <span className="font-mono text-dim text-w-xs">·</span>
          <span className="font-mono text-dim text-w-xs">{issue.timeInStarted}</span>
        </div>
      </div>
    </a>
  );
}

export function RoadmapExpanded({ projectSlug }: WidgetRenderProps<WidgetTemplateConfig>) {
  const { projects: dashProjects } = useDashboard();
  const { projects, inProgressIssues, configured, loading } = useRoadmap(projectSlug);
  const [activeTab, setActiveTab] = useState<TabId>("releases");

  const _projectName = resolveProjectName(dashProjects, projectSlug);

  return (
    <SkeletonShimmer loading={loading}>
      <div className="flex h-full flex-col">
        {/* Tab bar */}
        <div className="flex shrink-0 items-center gap-3 border-border border-b px-3 py-2.5">
          <div className="flex items-center gap-1">
            <TabButton
              active={activeTab === "releases"}
              onClick={() => setActiveTab("releases")}
              label="Releases"
              count={projects.length}
            />
            <TabButton
              active={activeTab === "in-progress"}
              onClick={() => setActiveTab("in-progress")}
              label="In Progress"
              count={inProgressIssues.length}
            />
          </div>
        </div>

        {/* Content */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {!configured ? (
            <EmptyState
              message="Roadmap not configured"
              subMessage="Connect Linear in Settings → Integrations"
              variant="compact"
            />
          ) : null}
          {configured && activeTab === "releases" && projects.length === 0 ? (
            <EmptyState message="No active projects" variant="compact" />
          ) : null}
          {configured && activeTab === "releases" && projects.length > 0 ? (
            <div>
              {projects.map((project) => (
                <ReleaseRow key={project.id} project={project} />
              ))}
            </div>
          ) : null}
          {configured && activeTab !== "releases" && inProgressIssues.length === 0 ? (
            <EmptyState message="No issues in progress" variant="compact" />
          ) : null}
          {configured && activeTab !== "releases" && inProgressIssues.length > 0 ? (
            <div>
              {inProgressIssues.map((issue) => (
                <InProgressRow key={issue.id} issue={issue} />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </SkeletonShimmer>
  );
}
