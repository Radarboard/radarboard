"use client";

import type { AnalyticsOverview, PlatformMetrics, TopPage } from "@radarboard/types/analytics";
import { Dialog } from "@radarboard/ui/app-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@radarboard/ui/tooltip";
import { formatNumber } from "@radarboard/utils/format-number";
import { useSelectedItem } from "@radarboard/widget-engine/hooks/use-selected-item";
import { WidgetModalDialogContent } from "@radarboard/widget-engine/widget-modal";
import { useMemo } from "react";
import { TopPageDetail } from "../components/top-page-detail";

interface AnalyticsLiveProps {
  data: AnalyticsOverview;
  selectedId?: string | null;
  onSelectedIdChange?: (id: string | null) => void;
  widgetId?: string;
}

const COMPACT_PAGE_LIMIT = 10;

function formatDuration(seconds: number): string {
  const rounded = Math.round(seconds);
  const minutes = Math.floor(rounded / 60);
  const remainder = rounded % 60;

  return minutes > 0 ? `${minutes}m ${remainder}s` : `${remainder}s`;
}

function getPageKey(page: TopPage): string {
  return `${page.path}::${page.platformName ?? "default"}`;
}

export function AnalyticsLive({
  data,
  selectedId,
  onSelectedIdChange,
  widgetId = "analytics",
}: AnalyticsLiveProps) {
  const hasAttribution = data.topPages.some((p) => p.projectName);

  const pageMap = useMemo(
    () => new Map(data.topPages.map((p) => [getPageKey(p), p])),
    [data.topPages]
  );

  const selectedPage = useSelectedItem(selectedId, pageMap);

  const handleSelect = (page: TopPage) => {
    onSelectedIdChange?.(getPageKey(page));
  };

  const handleClose = () => {
    onSelectedIdChange?.(null);
  };

  // In "All" view (pages have attribution), use path+platformName as key to preserve per-site rows.
  // In single-project view, deduplicate by path (keep highest sessions).
  const displayPages = hasAttribution
    ? data.topPages.slice(0, COMPACT_PAGE_LIMIT)
    : Array.from(
        data.topPages
          .reduce((map, page) => {
            const existing = map.get(page.path);
            if (!existing || page.sessions > existing.sessions) {
              map.set(page.path, page);
            }
            return map;
          }, new Map<string, TopPage>())
          .values()
      ).slice(0, COMPACT_PAGE_LIMIT);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col gap-3 p-3">
        {/* Realtime visitors */}
        <div className="flex items-center gap-2">
          <span className="pulse-dot inline-block h-2 w-2 rounded-full bg-[#4ade80]" />
          <span className="font-bold font-mono text-foreground text-w-2xl">
            {formatNumber(data.liveVisitors)}
          </span>
          <span className="text-dim text-w-base">live visitors</span>
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-4 gap-2">
          <MetricCellWithTooltip
            label="Visitors"
            value={formatNumber(data.metrics.uniqueVisitors)}
            breakdown={data.platformBreakdown}
            metricKey="uniqueVisitors"
          />
          <MetricCellWithTooltip
            label="Sessions"
            value={formatNumber(data.metrics.totalSessions)}
            breakdown={data.platformBreakdown}
            metricKey="totalSessions"
          />
          <MetricCellWithTooltip
            label="Page Views"
            value={formatNumber(data.metrics.totalPageViews)}
            breakdown={data.platformBreakdown}
            metricKey="totalPageViews"
          />
          <MetricCellWithTooltip
            label="Avg Duration"
            value={formatDuration(data.metrics.avgSessionDuration ?? 0)}
            breakdown={data.platformBreakdown}
            metricKey="avgSessionDuration"
            formatMetricValue={formatDuration}
          />
        </div>

        {/* Top pages */}
        <div className="mt-1">
          <h4 className="mb-2 font-mono text-dim text-w-sm uppercase tracking-wider">Top Pages</h4>
          <table className="w-full text-w-base">
            <tbody>
              {displayPages.map((page) => (
                <tr
                  key={`${page.path}-${page.platformName ?? "default"}`}
                  className="cursor-pointer border-border border-b transition-colors hover:bg-surface-raised"
                  onClick={() => handleSelect(page)}
                >
                  <td className="py-1.5 text-foreground-secondary">
                    <div className="flex max-w-[150px] items-center gap-1.5 truncate">
                      {Boolean(page.projectColor) && (
                        <span
                          className="inline-block h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: page.projectColor }}
                        />
                      )}
                      <span className="truncate">{page.path}</span>
                    </div>
                  </td>
                  {Boolean(page.platformName) && (
                    <td className="max-w-[100px] truncate py-1.5 text-right text-dim text-w-sm">
                      {page.platformName}
                    </td>
                  )}
                  <td className="py-1.5 text-right font-mono text-muted-foreground">
                    {formatNumber(page.sessions)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Dialog
        open={!!selectedPage}
        onOpenChange={(open) => {
          if (!open) handleClose();
        }}
      >
        <WidgetModalDialogContent widgetId={widgetId} modalId="analytics.top-page" defaultSize="sm">
          {selectedPage && <TopPageDetail page={selectedPage} />}
        </WidgetModalDialogContent>
      </Dialog>
    </TooltipProvider>
  );
}

/** Metric cell with optional tooltip showing per-platform breakdown */
function MetricCellWithTooltip({
  label,
  value,
  breakdown,
  metricKey,
  isPercentage,
  formatMetricValue,
}: {
  label: string;
  value: string;
  breakdown?: PlatformMetrics[];
  metricKey: keyof PlatformMetrics;
  isPercentage?: boolean;
  formatMetricValue?: (value: number) => string;
}) {
  if (!breakdown || breakdown.length <= 1) {
    return <MetricCell label={label} value={value} />;
  }

  const total = breakdown.reduce((sum, p) => sum + Number(p[metricKey]), 0);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex cursor-default flex-col gap-0.5 border border-border bg-surface-raised p-2">
          <span className="font-mono text-dim text-w-sm uppercase tracking-wider">{label}</span>
          <span className="font-mono font-semibold text-foreground text-w-lg">{value}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="min-w-[180px] border-border bg-surface-raised p-0">
        <div className="flex flex-col gap-1.5 p-2">
          {breakdown.map((p) => {
            const val = Number(p[metricKey]);
            return (
              <div key={p.platformId} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 text-foreground-secondary text-w-sm">
                  <span
                    className="inline-block h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: p.projectColor }}
                  />
                  {p.platformName}
                </span>
                <span className="font-mono font-semibold text-foreground text-w-sm">
                  {(() => {
                    if (formatMetricValue) return formatMetricValue(val);
                    if (isPercentage) return `${val.toFixed(1)}%`;
                    return formatNumber(val);
                  })()}
                </span>
              </div>
            );
          })}
          {/* Mini stacked bar */}
          {!isPercentage && total > 0 && (
            <div className="mt-0.5 flex h-1 overflow-hidden rounded-full">
              {breakdown.map((p) => {
                const val = Number(p[metricKey]);
                const pct = (val / total) * 100;
                return (
                  <div
                    key={p.platformId}
                    style={{ backgroundColor: p.projectColor, width: `${pct}%` }}
                  />
                );
              })}
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 border border-border bg-surface-raised p-2">
      <span className="font-mono text-dim text-w-sm uppercase tracking-wider">{label}</span>
      <span className="font-mono font-semibold text-foreground text-w-lg">{value}</span>
    </div>
  );
}
