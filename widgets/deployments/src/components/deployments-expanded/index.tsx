"use client";

import { useDashboard } from "@radarboard/hooks/use-dashboard";
import type { VercelDeploymentItem } from "@radarboard/types/vercel";
import { cn } from "@radarboard/utils/cn";
import { formatTimeAgo } from "@radarboard/utils/format-time-ago";
import { filterByProject, resolveProjectName } from "@radarboard/utils/project-helpers";
import { CompactActivityChart } from "@radarboard/widget-engine/compact-activity-chart";
import { CompactProjectBadge } from "@radarboard/widget-engine/compact-project-badge";
import { SummaryMetricCell } from "@radarboard/widget-engine/summary-metric-cell";
import type { WidgetTemplateConfig } from "@radarboard/widget-engine/templates";
import { WidgetTable } from "@radarboard/widget-engine/widget-table";
import type { WidgetRenderProps } from "@radarboard/widget-sdk/widget-types";

interface DeployBucket {
  id: string;
  title: string;
  ready: number;
  error: number;
  building: number;
}

import { createColumnHelper } from "@tanstack/react-table";
import { useVercelDeployments } from "../../hooks/use-deployments";

// --- Helpers ---

function stateColor(state: string): string {
  if (state === "READY") return "#3fb950";
  if (state === "ERROR") return "#e63946";
  return "#f5c542";
}

function stateDot(state: string) {
  const color = stateColor(state);
  const pulse = state === "BUILDING";
  return (
    <span
      className={cn("inline-block h-2 w-2 shrink-0 rounded-full", pulse && "animate-pulse")}
      style={{ backgroundColor: color }}
    />
  );
}

function formatDuration(ms: number): string {
  if (ms <= 0) return "\u2014";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const remainder = s % 60;
  return remainder > 0 ? `${m}m ${remainder}s` : `${m}m`;
}

function openDeployment(row: VercelDeploymentItem): void {
  const href = row.inspectorUrl.startsWith("http")
    ? row.inspectorUrl
    : `https://${row.inspectorUrl}`;
  window.open(href, "_blank", "noopener,noreferrer");
}

// --- 7-day bar chart ---

type DeploySegmentKey = "ready" | "error" | "building";

const SEGMENT_COLORS: { key: DeploySegmentKey; color: string }[] = [
  { key: "ready", color: "#3fb950" },
  { key: "error", color: "#e63946" },
  { key: "building", color: "#f5c542" },
];

function stateToBucketKey(state: string): DeploySegmentKey {
  if (state === "READY") return "ready";
  if (state === "ERROR") return "error";
  return "building";
}

function buildBuckets(deployments: VercelDeploymentItem[], days: number): DeployBucket[] {
  const now = Date.now();
  const startDate = now - (days - 1) * 86_400_000;
  const buckets: DeployBucket[] = Array.from({ length: days }, (_, index) => {
    const daysAgo = days - 1 - index;
    const bucketDate = new Date(startDate + index * 86_400_000).toISOString().slice(0, 10);
    return {
      id: bucketDate,
      title: `${daysAgo === 0 ? "Today" : `${daysAgo}d ago`}: 0 ok, 0 failed, 0 building`,
      ready: 0,
      error: 0,
      building: 0,
    };
  });

  for (const d of deployments) {
    const daysAgo = Math.floor((now - d.created) / 86_400_000);
    const idx = days - 1 - daysAgo;
    const bucket = idx >= 0 && idx < days ? buckets[idx] : undefined;
    if (bucket) {
      bucket[stateToBucketKey(d.state)]++;
    }
  }

  for (const bucket of buckets) {
    bucket.title = `${bucket.id}: ${bucket.ready} ok, ${bucket.error} failed, ${bucket.building} building`;
  }

  return buckets;
}

