"use client";

/**
 * ASO Keywords — Compact grid view
 */

import type { AsoKeyword } from "@radarboard/types/aso-keywords";
import { Dialog } from "@radarboard/ui/app-dialog";
import { NativeSelect } from "@radarboard/ui/select";
import { cn } from "@radarboard/utils/cn";
import { formatTimeAgo } from "@radarboard/utils/format-time-ago";
import { useSelectedItem } from "@radarboard/widget-engine/hooks/use-selected-item";
import { readTableSort } from "@radarboard/widget-engine/hooks/use-table-state";
import { useWidgetCallbacks } from "@radarboard/widget-engine/hooks/use-widget-callbacks";
import { InlineListHeader, InlineListRow } from "@radarboard/widget-engine/inline-list-layout";
import { SummaryMetricCell } from "@radarboard/widget-engine/summary-metric-cell";
import { WidgetModalDialogContent } from "@radarboard/widget-engine/widget-modal";
import type { AsoKeywordsConfig, WidgetRenderProps } from "@radarboard/widget-sdk/widget-types";
import { ArrowDown, ArrowUp, Minus, WifiOff } from "lucide-react";
import { domAnimation, LazyMotion, m } from "motion/react";
import { useCallback, useMemo, useState } from "react";
import { useAsoKeywords } from "../../hooks/use-aso-keywords";
import { AsoKeywordDetail } from "../aso-keyword-detail";

// ---------------------------------------------------------------------------
// Sort sync: compact view mirrors the expanded table's sort order
// ---------------------------------------------------------------------------

export const TABLE_STATE_KEY = "aso-keywords:keywords";
export const DEFAULT_SORT = [{ id: "currentRanking", desc: false }];

export function getAsoKeywordKey(keyword: AsoKeyword): string {
  return `${keyword.keyword}::${keyword.store}`;
}

/**
 * Apply TanStack SortingState to a keyword array.
 * Supports all sortable columns in EXPANDED_COLUMNS.
 */
export function applySortToKeywords(
  keywords: AsoKeyword[],
  sortState: { id: string; desc: boolean }[]
): AsoKeyword[] {
  const primary = sortState[0];
  if (!primary) return keywords;
  const { id, desc } = primary;

  const sorted = [...keywords].sort((a, b) => {
    let cmp = 0;
    switch (id) {
      case "currentRanking":
        cmp = a.currentRanking - b.currentRanking;
        break;
      case "keyword":
        cmp = a.keyword.localeCompare(b.keyword);
        break;
      case "store":
        cmp = a.store.localeCompare(b.store);
        break;
      case "rankingChange":
        cmp = a.rankingChange - b.rankingChange;
        break;
      case "difficulty":
        cmp = a.difficulty - b.difficulty;
        break;
      case "popularity":
        cmp = a.popularity - b.popularity;
        break;
      case "appsCount":
        cmp = a.appsCount - b.appsCount;
        break;
      case "opportunity": {
        const sa = opportunityScore(a) ?? -1;
        const sb = opportunityScore(b) ?? -1;
        cmp = sa - sb;
        break;
      }
      default:
        cmp = 0;
    }
    return desc ? -cmp : cmp;
  });

  return sorted;
}

// ---------------------------------------------------------------------------
// Helpers (exported for use by expanded view)
// ---------------------------------------------------------------------------

/**
 * Convert a 2-letter ISO country code to its emoji flag.
 */
export function countryFlag(code: string): string {
  return Array.from(code.toUpperCase())
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join("");
}

export const STORE_NAMES: Record<string, string> = {
  au: "Australia",
  br: "Brazil",
  ca: "Canada",
  fr: "France",
  gb: "UK",
  hk: "Hong Kong",
  id: "Indonesia",
  in: "India",
  jp: "Japan",
  kr: "Korea",
  my: "Malaysia",
  ph: "Philippines",
  pt: "Portugal",
  tw: "Taiwan",
  us: "US",
  vn: "Vietnam",
};

export function storeLabel(code: string): string {
  return code.toUpperCase();
}

export function storeName(code: string): string {
  return STORE_NAMES[code] ?? code.toUpperCase();
}

export function fmtRank(rank: number): string {
  return rank >= 1000 ? "—" : String(rank);
}

