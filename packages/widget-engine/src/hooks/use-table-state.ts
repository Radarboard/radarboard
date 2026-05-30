"use client";

import type { ColumnSizingState, SortingState } from "@tanstack/react-table";
import { useEffect, useState } from "react";

const STORAGE_PREFIX = "radarboard:table";

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage quota exceeded or private browsing — silently ignore
  }
}

export interface TableStateDefaults {
  sorting?: SortingState;
  globalFilter?: string;
  columnSizing?: ColumnSizingState;
}

/**
 * Persists TanStack Table sort + filter + column sizing state to localStorage.
 * All state is keyed per `stateKey` (e.g. "aso-keywords:keywords").
 * Safe to call during SSR — localStorage access is guarded.
 */
export function useTableState(stateKey: string, defaults: TableStateDefaults = {}) {
  const sortKey = `${STORAGE_PREFIX}:${stateKey}:sort`;
  const filterKey = `${STORAGE_PREFIX}:${stateKey}:filter`;
  const sizingKey = `${STORAGE_PREFIX}:${stateKey}:sizing`;

  const [sorting, setSorting] = useState<SortingState>(() =>
    readStorage(sortKey, defaults.sorting ?? [])
  );

  const [globalFilter, setGlobalFilter] = useState<string>(() =>
    readStorage(filterKey, defaults.globalFilter ?? "")
  );

  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(() =>
    readStorage(sizingKey, defaults.columnSizing ?? {})
  );

  // Persist on change
  useEffect(() => {
    writeStorage(sortKey, sorting);
  }, [sortKey, sorting]);
  useEffect(() => {
    writeStorage(filterKey, globalFilter);
  }, [filterKey, globalFilter]);
  useEffect(() => {
    writeStorage(sizingKey, columnSizing);
  }, [sizingKey, columnSizing]);

  return { sorting, setSorting, globalFilter, setGlobalFilter, columnSizing, setColumnSizing };
}

/**
 * Read-only: get the saved sort state for a table without subscribing to changes.
 * Useful for compact widget views that want to mirror the expanded table's sort order.
 */
export function readTableSort(stateKey: string, fallback: SortingState = []): SortingState {
  return readStorage(`${STORAGE_PREFIX}:${stateKey}:sort`, fallback);
}
