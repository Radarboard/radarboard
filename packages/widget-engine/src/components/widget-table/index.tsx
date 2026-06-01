"use client";

import { Button } from "@radarboard/ui/button";
import { Input } from "@radarboard/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@radarboard/ui/tooltip";
import { cn } from "@radarboard/utils/cn";
import {
  type ColumnDef,
  type ColumnSizingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type Header,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { ChevronDown, ChevronsUpDown, ChevronUp, Search } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";

import { useTableState } from "../../hooks/use-table-state";

// ---------------------------------------------------------------------------
// Column alignment helper (via meta)
// ---------------------------------------------------------------------------

type ColAlign = "left" | "right" | "center";

function colAlign(meta: unknown): ColAlign {
  if (meta && typeof meta === "object" && "align" in meta) {
    return (meta as { align: ColAlign }).align ?? "left";
  }
  return "left";
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface WidgetTableProps<TData> {
  /**
   * Unique key used for localStorage persistence.
   * Format: "<widget-id>:<table-name>", e.g. "aso-keywords:keywords".
   * Sort, filter, and column widths are all stored under this key.
   */
  stateKey: string;
  // biome-ignore lint/suspicious/noExplicitAny: column defs use different value types
  columns: ColumnDef<TData, any>[];
  data: TData[];
  /** Default sort state applied when no saved preference exists. */
  defaultSorting?: SortingState;
  /** Placeholder for the search/filter input. Omit to hide the filter bar entirely. */
  filterPlaceholder?: string;
  /** Called when a data row is clicked. */
  onRowClick?: (row: TData) => void;
  /** Shown when no rows match the current filter. */
  emptyMessage?: string;
  className?: string;
}

// ---------------------------------------------------------------------------
// Sort icon
// ---------------------------------------------------------------------------

function SortIcon({ state }: { state: "asc" | "desc" | false }) {
  if (state === "asc") return <ChevronUp className="icon-xs shrink-0" />;
  if (state === "desc") return <ChevronDown className="icon-xs shrink-0" />;
  return (
    <ChevronsUpDown className="icon-xs shrink-0 opacity-30 transition-opacity group-hover:opacity-60" />
  );
}

// ---------------------------------------------------------------------------
// Header cell (extracted to reduce WidgetTable cognitive complexity)
// ---------------------------------------------------------------------------

function HeaderCell<TData>({
  header,
  columnSizing,
  setColumnSizing,
}: {
  header: Header<TData, unknown>;
  columnSizing: ColumnSizingState;
  setColumnSizing: Dispatch<SetStateAction<ColumnSizingState>>;
}) {
  const canSort = header.column.getCanSort();
  const sortState = header.column.getIsSorted();
  const canResize = header.column.getCanResize();
  const isResizing = header.column.getIsResizing();
  const align = colAlign(header.column.columnDef.meta);
  const colWidth = columnSizing[header.id];

  return (
    <th
      key={header.id}
      style={colWidth !== undefined ? { width: colWidth } : undefined}
      className={cn(
        "relative select-none px-2 py-2 font-normal text-dim text-w-sm uppercase tracking-wider",
        align === "right" && "text-right",
        align === "center" && "text-center",
        canSort &&
          !isResizing &&
          "group cursor-pointer transition-colors hover:text-foreground-secondary"
      )}
      onClick={canSort && !isResizing ? header.column.getToggleSortingHandler() : undefined}
    >
      <span
        className={cn("inline-flex items-center gap-1", align === "right" && "flex-row-reverse")}
      >
        {header.isPlaceholder
          ? null
          : flexRender(header.column.columnDef.header, header.getContext())}
        {canSort && <SortIcon state={sortState} />}
      </span>

      {canResize && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              aria-hidden="true"
              onMouseDown={(e) => {
                e.stopPropagation();
                header.getResizeHandler()(e);
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                header.getResizeHandler()(e);
              }}
              onDoubleClick={() => {
                setColumnSizing((prev: ColumnSizingState) => {
                  const next = { ...prev };
                  delete next[header.id];
                  return next;
                });
              }}
              className={cn(
                "absolute top-0 right-0 h-full w-1 cursor-col-resize touch-none select-none",
                "opacity-0 transition-opacity group-hover:opacity-100",
                isResizing ? "bg-accent opacity-100" : "bg-border hover:bg-accent/60"
              )}
            />
          </TooltipTrigger>
          <TooltipContent>Drag to resize · Double-click to reset</TooltipContent>
        </Tooltip>
      )}
    </th>
  );
}

// ---------------------------------------------------------------------------
// WidgetTable
// ---------------------------------------------------------------------------

export function WidgetTable<TData>({
  stateKey,
  columns,
  data,
  defaultSorting,
  filterPlaceholder,
  onRowClick,
  emptyMessage = "No results",
  className,
}: WidgetTableProps<TData>) {
  const { sorting, setSorting, globalFilter, setGlobalFilter, columnSizing, setColumnSizing } =
    useTableState(stateKey, { sorting: defaultSorting });

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter, columnSizing },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnSizingChange: setColumnSizing,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: "includesString",
    columnResizeMode: "onChange",
    enableColumnResizing: true,
  });

  const rows = table.getRowModel().rows;

  // Track resize-in-progress so we can suppress the click→sort that fires on mouseup.

  // Always fill the container width. Use `fixed` layout once the user has resized
  // any column so their explicit widths are respected; otherwise `auto` lets the
  // browser distribute space based on content + column `size` hints.
  const hasCustomSizing = Object.keys(columnSizing).length > 0;
  const tableLayout = hasCustomSizing ? ("fixed" as const) : ("auto" as const);

  return (
    <TooltipProvider delayDuration={300}>
      <div className={cn("flex h-full min-h-0 flex-col overflow-hidden", className)}>
        {/* Filter bar */}
        {filterPlaceholder !== undefined && (
          <div className="shrink-0 border-border border-b px-3 py-2">
            <div className="relative">
              <Search className="icon-xs pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-dim" />
              <Input
                type="text"
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                placeholder={filterPlaceholder}
                className="h-8 w-full py-1.5 pr-8 pl-8 text-w-sm"
              />
              {Boolean(globalFilter) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setGlobalFilter("")}
                  className="icon-lg uppercase-none absolute top-1/2 right-1 -translate-y-1/2 text-dim hover:bg-transparent hover:text-foreground-secondary"
                  aria-label="Clear filter"
                >
                  <span className="font-mono text-w-sm">✕</span>
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Table — overflow-auto for both axes when columns overflow */}
        <div
          className="scrollbar-thin min-h-0 flex-1 overflow-x-auto overflow-y-scroll"
          style={{ scrollbarGutter: "stable" }}
        >
          <table className="w-full border-collapse font-mono" style={{ tableLayout }}>
            <thead className="sticky top-0 z-10 bg-background">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-secondary border-b">
                  {headerGroup.headers.map((header) => (
                    <HeaderCell
                      key={header.id}
                      header={header}
                      columnSizing={columnSizing}
                      setColumnSizing={setColumnSizing}
                    />
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="bg-background">
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-3 py-8 text-center font-mono text-dim text-w-sm"
                  >
                    {globalFilter ? `No results for "${globalFilter}"` : (emptyMessage ?? null)}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    className={cn(
                      "border-background border-b transition-colors",
                      onRowClick ? "cursor-pointer hover:bg-muted" : "hover:bg-muted/50"
                    )}
                    onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const align = colAlign(cell.column.columnDef.meta);
                      const colWidth = columnSizing[cell.column.id];
                      return (
                        <td
                          key={cell.id}
                          style={colWidth !== undefined ? { width: colWidth } : undefined}
                          className={cn(
                            "px-2 py-2 text-w-base",
                            align === "right" && "text-right",
                            align === "center" && "text-center"
                          )}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Row count footer — only visible when actively filtering */}
        {globalFilter && rows.length > 0 && (
          <div className="shrink-0 border-border border-t px-3 py-1">
            <span className="font-mono text-dim text-w-sm">
              {rows.length} of {data.length}
            </span>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