export function rankColor(rank: number): string {
  if (rank === 1) return "text-yellow-400";
  if (rank === 2) return "text-slate-300";
  if (rank === 3) return "text-orange-400";
  if (rank >= 1000) return "text-[#444]";
  return "text-[#bbb]";
}

export function opportunityScore(kw: AsoKeyword): number | null {
  if (kw.currentRanking >= 1000) return null;
  const popFactor = kw.popularity / 100;
  const easyFactor = 1 - kw.difficulty / 100;
  const rankFactor = Math.max(0, 1 - kw.currentRanking / 100);
  return Math.round(popFactor * easyFactor * rankFactor * 100);
}

export function opportunityColor(score: number | null): string {
  if (score === null) return "text-[#444]";
  if (score >= 60) return "text-emerald-400";
  if (score >= 30) return "text-amber-400";
  return "text-dim";
}

// ---------------------------------------------------------------------------
// Sub-components (exported for use by expanded view)
// ---------------------------------------------------------------------------

export function RankChange({ change }: { change: number }) {
  if (change > 0)
    return (
      <span className="inline-flex items-center gap-0.5 font-mono text-emerald-400 text-w-base">
        <ArrowUp className="icon-xs" />
        {change}
      </span>
    );
  if (change < 0)
    return (
      <span className="inline-flex items-center gap-0.5 font-mono text-red-400 text-w-base">
        <ArrowDown className="icon-xs" />
        {Math.abs(change)}
      </span>
    );
  return <Minus className="icon-xs text-[#333]" />;
}

export function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-secondary">
        <div
          className={cn("h-full rounded-full", color)}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
      <span className="w-5 text-right font-mono text-dim text-w-sm">{value}</span>
    </div>
  );
}

export function fmtLastUpdate(iso: string | undefined): string {
  if (!iso) return "No data yet";
  return `Updated ${formatTimeAgo(iso)}`;
}

export function OfflineBanner({ fetchedAt }: { fetchedAt: number | null }) {
  const ago = fetchedAt ? formatTimeAgo(new Date(fetchedAt * 1000).toISOString()) : "unknown time";
  return (
    <div className="flex shrink-0 items-center gap-1.5 border-amber-900/50 border-b bg-[#1a1400] px-3 py-1.5">
      <WifiOff className="icon-xs shrink-0 text-amber-500" />
      <span className="font-mono text-amber-500/80 text-w-sm">Astro offline · cached {ago}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Store selector (persisted to localStorage)
// ---------------------------------------------------------------------------

const STORE_PREF_KEY = "radarboard:widget:aso-keywords:store";

function readStorePref(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(STORE_PREF_KEY);
  } catch {
    return null;
  }
}

function writeStorePref(store: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (store) localStorage.setItem(STORE_PREF_KEY, store);
    else localStorage.removeItem(STORE_PREF_KEY);
  } catch {
    /* ignore */
  }
}

export function useSelectedStore(
  initialStore: string | null = null
): [string | null, (s: string | null) => void] {
  const [store, setStore] = useState<string | null>(() => readStorePref() ?? initialStore);
  const set = useCallback((s: string | null) => {
    setStore(s);
    writeStorePref(s);
  }, []);
  return [store, set];
}

export function StoreSelector({
  availableStores,
  selected,
  onChange,
  className,
}: {
  availableStores: string[];
  selected: string | null;
  onChange: (store: string | null) => void;
  className?: string;
}) {
  if (availableStores.length <= 1) return null;
  return (
    <NativeSelect
      value={selected ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      variant="surface"
      size="sm"
      className={cn("font-mono uppercase tracking-wider", className)}
    >
      <option value="">All</option>
      {availableStores.map((s) => (
        <option key={s} value={s}>
          {countryFlag(s)} {storeName(s)}
        </option>
      ))}
    </NativeSelect>
  );
}

// ---------------------------------------------------------------------------
// Range filter state (persisted to localStorage)
// ---------------------------------------------------------------------------

export interface FilterRange {
  min: number;
  max: number;
  enabled: boolean;
}

export interface AsoFilters {
  popularity: FilterRange;
  difficulty: FilterRange;
  rank: FilterRange;
  onlyChanged: boolean;
}

export const DEFAULT_FILTERS: AsoFilters = {
  popularity: { min: 0, max: 100, enabled: false },
  difficulty: { min: 0, max: 100, enabled: false },
  rank: { min: 1, max: 1000, enabled: false },
  onlyChanged: false,
};

const FILTERS_KEY = "radarboard:widget:aso-keywords:filters";

export function readFilters(): AsoFilters {
  if (typeof window === "undefined") return DEFAULT_FILTERS;
  try {
    const raw = localStorage.getItem(FILTERS_KEY);
    if (!raw) return DEFAULT_FILTERS;
    const parsed = JSON.parse(raw) as Partial<AsoFilters>;
    return {
      popularity: { ...DEFAULT_FILTERS.popularity, ...parsed.popularity },
      difficulty: { ...DEFAULT_FILTERS.difficulty, ...parsed.difficulty },
      rank: { ...DEFAULT_FILTERS.rank, ...parsed.rank },
      onlyChanged: parsed.onlyChanged ?? false,
    };
  } catch {
    return DEFAULT_FILTERS;
  }
}

function writeFilters(f: AsoFilters): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(FILTERS_KEY, JSON.stringify(f));
  } catch {
    /* ignore */
  }
}

