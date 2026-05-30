"use client";

/**
 * Vercel Build Performance — Expanded fullscreen view
 */

import { useDashboard } from "@radarboard/hooks/use-dashboard";
import type { VercelDeploymentItem } from "@radarboard/types/vercel";
import { formatTimeAgo } from "@radarboard/utils/format-time-ago";
import { filterByProject, resolveProjectName } from "@radarboard/utils/project-helpers";
import { CompactProjectBadge } from "@radarboard/widget-engine/compact-project-badge";
import { SummaryMetricCell } from "@radarboard/widget-engine/summary-metric-cell";
import type { WidgetTemplateConfig } from "@radarboard/widget-engine/templates";
import { WidgetTable } from "@radarboard/widget-engine/widget-table";
import type { WidgetRenderProps } from "@radarboard/widget-sdk/widget-types";
import { createColumnHelper } from "@tanstack/react-table";
import { useVercelDeployments } from "../../hooks/use-builds";

// --- Helpers ---

function formatDuration(ms: number): string {
  if (ms <= 0) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const remainder = s % 60;
  return remainder > 0 ? `${m}m ${remainder}s` : `${m}m`;
}

function getCompletedDeploys(deploys: VercelDeploymentItem[]): VercelDeploymentItem[] {
  return deploys.filter((d) => d.buildDuration > 0);
}

function calcPercentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)] ?? 0;
}

function openDeployment(row: VercelDeploymentItem): void {
  const href = row.inspectorUrl.startsWith("http")
    ? row.inspectorUrl
    : `https://${row.inspectorUrl}`;
  window.open(href, "_blank", "noopener,noreferrer");
}

// --- Build duration bar chart ---

function BuildDurationChart({
  deploys,
  count,
}: {
  deploys: VercelDeploymentItem[];
  count: number;
}) {
  const recent = deploys.slice(0, count);
  if (recent.length === 0) return null;

  const maxDuration = Math.max(...recent.map((d) => d.buildDuration), 1);

  return (
    <div className="flex h-16 items-end gap-0.5">
      {recent.map((d) => {
        const pct = (d.buildDuration / maxDuration) * 100;
        const color = d.state === "ERROR" ? "#e63946" : "#5b8af5";
        return (
          <div
            key={d.id}
            className="flex-1 rounded-t-sm opacity-60 transition-opacity hover:opacity-100"
            style={{
              height: `${Math.max(pct, 4)}%`,
              backgroundColor: color,
            }}
            title={`${d.commitMessage ?? d.id}: ${formatDuration(d.buildDuration)}`}
          />
        );
      })}
    </div>
  );
}

// --- Column definitions ---

const col = createColumnHelper<VercelDeploymentItem>();

const BUILD_COLUMNS = [
  col.accessor("projectName", {
    header: "Project",
    size: 140,
    cell: (info) => {
      const d = info.row.original;
      return <CompactProjectBadge color={d.projectColor} label={info.getValue()} />;
    },
  }),
  col.accessor("commitMessage", {
    header: "Commit",
    cell: (info) => (
      <span className="block max-w-[260px] truncate font-mono text-foreground text-w-base">
        {info.getValue() ?? "—"}
      </span>
    ),
  }),
  col.accessor("buildDuration", {
    header: "Duration",
    size: 100,
    meta: { align: "right" as const },
    cell: (info) => (
      <span className="font-mono text-foreground text-w-base">
        {formatDuration(info.getValue())}
      </span>
    ),
  }),
  col.accessor("branch", {
    header: "Branch",
    size: 120,
    cell: (info) => <span className="font-mono text-dim text-w-sm">{info.getValue() ?? "—"}</span>,
  }),
  col.accessor("creatorUsername", {
    header: "Creator",
    size: 120,
    cell: (info) => <span className="font-mono text-dim text-w-sm">{info.getValue()}</span>,
  }),
  col.accessor("created", {
    header: "Time",
    size: 90,
    meta: { align: "right" as const },
    cell: (info) => (
      <span className="font-mono text-dim text-w-sm">
        {formatTimeAgo(new Date(info.getValue()).toISOString())}
      </span>
    ),
  }),
];

// --- Expanded view ---

export function VercelBuildPerfExpanded({ projectSlug }: WidgetRenderProps<WidgetTemplateConfig>) {
  const { projects, timeRange } = useDashboard();
  const { deployments } = useVercelDeployments(projectSlug, timeRange);

  const projectName = resolveProjectName(projects, projectSlug);
  const filtered = filterByProject(deployments, projectName);
  const completed = getCompletedDeploys(filtered);

  const durations = completed.map((d) => d.buildDuration).sort((a, b) => a - b);
  const avg = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
  const p50 = calcPercentile(durations, 50);
  const p95 = calcPercentile(durations, 95);
  const fastest = durations.length > 0 ? (durations[0] ?? 0) : 0;
  const slowest = durations.length > 0 ? (durations[durations.length - 1] ?? 0) : 0;

  return (
    <div className="flex h-full flex-col">
      {/* KPI strip */}
      <div className="grid shrink-0 grid-cols-5 gap-0 border-border border-b">
        <SummaryMetricCell label="Average" value={formatDuration(avg)} />
        <SummaryMetricCell label="P50" value={formatDuration(p50)} />
        <SummaryMetricCell label="P95" value={formatDuration(p95)} />
        <SummaryMetricCell label="Fastest" value={formatDuration(fastest)} />
        <SummaryMetricCell label="Slowest" value={formatDuration(slowest)} />
      </div>

      {/* Build duration chart */}
      <div className="shrink-0 border-border border-b px-4 py-3">
        <div className="mb-2 font-mono text-dim text-w-sm uppercase tracking-wider">
          Build Duration Trend
        </div>
        <BuildDurationChart deploys={completed} count={completed.length} />
      </div>

      {/* Build table */}
      <WidgetTable
        stateKey="vercel-build-perf:builds"
        columns={BUILD_COLUMNS}
        data={completed}
        defaultSorting={[{ id: "buildDuration", desc: true }]}
        filterPlaceholder="Filter builds..."
        onRowClick={openDeployment}
        emptyMessage="No completed builds"
      />
    </div>
  );
}
