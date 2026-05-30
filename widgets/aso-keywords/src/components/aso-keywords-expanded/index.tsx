"use client";

/**
 * ASO Keywords — Expanded fullscreen view
 */

import type { AsoKeyword } from "@radarboard/types/aso-keywords";
import { Dialog } from "@radarboard/ui/app-dialog";
import { Button } from "@radarboard/ui/button";
import { cn } from "@radarboard/utils/cn";
import { useSelectedItem } from "@radarboard/widget-engine/hooks/use-selected-item";
import { SummaryMetricCell } from "@radarboard/widget-engine/summary-metric-cell";
import { WidgetModalDialogContent } from "@radarboard/widget-engine/widget-modal";
import { WidgetTable } from "@radarboard/widget-engine/widget-table";
import type { AsoKeywordsConfig, WidgetRenderProps } from "@radarboard/widget-sdk/widget-types";
import {
  Range as RadixSliderRange,
  Root as RadixSliderRoot,
  Thumb as RadixSliderThumb,
  Track as RadixSliderTrack,
} from "@radix-ui/react-slider";
import { createColumnHelper } from "@tanstack/react-table";
import { domAnimation, LazyMotion, m } from "motion/react";
import { useCallback, useMemo } from "react";
import { useAsoKeywords } from "../../hooks/use-aso-keywords";
import { AsoKeywordDetail } from "../aso-keyword-detail";
import {
  type AsoFilters,
  applyFilters,
  countryFlag,
  DEFAULT_SORT,
  type FilterRange,
  fmtLastUpdate,
  fmtRank,
  getAsoKeywordKey,
  OfflineBanner,
  opportunityColor,
  opportunityScore,
  PodiumKPI,
  RankChange,
  rankColor,
  ScoreBar,
  StoreSelector,
  storeLabel,
  storeName,
  TABLE_STATE_KEY,
  useAsoFilters,
  useSelectedStore,
} from "../aso-keywords-compact";

// ---------------------------------------------------------------------------
// Range filter UI components
// ---------------------------------------------------------------------------

function fmtRankVal(v: number): string {
  return v >= 1000 ? "any" : `#${v}`;
}

interface FilterSliderProps {
  label: string;
  accentColor: string;
  min: number;
  max: number;
  step: number;
  value: FilterRange;
  fmt?: (v: number) => string;
  onChange: (range: FilterRange) => void;
}

function FilterSlider({
  label,
  accentColor,
  min,
  max,
  step,
  value,
  fmt = String,
  onChange,
}: FilterSliderProps) {
  const isActive = value.enabled;
  const isFullRange = value.min === min && value.max === max;

  const toggle = () => onChange({ ...value, enabled: !value.enabled });

  const handleValueChange = useCallback(
    (vals: number[]) => {
      const [lo, hi] = vals;
      if (lo !== undefined && hi !== undefined) {
        onChange({ min: lo, max: hi, enabled: true });
      }
    },
    [onChange]
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Button
          type="button"
          onClick={toggle}
          aria-pressed={isActive}
          variant={isActive ? "outline-accent" : "outline"}
          uppercase
          className={cn(
            isActive
              ? "font-medium text-[#f0f0f0]"
              : "bg-[#181818] text-dim hover:border-[#555] hover:text-[#bbb]"
          )}
          style={
            isActive
              ? {
                  backgroundColor: `${accentColor}22`,
                  borderColor: `${accentColor}66`,
                  color: "#f0f0f0",
                }
              : undefined
          }
        >
          {label}
        </Button>

        {isActive && !isFullRange ? (
          <span className="font-mono text-foreground-secondary text-w-base tabular-nums">
            {fmt(value.min)} – {fmt(value.max)}
          </span>
        ) : (
          <span className="font-mono text-dim text-w-sm tabular-nums">
            {fmt(min)} – {fmt(max)}
          </span>
        )}
      </div>

      <RadixSliderRoot
        min={min}
        max={max}
        step={step}
        value={[value.min, value.max]}
        onValueChange={handleValueChange}
        className="relative flex h-5 w-full touch-none select-none items-center"
        aria-label={label}
      >
        <RadixSliderTrack className="relative h-[3px] w-full grow rounded-full bg-secondary">
          <RadixSliderRange
            className="absolute h-full rounded-full"
            style={{ backgroundColor: isActive ? accentColor : "#383838" }}
          />
        </RadixSliderTrack>
        <RadixSliderThumb
          className={cn(
            "icon-sm block rounded-full border-2 shadow transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5b8af5]",
            "cursor-grab active:cursor-grabbing"
          )}
          style={{
            backgroundColor: isActive ? "#e8e8e8" : "#555",
            borderColor: isActive ? accentColor : "#444",
          }}
        />
        <RadixSliderThumb
          className={cn(
            "icon-sm block rounded-full border-2 shadow transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5b8af5]",
            "cursor-grab active:cursor-grabbing"
          )}
          style={{
            backgroundColor: isActive ? "#e8e8e8" : "#555",
            borderColor: isActive ? accentColor : "#444",
          }}
        />
      </RadixSliderRoot>

      <div className="flex justify-between">
        <span className="font-mono text-dim text-w-sm">{fmt(min)}</span>
        <span className="font-mono text-dim text-w-sm">{fmt(max)}</span>
      </div>
    </div>
  );
}