export function useAsoFilters(): [AsoFilters, (patch: Partial<AsoFilters>) => void, () => void] {
  const [filters, setFilters] = useState<AsoFilters>(readFilters);
  const update = useCallback((patch: Partial<AsoFilters>) => {
    setFilters((prev) => {
      const next = { ...prev, ...patch };
      writeFilters(next);
      return next;
    });
  }, []);
  const reset = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    writeFilters(DEFAULT_FILTERS);
  }, []);
  return [filters, update, reset];
}

export function applyFilters(keywords: AsoKeyword[], filters: AsoFilters): AsoKeyword[] {
  return keywords.filter((kw) => {
    const { popularity, difficulty, rank, onlyChanged } = filters;
    if (onlyChanged && kw.rankingChange === 0) return false;
    if (popularity.enabled && (kw.popularity < popularity.min || kw.popularity > popularity.max))
      return false;
    if (difficulty.enabled && (kw.difficulty < difficulty.min || kw.difficulty > difficulty.max))
      return false;
    if (rank.enabled && (kw.currentRanking < rank.min || kw.currentRanking > rank.max))
      return false;
    return true;
  });
}

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

export function PodiumKPI({ rank, count }: { rank: 1 | 2 | 3; count: number }) {
  const getVariant = () => {
    if (rank === 1) return "podium-gold";
    if (rank === 2) return "podium-silver";
    return "podium-bronze";
  };
  const variant = getVariant();
  return <SummaryMetricCell label={`#${rank}`} value={String(count)} variant={variant} />;
}

// ---------------------------------------------------------------------------
// Compact row
// ---------------------------------------------------------------------------

const ASO_COMPACT_GRID_TEMPLATE = "32px minmax(0,1fr) 84px 84px 40px 40px 44px";

function MiniBar({ value, color, label }: { value: number; color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5" title={label}>
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-secondary">
        <div
          className={cn("h-full rounded-full", color)}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
      <span className="w-5 shrink-0 text-right font-mono text-dim text-w-sm tabular-nums">
        {value}
      </span>
    </div>
  );
}

function KeywordRow({ kw, onClick }: { kw: AsoKeyword; onClick?: () => void }) {
  const opp = opportunityScore(kw);
  return (
    <InlineListRow
      gridTemplateColumns={ASO_COMPACT_GRID_TEMPLATE}
      onClick={onClick}
      cells={[
        {
          key: "rank",
          align: "right",
          content: (
            <span
              className={cn(
                "font-mono font-semibold text-w-sm tabular-nums",
                rankColor(kw.currentRanking)
              )}
            >
              {fmtRank(kw.currentRanking)}
            </span>
          ),
        },
        {
          key: "keyword",
          content: (
            <span className="truncate font-mono text-foreground-secondary text-w-sm">
              {kw.keyword}
            </span>
          ),
        },
        {
          key: "popularity",
          content: (
            <MiniBar
              value={kw.popularity}
              color="bg-accent"
              label={`Popularity: ${kw.popularity}`}
            />
          ),
        },
        {
          key: "difficulty",
          content: (
            <MiniBar
              value={kw.difficulty}
              color="bg-orange-500"
              label={`Difficulty: ${kw.difficulty}`}
            />
          ),
        },
        {
          key: "opportunity",
          align: "right",
          content: (
            <span
              className={cn("font-mono text-w-sm tabular-nums", opportunityColor(opp))}
              title="Opportunity"
            >
              {opp !== null ? opp : "—"}
            </span>
          ),
        },
        {
          key: "store",
          align: "center",
          content: (
            <span className="text-w-base" title={storeName(kw.store)}>
              {countryFlag(kw.store)}
            </span>
          ),
        },
        {
          key: "change",
          align: "right",
          content: <RankChange change={kw.rankingChange} />,
        },
      ]}
    />
  );
}