function DeployBarChart({
  deployments,
  days,
}: {
  deployments: VercelDeploymentItem[];
  days: number;
}) {
  const buckets = buildBuckets(deployments, days);
  const chartBuckets = buckets.map((bucket) => ({
    id: bucket.id,
    title: bucket.title,
    values: {
      ready: bucket.ready,
      error: bucket.error,
      building: bucket.building,
    },
  }));

  return (
    <CompactActivityChart buckets={chartBuckets} segments={SEGMENT_COLORS} heightClassName="h-12" />
  );
}

// --- Column definitions ---

const col = createColumnHelper<VercelDeploymentItem>();

const DEPLOY_COLUMNS = [
  col.accessor("state", {
    header: "Status",
    size: 80,
    cell: (info) => (
      <div className="flex items-center gap-1.5">
        {stateDot(info.getValue())}
        <span
          className="font-mono text-w-sm uppercase"
          style={{ color: stateColor(info.getValue()) }}
        >
          {info.getValue()}
        </span>
      </div>
    ),
  }),
  col.accessor("commitMessage", {
    header: "Commit",
    cell: (info) => (
      <span className="block max-w-sidebar truncate font-mono text-foreground text-w-base">
        {info.getValue() ?? "\u2014"}
      </span>
    ),
  }),
  col.accessor("projectName", {
    header: "Project",
    size: 140,
    cell: (info) => {
      const d = info.row.original;
      return <CompactProjectBadge color={d?.projectColor ?? "#888"} label={info.getValue()} />;
    },
  }),
  col.accessor("branch", {
    header: "Branch",
    size: 120,
    cell: (info) => (
      <span className="font-mono text-dim text-w-sm">{info.getValue() ?? "\u2014"}</span>
    ),
  }),
  col.accessor("buildDuration", {
    header: "Duration",
    size: 90,
    meta: { align: "right" as const },
    cell: (info) => (
      <span className="font-mono text-foreground text-w-base">
        {formatDuration(info.getValue())}
      </span>
    ),
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

// --- KPI Cell ---

function KpiCell({ label, value }: { label: string; value: string }) {
  return <SummaryMetricCell label={label} value={value} />;
}

// --- Expanded view ---

export function VercelDeploymentsExpanded({
  projectSlug,
}: WidgetRenderProps<WidgetTemplateConfig>) {
  const { projects, timeRange } = useDashboard();
  const { deployments } = useVercelDeployments(projectSlug, timeRange);

  const projectName = resolveProjectName(projects, projectSlug);
  const filtered = filterByProject(deployments, projectName);

  const total = filtered.length;
  const succeeded = filtered.filter((d) => d.state === "READY").length;
  const failed = filtered.filter((d) => d.state === "ERROR").length;
  const successRate = total > 0 ? Math.round((succeeded / total) * 100) : 0;
  const avgPerDay = total > 0 ? (total / 7).toFixed(1) : "0";

  return (
    <div className="flex h-full flex-col">
      {/* KPI strip */}
      <div className="grid shrink-0 grid-cols-4 gap-px bg-secondary">
        <KpiCell label="Total Deploys" value={String(total)} />
        <KpiCell label="Success Rate" value={`${successRate}%`} />
        <KpiCell label="Failed" value={String(failed)} />
        <KpiCell label="Avg / Day" value={avgPerDay} />
      </div>

      {/* 30-day bar chart */}
      <div className="shrink-0 border-border border-b px-4 py-3">
        <div className="mb-2 font-mono text-dim text-w-sm uppercase tracking-wider">
          Deploy Activity (30 days)
        </div>
        <DeployBarChart deployments={filtered} days={30} />
      </div>

      {/* Full deployment table */}
      <WidgetTable
        stateKey="vercel-deployments:deploys"
        columns={DEPLOY_COLUMNS}
        data={filtered}
        defaultSorting={[{ id: "created", desc: true }]}
        filterPlaceholder="Filter deployments..."
        onRowClick={openDeployment}
        emptyMessage="No deployments"
      />
    </div>
  );
}