function PillToggle({
  label,
  active,
  accentColor,
  onToggle,
}: {
  label: string;
  active: boolean;
  accentColor: string;
  onToggle: () => void;
}) {
  return (
    <Button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      variant={active ? "outline-accent" : "outline"}
      uppercase={false}
      className={cn(
        active
          ? "font-medium text-[#f0f0f0]"
          : "bg-[#181818] text-dim hover:border-[#555] hover:text-[#bbb]"
      )}
      style={
        active
          ? { backgroundColor: `${accentColor}22`, borderColor: `${accentColor}66` }
          : undefined
      }
    >
      {label}
    </Button>
  );
}

function filtersAreDefault(f: AsoFilters): boolean {
  return !f.popularity.enabled && !f.difficulty.enabled && !f.rank.enabled && !f.onlyChanged;
}

function RangeFilters({
  filters,
  update,
  reset,
  total,
  filtered,
}: {
  filters: AsoFilters;
  update: (f: Partial<AsoFilters>) => void;
  reset: () => void;
  total: number;
  filtered: number;
}) {
  const isDefault = filtersAreDefault(filters);
  const activeCount =
    [filters.popularity, filters.difficulty, filters.rank].filter((f) => f.enabled).length +
    (filters.onlyChanged ? 1 : 0);

  return (
    <div className="shrink-0 border-border border-b bg-surface px-4 py-3">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono text-dim text-w-base uppercase tracking-wider">Filters</span>
          {activeCount > 0 && (
            <span className="rounded-item bg-accent/20 px-1.5 py-0.5 font-mono text-accent text-w-sm">
              {activeCount} active
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {filtered !== total && (
            <span className="font-mono text-accent text-w-base tabular-nums">
              {filtered} / {total}
            </span>
          )}
          {!isDefault && (
            <Button
              type="button"
              onClick={reset}
              variant="ghost-link"
              uppercase={false}
              className="text-dim text-w-sm hover:text-muted-foreground"
            >
              reset all
            </Button>
          )}
        </div>
      </div>

      <div className="mb-3 grid grid-cols-3 gap-5">
        <FilterSlider
          label="Popularity"
          accentColor="#5b8af5"
          min={0}
          max={100}
          step={5}
          value={filters.popularity}
          onChange={(range) => update({ popularity: range })}
        />
        <FilterSlider
          label="Difficulty"
          accentColor="#f97316"
          min={0}
          max={100}
          step={5}
          value={filters.difficulty}
          onChange={(range) => update({ difficulty: range })}
        />
        <FilterSlider
          label="Rank"
          accentColor="#10b981"
          min={1}
          max={1000}
          step={1}
          value={filters.rank}
          fmt={fmtRankVal}
          onChange={(range) => update({ rank: range })}
        />
      </div>

      <div className="flex items-center gap-2 border-border border-t pt-2">
        <PillToggle
          label="Only changed"
          active={filters.onlyChanged}
          accentColor="#f5c542"
          onToggle={() => update({ onlyChanged: !filters.onlyChanged })}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TanStack column definitions
// ---------------------------------------------------------------------------

const columnHelper = createColumnHelper<AsoKeyword>();

const EXPANDED_COLUMNS = [
  columnHelper.accessor("currentRanking", {
    header: "Rank",
    size: 70,
    minSize: 50,
    meta: { align: "right" },
    cell: (info) => {
      const rank = info.getValue();
      const prev = info.row.original.previousRanking;
      return (
        <div className="flex items-center justify-end gap-1">
          <span className={cn("font-semibold tabular-nums", rankColor(rank))}>{fmtRank(rank)}</span>
          {prev < 1000 && rank < 1000 && <span className="text-dim text-w-sm">({prev})</span>}
        </div>
      );
    },
  }),
  columnHelper.accessor("keyword", {
    header: "Keyword",
    size: 220,
    minSize: 120,
    enableResizing: true,
    cell: (info) => (
      <span className="block truncate text-foreground-secondary">{info.getValue()}</span>
    ),
  }),
  columnHelper.accessor("store", {
    header: "Country",
    size: 75,
    minSize: 55,
    meta: { align: "center" },
    cell: (info) => {
      const code = info.getValue();
      return (
        <span className="inline-flex items-center gap-1" title={storeName(code)}>
          <span className="text-w-base">{countryFlag(code)}</span>
          <span className="font-mono text-dim text-w-sm uppercase">{storeLabel(code)}</span>
        </span>
      );
    },
  }),
  columnHelper.accessor("rankingChange", {
    header: "△",
    size: 55,
    minSize: 40,
    meta: { align: "right" },
    cell: (info) => <RankChange change={info.getValue()} />,
  }),
  columnHelper.accessor("difficulty", {
    header: "Diff.",
    size: 100,
    minSize: 80,
    cell: (info) => <ScoreBar value={info.getValue()} color="bg-orange-500" />,
  }),
  columnHelper.accessor("popularity", {
    header: "Pop.",
    size: 100,
    minSize: 80,
    cell: (info) => <ScoreBar value={info.getValue()} color="bg-accent" />,
  }),
  columnHelper.display({
    id: "opportunity",
    header: "Opp.",
    size: 50,
    minSize: 40,
    meta: { align: "right" },
    cell: (info) => {
      const score = opportunityScore(info.row.original);
      return (
        <span className={cn("font-mono tabular-nums", opportunityColor(score))}>
          {score !== null ? score : "—"}
        </span>
      );
    },
  }),
  columnHelper.accessor("appsCount", {
    header: "Apps",
    size: 50,
    minSize: 40,
    meta: { align: "right" },
    cell: (info) => <span className="text-dim">{info.getValue()}</span>,
  }),
];

// ---------------------------------------------------------------------------
// Not configured state
// ---------------------------------------------------------------------------

function NotConfigured() {
  return (
    <div className="flex h-full items-center justify-center px-4 text-center">
      <div>
        <p className="font-mono text-dim text-w-base">Astro MCP not configured</p>
        <p className="mt-1 font-mono text-[#444] text-w-sm">
          Add the Astro server in Settings → MCP Servers
        </p>
      </div>
    </div>
  );
}

function KPI({ label, value }: { label: string; value: string }) {
  return <SummaryMetricCell label={label} value={value} />;
}

// ---------------------------------------------------------------------------
// Expanded widget
// ---------------------------------------------------------------------------

export function AsoKeywordsExpanded({
  widgetId,
  projectSlug,
  config: _config,
  selectedDetailId,
  onSelectedDetailIdChange,
}: WidgetRenderProps<AsoKeywordsConfig>) {
  const [selectedStore, setSelectedStore] = useSelectedStore();
  const [filters, updateFilters, resetFilters] = useAsoFilters();
  const { data, loading, configured, isStale, fetchedAt } = useAsoKeywords(
    projectSlug,
    selectedStore
  );
  const filteredKeywords = useMemo(
    () => (data ? applyFilters(data.keywords, filters) : []),
    [data, filters]
  );
  const keywordMap = useMemo(
    () => new Map(filteredKeywords.map((kw) => [getAsoKeywordKey(kw), kw])),
    [filteredKeywords]
  );
  const selected = useSelectedItem(selectedDetailId, keywordMap);

  if (loading || !data)
    return (
      <div className="flex h-full items-center justify-center font-mono text-dim text-w-base">
        {loading ? "Loading..." : "Astro MCP not configured"}
      </div>
    );

  if (!configured) return <NotConfigured />;

  const { keywords, summary, availableStores } = data;

  return (
    <LazyMotion features={domAnimation}>
      <m.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="h-full"
      >
        <div className="flex h-full flex-col">
          {Boolean(isStale) && <OfflineBanner fetchedAt={fetchedAt} />}

          <div className="flex shrink-0 items-stretch">
            <div className="grid flex-1 grid-cols-6 gap-px bg-secondary">
              <PodiumKPI rank={1} count={summary.top1} />
              <PodiumKPI rank={2} count={summary.top2} />
              <PodiumKPI rank={3} count={summary.top3} />
              <KPI label="Top 10" value={String(summary.top10)} />
              <KPI label="Improving" value={`+${summary.improving}`} />
              <KPI label="Declining" value={`-${summary.declining}`} />
            </div>
            {availableStores.length > 1 && (
              <div className="flex shrink-0 items-center border-border border-l bg-surface px-3">
                <StoreSelector
                  availableStores={availableStores}
                  selected={selectedStore}
                  onChange={setSelectedStore}
                />
              </div>
            )}
          </div>

          <RangeFilters
            filters={filters}
            update={updateFilters}
            reset={resetFilters}
            total={keywords.length}
            filtered={filteredKeywords.length}
          />

          <WidgetTable
            stateKey={TABLE_STATE_KEY}
            columns={EXPANDED_COLUMNS}
            data={filteredKeywords}
            defaultSorting={DEFAULT_SORT}
            filterPlaceholder="Filter keywords or country…"
            emptyMessage="No keywords match the current filters"
            onRowClick={(kw) => onSelectedDetailIdChange?.(getAsoKeywordKey(kw))}
          />

          <div className="flex shrink-0 items-center justify-between border-border border-t px-3 py-1.5">
            <div className="flex items-center gap-2 font-mono text-dim text-w-sm">
              <span>{selectedStore ? storeLabel(selectedStore) : "All countries"}</span>
              <span className="text-[#333]">·</span>
              <span>Avg rank: {summary.avgRanking > 0 ? summary.avgRanking : "—"}</span>
              <span className="text-[#333]">·</span>
              <span>{fmtLastUpdate(data.lastAstroUpdate)}</span>
            </div>
            <span className="font-mono text-dim text-w-sm italic">
              Opp. = pop × (1−diff) × rank
            </span>
          </div>
        </div>

        <Dialog
          open={!!selected}
          onOpenChange={(open) => {
            if (!open) onSelectedDetailIdChange?.(null);
          }}
        >
          <WidgetModalDialogContent
            widgetId={widgetId ?? "aso-keywords"}
            modalId="aso.keyword"
            defaultSize="sm"
          >
            {selected && <AsoKeywordDetail keyword={selected} />}
          </WidgetModalDialogContent>
        </Dialog>
      </m.div>
    </LazyMotion>
  );
}
