"use client";

import { cn } from "@radarboard/utils/cn";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { useMemo } from "react";
import { InlineListHeader, InlineListRow } from "../../../components/inline-list-layout";
import { WidgetTable } from "../../../components/widget-table";
import { readTableSort } from "../../../hooks/use-table-state";
import { TemplateItemProvider, useResolvedData, useResolvedSourceState } from "../../data-resolver";
import { type TemplateFilterState, useTemplateFilterState } from "../../filter-state";
import type {
  DenseRankedTableColumnConfig,
  DenseRankedTableFilterRule,
  DenseRankedTableSectionConfig,
} from "../../types";
import { getByPath } from "../../utils/get-by-path";
import { encodeSelectionValue } from "../../utils/selection";

type DenseRow = Record<string, unknown>;

function readPersistedFilterState(persistKey: string | undefined): TemplateFilterState | null {
  if (!persistKey || typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(persistKey);
    return raw ? (JSON.parse(raw) as TemplateFilterState) : null;
  } catch {
    return null;
  }
}

function opportunityColor(score: number | null): string {
  if (score === null) return "text-[#444]";
  if (score >= 60) return "text-emerald-400";
  if (score >= 30) return "text-amber-400";
  return "text-dim";
}

function deriveValue(row: DenseRow, field: string | undefined) {
  if (!field) return null;
  if (field === "opportunity") {
    const rank = Number(getByPath(row, "currentRanking"));
    const popularity = Number(getByPath(row, "popularity"));
    const difficulty = Number(getByPath(row, "difficulty"));
    if (rank >= 1000) return null;
    return Math.round(
      (popularity / 100) * (1 - difficulty / 100) * Math.max(0, 1 - rank / 100) * 100
    );
  }
  return getByPath(row, field);
}

function applyFilterRules(
  rows: DenseRow[],
  state: TemplateFilterState,
  rules: DenseRankedTableFilterRule[]
) {
  return rows.filter((row) => rules.every((rule) => matchesRule(row, state, rule)));
}

function getSelectionValue(row: DenseRow, config: DenseRankedTableSectionConfig) {
  const selection = config.selection;
  if (!selection) return null;
  const key = getByPath(row, selection.keyField);
  if (key == null) return null;
  return encodeSelectionValue(selection.selectionId, String(key));
}

function compareValues(a: unknown, b: unknown) {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a ?? "").localeCompare(String(b ?? ""));
}

function sortRows(
  rows: DenseRow[],
  sorting: SortingState,
  columns: DenseRankedTableColumnConfig[]
) {
  const primary = sorting[0];
  if (!primary) return rows;
  const column = columns.find((item) => item.key === primary.id);
  if (!column) return rows;

  return [...rows].sort((left, right) => {
    const leftValue = deriveValue(left, column.field);
    const rightValue = deriveValue(right, column.field);
    const comparison = compareValues(leftValue, rightValue);
    return primary.desc ? -comparison : comparison;
  });
}

function renderDelta(value: number) {
  if (value > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 font-mono text-emerald-400 text-w-base">
        <ArrowUp className="icon-xs" />
        {value}
      </span>
    );
  }

  if (value < 0) {
    return (
      <span className="inline-flex items-center gap-0.5 font-mono text-red-400 text-w-base">
        <ArrowDown className="icon-xs" />
        {Math.abs(value)}
      </span>
    );
  }

  return <Minus className="icon-xs text-[#333]" />;
}

function matchesRule(row: DenseRow, state: TemplateFilterState, rule: DenseRankedTableFilterRule) {
  const filterValue = state[rule.controlId];

  if (rule.kind === "select") {
    if (typeof filterValue !== "string" || filterValue.length === 0) return true;
    return String(getByPath(row, rule.field) ?? "") === filterValue;
  }

  if (rule.kind === "range") {
    if (
      !filterValue ||
      typeof filterValue !== "object" ||
      !("enabled" in filterValue) ||
      !filterValue.enabled
    ) {
      return true;
    }

    const numericValue = Number(getByPath(row, rule.field));
    return numericValue >= filterValue.min && numericValue <= filterValue.max;
  }

  if (!filterValue) return true;
  const actualValue = getByPath(row, rule.field);
  if (rule.operator === "eq") return actualValue === rule.value;
  return actualValue !== rule.value;
}