// ---------------------------------------------------------------------------
// Compact widget
// ---------------------------------------------------------------------------

export function AsoKeywordsCompact({
  widgetId,
  projectSlug,
  config,
  selectedDetailId,
  onSelectedDetailIdChange,
  onFetchedAt,
  onRefetch,
  onChromeStateChange,
}: WidgetRenderProps<AsoKeywordsConfig>) {
  const [selectedStore, setSelectedStore] = useSelectedStore(config.defaultStore ?? null);
  const { data, loading, configured, isStale, fetchedAt, refetch } = useAsoKeywords(
    projectSlug,
    selectedStore
  );

  useWidgetCallbacks({
    widgetId,
    projectSlug,
    sourceIds: ["aso-keywords"],
    fetchedAt: configured ? fetchedAt : null,
    loading,
    error: configured ? null : "Astro MCP not configured",
    refetch,
    chromeStatus: !loading && !configured ? "disconnected" : "default",
    onFetchedAt,
    onRefetch,
    onChromeStateChange,
  });

  const sortedKeywords = useMemo(() => {
    if (!data) return [];
    const savedFilters = readFilters();
    const filtered = applyFilters(data.keywords, savedFilters);
    const savedSort = readTableSort(TABLE_STATE_KEY, DEFAULT_SORT);
    return applySortToKeywords(filtered, savedSort);
  }, [data]);
  const keywordMap = useMemo(
    () => new Map(sortedKeywords.map((kw) => [getAsoKeywordKey(kw), kw])),
    [sortedKeywords]
  );
  const selected = useSelectedItem(selectedDetailId, keywordMap);
  const visibleKeywords = sortedKeywords.slice(0, config.compactLimit);

  if (loading || !data)
    return (
      <div className="flex h-full items-center justify-center font-mono text-dim text-w-base">
        {loading ? "Loading..." : "Astro MCP not configured"}
      </div>
    );

  if (!configured) return <NotConfigured />;

  const { summary, availableStores } = data;

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

          <div className="grid shrink-0 grid-cols-4 gap-0 border-border border-b">
            <PodiumKPI rank={1} count={summary.top1} />
            <PodiumKPI rank={2} count={summary.top2} />
            <PodiumKPI rank={3} count={summary.top3} />
            <SummaryMetricCell label="Top 10" value={String(summary.top10)} />
          </div>

          <div className="scrollbar-thin flex-1 overflow-y-auto">
            {sortedKeywords.length === 0 ? (
              <div className="flex h-full items-center justify-center font-mono text-dim text-w-sm">
                No keywords tracked
              </div>
            ) : (
              <div className="flex flex-col">
                <InlineListHeader
                  gridTemplateColumns={ASO_COMPACT_GRID_TEMPLATE}
                  columns={[
                    { key: "rank", label: "Rank", align: "right" },
                    { key: "keyword", label: "Keyword" },
                    { key: "pop", label: "Pop." },
                    { key: "diff", label: "Diff." },
                    { key: "opp", label: "Opp.", align: "right" },
                    { key: "store", label: "Store", align: "center" },
                    { key: "delta", label: "△", align: "right" },
                  ]}
                />
                <div className="divide-y divide-[#111]">
                  {visibleKeywords.map((kw) => (
                    <KeywordRow
                      key={`${kw.keyword}-${kw.store}`}
                      kw={kw}
                      onClick={() => onSelectedDetailIdChange?.(getAsoKeywordKey(kw))}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center justify-between border-border border-t px-3 py-1.5">
            <StoreSelector
              availableStores={availableStores}
              selected={selectedStore}
              onChange={setSelectedStore}
            />
            <div className="flex items-center gap-2">
              <span className="font-mono text-dim text-w-sm">{summary.total} keywords</span>
              <span className="font-mono text-dim text-w-sm">
                · {fmtLastUpdate(data.lastAstroUpdate)}
              </span>
            </div>
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
