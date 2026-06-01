"use client";

/**
 * SEO Performance — Expanded fullscreen view
 */

import { useDemoMode } from "@radarboard/hooks/use-demo-mode";
import type { SearchQuery, SeoOverview } from "@radarboard/types/seo";
import { formatNumber } from "@radarboard/utils/format-number";
import type { WidgetTemplateConfig } from "@radarboard/widget-engine/templates";
import { WidgetNotConfigured } from "@radarboard/widget-engine/widget-not-configured";
import { WidgetTable } from "@radarboard/widget-engine/widget-table";
import type { WidgetRenderProps } from "@radarboard/widget-sdk/widget-types";
import { createColumnHelper } from "@tanstack/react-table";
import { domAnimation, LazyMotion, m } from "motion/react";
import { useSeo } from "../../hooks/use-seo";

// ---------------------------------------------------------------------------
// Expanded view column definitions
// ---------------------------------------------------------------------------

const colHelper = createColumnHelper<SearchQuery>();

const SEO_COLUMNS = [
  colHelper.accessor("query", {
    header: "Query",
    cell: (info) => {
      const q = info.row.original;
      return (
        <div className="flex max-w-sidebar items-center gap-1.5">
          {Boolean(q.projectColor) && (
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: q.projectColor }}
            />
          )}
          <span className="truncate text-muted-foreground">{info.getValue()}</span>
        </div>
      );
    },
  }),
  colHelper.accessor("clicks", {
    header: "Clicks",
    meta: { align: "right" },
    cell: (info) => <span className="text-dim">{formatNumber(info.getValue())}</span>,
  }),
  colHelper.accessor("impressions", {
    header: "Impr.",
    meta: { align: "right" },
    cell: (info) => <span className="text-dim">{formatNumber(info.getValue())}</span>,
  }),
  colHelper.accessor("ctr", {
    header: "CTR",
    meta: { align: "right" },
    cell: (info) => <span className="text-dim">{info.getValue().toFixed(1)}%</span>,
  }),
  colHelper.accessor("position", {
    header: "Pos.",
    meta: { align: "right" },
    cell: (info) => <span className="text-dim">{info.getValue().toFixed(1)}</span>,
  }),
];

function SeoKPI({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-raised px-3 py-2.5">
      <div className="font-mono text-dim text-w-sm uppercase tracking-wider">{label}</div>
      <div className="mt-0.5 font-mono text-foreground-secondary text-w-lg">{value}</div>
    </div>
  );
}

export function SeoExpanded({
  projectSlug,
  timeRange = "30d",
  onConnectService,
}: WidgetRenderProps<WidgetTemplateConfig>) {
  const { isDemoMode } = useDemoMode();
  const { data: seoData, loading } = useSeo(projectSlug, null, timeRange, isDemoMode);
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center font-mono text-dim text-w-base">
        Loading...
      </div>
    );
  }

  if (!seoData || ("configured" in seoData && seoData.configured === false)) {
    const setupState =
      seoData && typeof seoData === "object"
        ? (seoData as {
            ctaLabel?: string;
            ctaTarget?: string;
            setupMessage?: string;
          })
        : null;

    return (
      <div className="flex h-full items-center justify-center">
        <WidgetNotConfigured
          serviceName="Google Search Console"
          serviceId={setupState?.ctaTarget ?? "google-search-console"}
          message={setupState?.setupMessage}
          actionLabel={setupState?.ctaLabel}
          onConnect={onConnectService}
        />
      </div>
    );
  }

  const seo = seoData as SeoOverview;

  return (
    <LazyMotion features={domAnimation}>
      <m.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="flex h-full flex-col"
      >
        {/* Summary KPIs */}
        <div className="grid shrink-0 grid-cols-4 gap-px bg-secondary">
          <SeoKPI label="Clicks" value={formatNumber(seo.totalClicks)} />
          <SeoKPI label="Impressions" value={formatNumber(seo.totalImpressions)} />
          <SeoKPI label="CTR" value={`${seo.avgCtr.toFixed(1)}%`} />
          <SeoKPI label="Avg Position" value={seo.avgPosition.toFixed(1)} />
        </div>

        <div className="flex min-h-0 flex-1">
          {/* Left: trend charts */}
          <div className="flex w-[260px] shrink-0 flex-col border-border border-r">
            {seo.clicksTrend.length > 0 && (
              <div className="border-border border-b p-3">
                <div className="mb-2 font-mono text-dim text-w-sm uppercase tracking-wider">
                  Clicks Trend
                </div>
                <div className="flex h-14 items-end gap-0.5">
                  {seo.clicksTrend.map((point) => {
                    const max = Math.max(...seo.clicksTrend.map((p) => p.value));
                    const pct = max > 0 ? (point.value / max) * 100 : 0;
                    return (
                      <div
                        key={point.date}
                        className="flex-1 rounded-t-sm bg-[#4ade80] opacity-60 transition-opacity hover:opacity-100"
                        style={{ height: `${Math.max(pct, 4)}%` }}
                        title={`${point.date}: ${point.value}`}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {seo.impressionsTrend.length > 0 && (
              <div className="p-3">
                <div className="mb-2 font-mono text-dim text-w-sm uppercase tracking-wider">
                  Impressions Trend
                </div>
                <div className="flex h-14 items-end gap-0.5">
                  {seo.impressionsTrend.map((point) => {
                    const max = Math.max(...seo.impressionsTrend.map((p) => p.value));
                    const pct = max > 0 ? (point.value / max) * 100 : 0;
                    return (
                      <div
                        key={point.date}
                        className="flex-1 rounded-t-sm bg-accent opacity-60 transition-opacity hover:opacity-100"
                        style={{ height: `${Math.max(pct, 4)}%` }}
                        title={`${point.date}: ${point.value}`}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right: sortable + filterable query table */}
          <div className="min-h-0 flex-1">
            <WidgetTable
              stateKey="seo:queries"
              columns={SEO_COLUMNS}
              data={seo.queries}
              defaultSorting={[{ id: "clicks", desc: true }]}
              filterPlaceholder="Filter queries…"
              emptyMessage="No queries"
            />
          </div>
        </div>
      </m.div>
    </LazyMotion>
  );
}
