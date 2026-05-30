"use client";

/**
 * npm Downloads — Expanded fullscreen view
 */

import { Button } from "@radarboard/ui/button";
import { formatNumber } from "@radarboard/utils/format-number";
import { useTemplateFilterState } from "@radarboard/widget-engine/templates/filter-state";
import { WidgetTable } from "@radarboard/widget-engine/widget-table";
import type { WidgetRenderProps } from "@radarboard/widget-sdk/widget-types";
import { createColumnHelper } from "@tanstack/react-table";
import { domAnimation, LazyMotion, m } from "motion/react";
import { useNpmDownloads } from "../../hooks/use-package-downloads";
import type { NpmDownloadsConfig, NpmDownloadsRange, NpmPackageData } from "../../types";

// --- Column definitions ---

const npmCol = createColumnHelper<NpmPackageData>();

const NPM_COLUMNS = [
  npmCol.accessor("name", {
    header: "Package",
    cell: (info) => (
      <a
        href={`https://www.npmjs.com/package/${info.getValue()}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[#bbb] transition-colors hover:text-destructive"
        onClick={(e) => e.stopPropagation()}
      >
        {info.getValue()}
      </a>
    ),
  }),
  npmCol.accessor("version", {
    header: "Version",
    meta: { align: "right" },
    cell: (info) => <span className="text-dim">v{info.getValue()}</span>,
  }),
  npmCol.accessor("weeklyDownloads", {
    header: "Weekly",
    meta: { align: "right" },
    cell: (info) => <span className="text-muted-foreground">{formatNumber(info.getValue())}</span>,
  }),
  npmCol.accessor("monthlyDownloads", {
    header: "Monthly",
    meta: { align: "right" },
    cell: (info) => <span className="text-muted-foreground">{formatNumber(info.getValue())}</span>,
  }),
];

const NPM_RANGE_PERSIST_KEY = "radarboard:widget:downloads:expanded";
const NPM_RANGE_STATE_ID = "downloads-expanded";
const NPM_RANGES: Array<{ value: NpmDownloadsRange; label: string }> = [
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
  { value: "12m", label: "12M" },
];

export function NpmDownloadsExpanded({
  projectSlug,
  config,
}: WidgetRenderProps<NpmDownloadsConfig>) {
  const { state, updateState } = useTemplateFilterState(
    NPM_RANGE_STATE_ID,
    { range: "30d" },
    NPM_RANGE_PERSIST_KEY
  );
  const range = (typeof state.range === "string" ? state.range : "30d") as NpmDownloadsRange;
  const { configured, data, loading } = useNpmDownloads(projectSlug, config, range);
  if (loading || !configured || !data) {
    return (
      <div className="flex h-full items-center justify-center font-mono text-dim text-w-base">
        {loading ? "Loading..." : "No npm packages configured"}
      </div>
    );
  }

  return (
    <LazyMotion features={domAnimation}>
      <m.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="flex h-full flex-col"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-border border-b px-4 py-3">
          <div className="font-mono text-dim text-w-sm uppercase tracking-wider">
            Downloads Range
          </div>
          <div className="flex items-center gap-1 rounded-item border border-border bg-[#121214] p-1">
            {NPM_RANGES.map((option) => (
              <Button
                key={option.value}
                type="button"
                onClick={() => updateState({ ...state, range: option.value })}
                variant={option.value === range ? "secondary" : "ghost"}
                size="sm"
                uppercase
                className={option.value === range ? "" : "text-dim hover:text-dim"}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-px bg-secondary">
          <div className="bg-surface-raised px-4 py-3">
            <div className="font-mono text-dim text-w-sm uppercase tracking-wider">
              Weekly Downloads
            </div>
            <div className="mt-0.5 font-mono text-foreground-secondary text-w-xl">
              {formatNumber(data.totalWeekly)}
            </div>
          </div>
          <div className="bg-surface-raised px-4 py-3">
            <div className="font-mono text-dim text-w-sm uppercase tracking-wider">
              Monthly Downloads
            </div>
            <div className="mt-0.5 font-mono text-foreground-secondary text-w-xl">
              {formatNumber(data.totalMonthly)}
            </div>
          </div>
        </div>

        <WidgetTable
          stateKey="downloads:packages"
          columns={NPM_COLUMNS}
          data={data.packages}
          defaultSorting={[{ id: "weeklyDownloads", desc: true }]}
          filterPlaceholder="Filter packages…"
          emptyMessage="No packages"
        />
      </m.div>
    </LazyMotion>
  );
}
