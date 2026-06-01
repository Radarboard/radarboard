"use client";

/**
 * Shipping Log — Expanded fullscreen view
 */

import { useDashboard } from "@radarboard/hooks/use-dashboard";
import type { ShippingSource } from "@radarboard/types/shipping";
import { Button } from "@radarboard/ui/button";
import { EmptyState } from "@radarboard/ui/empty-state";
import { SkeletonShimmer } from "@radarboard/ui/skeleton-shimmer";
import { cn } from "@radarboard/utils/cn";
import { filterByProject, resolveProjectName } from "@radarboard/utils/project-helpers";
import type { WidgetTemplateConfig } from "@radarboard/widget-engine/templates";
import type { WidgetRenderProps } from "@radarboard/widget-sdk/widget-types";
import { useState } from "react";
import { useShipping } from "../../hooks/use-shipping";
import { ShippingLog } from "../shipping-log";

const SOURCES: { value: ShippingSource | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "github", label: "GitHub" },
  { value: "vercel", label: "Vercel" },
  { value: "linear", label: "Linear" },
  { value: "manual", label: "Manual" },
];

export function ShippingExpanded({
  widgetId,
  projectSlug,
  selectedDetailId,
  onSelectedDetailIdChange,
}: WidgetRenderProps<WidgetTemplateConfig>) {
  const { projects, timeRange } = useDashboard();
  const { items, configured, loading } = useShipping(projectSlug, timeRange);
  const [sourceFilter, setSourceFilter] = useState<ShippingSource | "all">("all");

  const projectName = resolveProjectName(projects, projectSlug);
  const projectFiltered = filterByProject(items, projectName);
  const filtered =
    sourceFilter === "all"
      ? projectFiltered
      : projectFiltered.filter((i) => i.source === sourceFilter);

  // Count by source
  const sourceCounts = new Map<string, number>();
  for (const item of projectFiltered) {
    sourceCounts.set(item.source, (sourceCounts.get(item.source) ?? 0) + 1);
  }

  return (
    <SkeletonShimmer loading={loading}>
      <div className="flex h-full flex-col">
        {/* Summary strip + filters */}
        <div className="flex shrink-0 items-center gap-3 border-border border-b px-3 py-2.5">
          <div className="flex items-center gap-1">
            {SOURCES.map((s) => (
              <Button
                key={s.value}
                type="button"
                onClick={() => setSourceFilter(s.value)}
                variant={sourceFilter === s.value ? "active" : "ghost"}
                size="sm"
                uppercase
                className={cn(sourceFilter !== s.value && "text-dim hover:text-muted-foreground")}
              >
                {s.label}
                {s.value !== "all" && sourceCounts.has(s.value) && (
                  <span className="ml-1 text-dim">({sourceCounts.get(s.value)})</span>
                )}
              </Button>
            ))}
          </div>
          <span className="ml-auto font-mono text-dim text-w-sm">
            {filtered.length} of {projectFiltered.length} items
          </span>
        </div>

        {/* Full list */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {!configured && (
            <EmptyState
              message="Release activity not configured"
              subMessage="Connect GitHub, Linear, or Vercel in Settings > Integrations"
              variant="compact"
            />
          )}
          {configured && filtered.length === 0 && (
            <EmptyState
              message={
                sourceFilter === "all" ? "No recent activity" : `No ${sourceFilter} activity`
              }
              variant="compact"
            />
          )}
          {configured && filtered.length > 0 && (
            <ShippingLog
              widgetId={widgetId}
              items={filtered}
              selectedId={selectedDetailId}
              onSelectedIdChange={onSelectedDetailIdChange}
            />
          )}
        </div>
      </div>
    </SkeletonShimmer>
  );
}