function getDenseRowKey(row: DenseRow, index: number) {
  const parts = [
    getByPath(row, "id"),
    getByPath(row, "keyword"),
    getByPath(row, "store"),
    getByPath(row, "name"),
    getByPath(row, "title"),
  ].filter((value) => value != null && String(value).length > 0);

  if (parts.length > 0) {
    return parts.map((part) => String(part)).join(":");
  }

  return `dense-row:${index}`;
}

function renderCompactCell(row: DenseRow, column: DenseRankedTableColumnConfig) {
  const value = deriveValue(row, column.field);

  if (column.variant === "rank") {
    return (
      <span className="font-mono font-semibold text-[#bbb] text-w-sm tabular-nums">
        {String(value ?? "—")}
      </span>
    );
  }

  if (column.variant === "bar" && typeof value === "number") {
    return (
      <div className="flex items-center gap-1.5">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.min(value, 100)}%`,
              backgroundColor: column.color ?? "#5b8af5",
            }}
          />
        </div>
        <span className="w-5 shrink-0 text-right font-mono text-dim text-w-sm tabular-nums">
          {value}
        </span>
      </div>
    );
  }

  if (column.variant === "delta" && typeof value === "number") {
    return renderDelta(value);
  }

  if (column.variant === "flag") {
    return <span className="text-w-base">{String(value ?? "")}</span>;
  }

  if (column.variant === "number" && typeof value === "number") {
    return (
      <span
        className={cn(
          "font-mono text-w-sm tabular-nums",
          column.field === "opportunity" && opportunityColor(value)
        )}
      >
        {value}
      </span>
    );
  }

  return (
    <span className="truncate font-mono text-foreground-secondary text-w-sm">
      {String(value ?? "—")}
    </span>
  );
}

function DenseTableCompact({
  config,
  rows,
  onSelectedDetailIdChange,
}: {
  config: DenseRankedTableSectionConfig;
  rows: DenseRow[];
  onSelectedDetailIdChange?: (id: string | null) => void;
}) {
  return (
    <div className="flex flex-col">
      <InlineListHeader
        gridTemplateColumns={config.gridTemplateColumns ?? ""}
        columns={config.columns.map((column) => ({
          key: column.key,
          label: column.header,
          align: column.align,
        }))}
      />
      <div className="divide-y divide-[#111]">
        {rows.map((row, rowIndex) => (
          <TemplateItemProvider key={getDenseRowKey(row, rowIndex)} item={row}>
            <InlineListRow
              gridTemplateColumns={config.gridTemplateColumns ?? ""}
              onClick={
                config.selection && onSelectedDetailIdChange
                  ? () => {
                      const selectionValue = getSelectionValue(row, config);
                      if (selectionValue) onSelectedDetailIdChange(selectionValue);
                    }
                  : undefined
              }
              cells={config.columns.map((column) => ({
                key: column.key,
                align: column.align,
                content: renderCompactCell(row, column),
              }))}
            />
          </TemplateItemProvider>
        ))}
      </div>
    </div>
  );
}

function DenseTableExpanded({
  config,
  rows,
  onSelectedDetailIdChange,
}: {
  config: DenseRankedTableSectionConfig;
  rows: DenseRow[];
  onSelectedDetailIdChange?: (id: string | null) => void;
}) {
  const columns = useMemo<ColumnDef<DenseRow>[]>(
    () =>
      config.columns.map((column) => ({
        id: column.key,
        accessorFn: (row) => deriveValue(row, column.field),
        header: column.header,
        enableSorting: column.sortable ?? false,
        size: column.width,
        meta: { align: column.align ?? "left" },
        cell: (info) => renderExpandedCell(column, info.getValue()),
      })),
    [config.columns]
  );

  const defaultSorting = config.defaultSort
    ? ([
        { id: config.defaultSort.key, desc: config.defaultSort.direction === "desc" },
      ] satisfies SortingState)
    : undefined;

  return (
    <WidgetTable
      stateKey={config.stateKey ?? "dense-ranked-table"}
      columns={columns}
      data={rows}
      defaultSorting={defaultSorting}
      filterPlaceholder={config.filterPlaceholder}
      emptyMessage={config.emptyMessage ?? "No results"}
      onRowClick={
        config.selection && onSelectedDetailIdChange
          ? (row) => {
              const selectionValue = getSelectionValue(row, config);
              if (selectionValue) onSelectedDetailIdChange(selectionValue);
            }
          : undefined
      }
    />
  );
}

function renderExpandedCell(column: DenseRankedTableColumnConfig, value: unknown) {
  if (column.variant === "delta" && typeof value === "number") {
    return renderDelta(value);
  }

  if (column.variant === "bar" && typeof value === "number") {
    return (
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-14 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.min(value, 100)}%`,
              backgroundColor: column.color ?? "#5b8af5",
            }}
          />
        </div>
        <span className="text-dim">{value}</span>
      </div>
    );
  }

  if (column.variant === "flag") {
    return <span className="text-w-base">{String(value ?? "")}</span>;
  }

  return <span className="text-muted-foreground">{String(value ?? "—")}</span>;
}

