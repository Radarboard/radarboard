"use client";

import { cn } from "@radarboard/utils/cn";
import { formatDateTime, isDateString } from "@radarboard/utils/format-date-time";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { useMemo } from "react";
import { WidgetTable } from "../../../components/widget-table";
import { useResolvedData, useResolvedSourceState } from "../../data-resolver";
import type { TableSectionConfig } from "../../types";
import { useTemplateFormatting } from "../../use-formatting";
import { formatValue, getSiblingCurrencyField } from "../../utils/format-value";
import { getByPath } from "../../utils/get-by-path";
import { encodeSelectionValue } from "../../utils/selection";

type TableRow = Record<string, unknown>;
const TABLE_SKELETON_ROW_KEYS = ["one", "two", "three", "four"] as const;

function getTableStateKey(config: TableSectionConfig): string {
  return `template:${config.source.sourceId}:${config.source.field || "root"}:${config.columns
    .map((column) => column.key)
    .join(",")}`;
}

function getTableSelectionValue(row: TableRow, config: TableSectionConfig): string | null {
  const selection = config.selection;
  if (!selection) return null;

  const key = getByPath(row, selection.keyField);
  if (key == null) return null;

  return encodeSelectionValue(selection.selectionId, String(key));
}

export function TableSection({
  config,
  onSelectedDetailIdChange,
}: {
  config: TableSectionConfig;
  onSelectedDetailIdChange?: (id: string | null) => void;
}) {
  const sourceState = useResolvedSourceState(config.source.sourceId);
  const { locale, timeZone } = useTemplateFormatting();
  const resolved = useResolvedData(config.source, { disableItemContext: true });
  const rows = Array.isArray(resolved)
    ? resolved.filter((row): row is TableRow => !!row && typeof row === "object")
    : [];

  const columns = useMemo<ColumnDef<TableRow>[]>(
    () =>
      config.columns.map((column) => ({
        accessorKey: column.key,
        header: column.header,
        enableSorting: column.sortable ?? false,
        size: column.width,
        meta: {
          align:
            column.format === "currency" ||
            column.format === "number" ||
            column.format === "percent" ||
            column.format === "duration-seconds"
              ? "right"
              : "left",
        },
        cell: (info) => {
          const row = info.row.original;
          const value = info.getValue();
          const siblingCurrency = row[getSiblingCurrencyField(column.key)];
          const getCurrency = () => {
            if (typeof siblingCurrency === "string") return siblingCurrency;
            if (typeof row.currency === "string") return row.currency;
            return undefined;
          };
          const currency = getCurrency();
          const isDateLike =
            column.format === "date" || column.format === "relative-time" || isDateString(value);
          const title =
            value instanceof Date || typeof value === "number" || typeof value === "string"
              ? formatDateTime(value, {
                  includeTime: "auto",
                  locale,
                  timeZone,
                })
              : null;

          return (
            <span
              className={cn(
                "text-muted-foreground",
                isDateLike && "block truncate whitespace-nowrap text-w-sm"
              )}
              title={isDateLike ? (title ?? undefined) : undefined}
            >
              {formatValue(value, column.format, { currency, locale, timeZone })}
            </span>
          );
        },
      })),
    [config.columns, locale, timeZone]
  );

  const defaultSorting = useMemo<SortingState | undefined>(() => {
    if (!config.defaultSort) return undefined;

    return [
      {
        id: config.defaultSort.key,
        desc: config.defaultSort.direction === "desc",
      },
    ];
  }, [config.defaultSort]);

  if (sourceState.loading && rows.length === 0) {
    return (
      <div className="border-border border-t">
        <div className="grid grid-cols-3 gap-3 border-[#111] border-b px-3 py-2">
          {config.columns.slice(0, 3).map((column) => (
            <div key={column.key} className="h-2.5 animate-pulse bg-[#1d1d1d]" />
          ))}
        </div>
        {TABLE_SKELETON_ROW_KEYS.map((rowKey) => (
          <div key={rowKey} className="grid grid-cols-3 gap-3 border-[#111] border-b px-3 py-2.5">
            {config.columns.slice(0, 3).map((column) => (
              <div
                key={`${rowKey}:${column.key}`}
                className="h-3 animate-pulse bg-surface-raised"
              />
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <WidgetTable
      stateKey={getTableStateKey(config)}
      columns={columns}
      data={rows}
      defaultSorting={defaultSorting}
      filterPlaceholder={config.searchable ? "Filter results…" : undefined}
      emptyMessage={config.emptyMessage ?? "No results"}
      onRowClick={
        config.selection && onSelectedDetailIdChange
          ? (row) => {
              const selectionValue = getTableSelectionValue(row, config);
              if (selectionValue) {
                onSelectedDetailIdChange(selectionValue);
              }
            }
          : undefined
      }
    />
  );
}
