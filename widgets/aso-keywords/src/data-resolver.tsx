"use client";

import { formatTimeAgo } from "@radarboard/utils/format-time-ago";
import {
  type DataSourceResolverProps,
  registerTemplateDataSource,
  reportResolverState,
} from "@radarboard/widget-sdk/data-source-registry";
import { useEffect, useMemo, useState } from "react";
import { useAsoKeywords } from "./hooks/use-aso-keywords";

function getAsoKeywordKey(keyword: { keyword: string; store: string }) {
  return `${keyword.keyword}::${keyword.store}`;
}

function countryFlag(code: string): string {
  return Array.from(code.toUpperCase())
    .map((character) => String.fromCodePoint(0x1f1e6 + character.charCodeAt(0) - 65))
    .join("");
}

function readExpandedAsoFiltersRaw() {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem("radarboard:widget:aso-keywords:expanded");
  } catch {
    return null;
  }
}

type RangeFilter = { min: number; max: number; enabled: boolean } | null;

function readRangeFilter(value: unknown): RangeFilter {
  return value && typeof value === "object"
    ? (value as { min: number; max: number; enabled: boolean })
    : null;
}

function outsideRange(value: number, range: RangeFilter): boolean {
  return range?.enabled === true && (value < range.min || value > range.max);
}

type AsoFilterableRow = {
  store: string;
  popularity: number;
  difficulty: number;
  currentRanking: number;
  rankingChange: number;
};

function matchesAsoFilters(
  row: AsoFilterableRow,
  store: string,
  onlyChanged: boolean,
  popularity: RangeFilter,
  difficulty: RangeFilter,
  rank: RangeFilter
): boolean {
  if (store.length > 0 && row.store !== store) return false;
  if (outsideRange(row.popularity, popularity)) return false;
  if (outsideRange(row.difficulty, difficulty)) return false;
  if (outsideRange(row.currentRanking, rank)) return false;
  if (onlyChanged && row.rankingChange === 0) return false;
  return true;
}

function applyExpandedAsoFilters<T extends AsoFilterableRow>(
  rows: T[],
  filters: Record<string, unknown> | null
) {
  if (!filters) return rows;

  const store = typeof filters.store === "string" ? filters.store : "";
  const onlyChanged = filters.onlyChanged === true;
  const popularity = readRangeFilter(filters.popularity);
  const difficulty = readRangeFilter(filters.difficulty);
  const rank = readRangeFilter(filters.rank);

  return rows.filter((row) =>
    matchesAsoFilters(row, store, onlyChanged, popularity, difficulty, rank)
  );
}

function AsoResolver({ projectSlug, onState }: DataSourceResolverProps) {
  const { data, fetchedAt, loading, error, refetch, isStale } = useAsoKeywords(projectSlug);
  const [expandedFiltersRaw, setExpandedFiltersRaw] = useState<string | null>(
    readExpandedAsoFiltersRaw
  );
  const expandedFilters = useMemo(() => {
    if (!expandedFiltersRaw) return null;
    try {
      return JSON.parse(expandedFiltersRaw) as Record<string, unknown>;
    } catch {
      return null;
    }
  }, [expandedFiltersRaw]);

  useEffect(() => {
    const handleChange = (event: Event) => {
      const detail = (event as CustomEvent<{ persistKey?: string }>).detail;
      if (detail?.persistKey === "radarboard:widget:aso-keywords:expanded") {
        setExpandedFiltersRaw(readExpandedAsoFiltersRaw());
      }
    };

    window.addEventListener("template-filter-state-change", handleChange);
    return () => window.removeEventListener("template-filter-state-change", handleChange);
  }, []);

  const resolvedData = useMemo(() => {
    if (!data) return null;

    const keywords = data.keywords.map((keyword) => ({
      ...keyword,
      key: getAsoKeywordKey(keyword),
      countryFlag: countryFlag(keyword.store),
      storeLabel: keyword.store.toUpperCase(),
      opportunity:
        keyword.currentRanking >= 1000
          ? null
          : Math.round(
              (keyword.popularity / 100) *
                (1 - keyword.difficulty / 100) *
                Math.max(0, 1 - keyword.currentRanking / 100) *
                100
            ),
    }));

    return {
      ...data,
      stores: data.availableStores.map((store) => ({
        value: store,
        label: `${countryFlag(store)} ${store.toUpperCase()}`,
      })),
      keywords,
      compactKeywords: applyExpandedAsoFilters(keywords, expandedFilters),
      isStale,
      staleMessage: (() => {
        if (!isStale) return null;
        if (fetchedAt)
          return `Astro offline · cached ${formatTimeAgo(new Date(fetchedAt * 1000).toISOString())}`;
        return "Astro offline · using cached data";
      })(),
      updatedLabel: data.lastAstroUpdate
        ? `Updated ${formatTimeAgo(data.lastAstroUpdate)}`
        : "No data yet",
    };
  }, [data, fetchedAt, isStale, expandedFilters]);

  useEffect(() => {
    reportResolverState(onState, {
      data: resolvedData,
      fetchedAt,
      refetch,
      loading,
      error,
    });
  }, [resolvedData, fetchedAt, refetch, loading, error, onState]);

  return null;
}

registerTemplateDataSource("aso", AsoResolver);