export function DenseRankedTableSection({
  config,
  onSelectedDetailIdChange,
}: {
  config: DenseRankedTableSectionConfig;
  onSelectedDetailIdChange?: (id: string | null) => void;
}) {
  const sourceState = useResolvedSourceState(config.source.sourceId);
  const resolved = useResolvedData(config.source, { disableItemContext: true });
  const rows = Array.isArray(resolved)
    ? resolved.filter((row): row is DenseRow => !!row && typeof row === "object")
    : [];

  const { state } = useTemplateFilterState(
    config.filterStateId ?? "dense-ranked-table",
    {},
    config.filterPersistKey
  );
  const effectiveState = useMemo(
    () => ({
      ...(readPersistedFilterState(config.filterPersistKey) ?? {}),
      ...state,
    }),
    [config.filterPersistKey, state]
  );
  const filteredRows = config.filterRules
    ? applyFilterRules(rows, effectiveState, config.filterRules)
    : rows;
  const sorting = readTableSort(
    config.stateKey ?? "dense-ranked-table",
    config.defaultSort
      ? [{ id: config.defaultSort.key, desc: config.defaultSort.direction === "desc" }]
      : []
  );
  const sortedRows = sortRows(filteredRows, sorting, config.columns);
  const visibleRows = config.maxItems ? sortedRows.slice(0, config.maxItems) : sortedRows;

  if (sourceState.loading && visibleRows.length === 0) {
    return (
      <div className="flex min-h-widget-sm items-center justify-center px-3 text-center font-mono text-dim text-w-sm">
        Loading…
      </div>
    );
  }

  if (visibleRows.length === 0) {
    return (
      <div className="flex min-h-widget-sm items-center justify-center px-3 text-center font-mono text-dim text-w-sm">
        {config.emptyMessage ?? "No results"}
      </div>
    );
  }

  return config.variant === "expanded" ? (
    <DenseTableExpanded
      config={config}
      rows={visibleRows}
      onSelectedDetailIdChange={onSelectedDetailIdChange}
    />
  ) : (
    <DenseTableCompact
      config={config}
      rows={visibleRows}
      onSelectedDetailIdChange={onSelectedDetailIdChange}
    />
  );
}
