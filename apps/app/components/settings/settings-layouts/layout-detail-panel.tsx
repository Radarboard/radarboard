"use client";

import {
  type DashboardLayoutChangePreview,
  previewDashboardLayoutChange,
} from "@radarboard/hooks/dashboard-layout";
import type { LayoutCell, LayoutDefinition } from "@radarboard/types/database";
import { ConfirmationDialog, DialogDescription } from "@radarboard/ui/app-dialog";
import { Badge } from "@radarboard/ui/badge";
import { Button } from "@radarboard/ui/button";
import { Input } from "@radarboard/ui/input";
import { Label } from "@radarboard/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@radarboard/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@radarboard/ui/tooltip";
import { cn } from "@radarboard/utils/cn";
import {
  applyColumnBoundaryDelta,
  buildTrackOffsets,
  canMerge,
  getCellAt,
  getCellRect,
  getHorizontalResizeHandles,
  getLayoutDimensions,
  getSplitLines,
  insertColumn,
  insertRow,
  mergeCells,
  normalizeSpanningCellBoundaries,
  removeColumn,
  removeRow,
  resolveColSizes,
  resolveColumnRowSizes,
  splitCell,
  summarizeColumnRowSizes,
  validateGrid,
} from "@radarboard/widget-engine/layouts";
import { ResizeHandle, SegmentResizeHandle } from "@radarboard/widget-engine/resize-handle";
import { getWidget } from "@radarboard/widget-engine/widgets/registry";
import { Copy, Minus, Plus, RotateCcw, Trash2 } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LayoutUpdateMeta {
  removedCellIds?: string[];
}

interface TrackRemovalRequest {
  axis: "row" | "column";
  index: number;
  layout: LayoutDefinition;
  removedCellIds: string[];
}

interface PendingTrackRemoval extends TrackRemovalRequest {
  preview: DashboardLayoutChangePreview | null;
  preservedWidgetLabels: string[];
  droppedWidgetLabels: string[];
  previewTargetLabel: string | null;
}

export interface LayoutAssignmentTarget {
  key: string;
  ownerSlug: string;
  ownerName: string;
  pageSlug: string;
  pageName: string;
  currentLayoutId: string;
  currentLayoutName: string;
  currentAssignments: Record<string, string | null>;
}

interface MergeHandleEntry {
  axis: "horizontal" | "vertical";
  row: number;
  col: number;
  aId: string;
  bId: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function isMergedCell(cell: LayoutCell): boolean {
  return cell.rowSpan > 1 || cell.colSpan > 1;
}

function findHorizontalMergeHandles(
  cells: LayoutCell[],
  rowCount: number,
  colCount: number
): MergeHandleEntry[] {
  const handles: MergeHandleEntry[] = [];
  const seen = new Set<string>();

  for (let row = 1; row < rowCount; row += 1) {
    for (let col = 0; col < colCount; col += 1) {
      const above = getCellAt(cells, row - 1, col);
      const below = getCellAt(cells, row, col);
      if (!above || !below || above.id === below.id) continue;

      const key = `h-${above.id}-${below.id}`;
      if (seen.has(key)) continue;
      if (!canMerge(above, below)) continue;

      seen.add(key);
      handles.push({
        axis: "horizontal",
        row,
        col: above.colStart,
        aId: above.id,
        bId: below.id,
      });
    }
  }

  return handles;
}

function findVerticalMergeHandles(
  cells: LayoutCell[],
  rowCount: number,
  colCount: number
): MergeHandleEntry[] {
  const handles: MergeHandleEntry[] = [];
  const seen = new Set<string>();

  for (let row = 0; row < rowCount; row += 1) {
    for (let col = 1; col < colCount; col += 1) {
      const left = getCellAt(cells, row, col - 1);
      const right = getCellAt(cells, row, col);
      if (!left || !right || left.id === right.id) continue;

      const key = `v-${left.id}-${right.id}`;
      if (seen.has(key)) continue;
      if (!canMerge(left, right)) continue;

      seen.add(key);
      handles.push({
        axis: "vertical",
        row: left.rowStart,
        col,
        aId: left.id,
        bId: right.id,
      });
    }
  }

  return handles;
}

function formatWidgetLabel(widgetId: string): string {
  return getWidget(widgetId)?.name ?? widgetId;
}

// ---------------------------------------------------------------------------
// MiniTrackButton
// ---------------------------------------------------------------------------

function MiniTrackButton({
  tooltip,
  onClick,
  children,
  className,
  style,
}: {
  tooltip: string;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          onClick={onClick}
          className={cn(
            "uppercase-none icon-sm absolute z-20 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-surface p-0 text-dim shadow-sm transition-colors hover:border-accent hover:text-foreground",
            className
          )}
          style={style}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

// ---------------------------------------------------------------------------
// TrackRail
// ---------------------------------------------------------------------------

function TrackRail({
  axis,
  sizes,
  offsets,
  length,
  onInsert,
  onRemove,
}: {
  axis: "horizontal" | "vertical";
  sizes: number[];
  offsets: number[];
  length: number;
  onInsert: (position: number) => void;
  onRemove: (index: number) => void;
}) {
  const isHorizontal = axis === "horizontal";
  const crossSize = isHorizontal ? 44 : 72;
  const controlSize = 20;
  const controlOffset = (crossSize - controlSize) / 2;

  return (
    <div
      className={cn(
        "relative overflow-visible rounded-item border border-border bg-surface",
        isHorizontal ? "w-full" : "h-full"
      )}
      style={
        isHorizontal ? { height: crossSize, width: length } : { width: crossSize, height: length }
      }
    >
      {sizes.map((size, index) => {
        const start = offsets[index] ?? 0;
        const end = offsets[index + 1] ?? length;
        const segmentSize = Math.max(end - start, 22);

        return (
          <div
            key={`${axis}-segment-${Math.round(start * 100)}-${Math.round(end * 100)}`}
            className="absolute rounded-item border border-secondary bg-surface-raised"
            style={
              isHorizontal
                ? {
                    left: start + 1,
                    top: 1,
                    width: segmentSize - 2,
                    height: crossSize - 2,
                  }
                : {
                    left: 1,
                    top: start + 1,
                    width: crossSize - 2,
                    height: segmentSize - 2,
                  }
            }
          >
            <span
              className={cn(
                "absolute font-mono text-dim text-w-sm",
                isHorizontal
                  ? "bottom-1 left-1/2 -translate-x-1/2"
                  : "top-1/2 left-3 -translate-y-1/2"
              )}
            >
              {Math.round(size)}%
            </span>

            {sizes.length > 1 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => onRemove(index)}
                    aria-label={`Remove ${isHorizontal ? "column" : "row"} ${index + 1}`}
                    className="uppercase-none absolute flex h-5 w-5 items-center justify-center rounded-full border border-border bg-surface p-0 text-dim transition-colors hover:border-destructive hover:text-destructive"
                    style={
                      isHorizontal
                        ? { right: 4, top: controlOffset }
                        : { right: 4, top: segmentSize / 2 - controlSize / 2 }
                    }
                  >
                    <Minus className="icon-xs" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{`Remove ${isHorizontal ? "column" : "row"}`}</TooltipContent>
              </Tooltip>
            )}
          </div>
        );
      })}

      {Array.from({ length: sizes.length + 1 }).map((_, position) => {
        const offset = offsets[position] ?? 0;
        return (
          <Tooltip key={`${axis}-insert-${Math.round(offset * 100)}`}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onInsert(position)}
                aria-label={`Insert ${isHorizontal ? "column" : "row"} at position ${position + 1}`}
                className="uppercase-none absolute z-20 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-surface p-0 text-dim transition-colors hover:border-accent hover:text-foreground"
                style={
                  isHorizontal
                    ? {
                        left: offset - controlSize / 2,
                        top: controlOffset,
                      }
                    : {
                        left: controlOffset,
                        top: offset - controlSize / 2,
                      }
                }
              >
                <Plus className="icon-xs" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{`Insert ${isHorizontal ? "column" : "row"}`}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

function GridEditorCanvas({
  colCount,
  colOffsets,
  columnRowOffsets,
  currentLayout,
  editorRef,
  editorSize,
  handleColumnRowResize,
  handleColumnRowResizeEnd,
  handleColumnRowResizeStart,
  handleCommitColSizes,
  handleMerge,
  handleSplit,
  horizontalResizeHandles,
  layout,
  liveColSizes,
  onSetLiveColSizes,
}: {
  colCount: number;
  colOffsets: number[];
  columnRowOffsets: number[][];
  currentLayout: LayoutDefinition;
  editorRef: React.RefObject<HTMLDivElement | null>;
  editorSize: number;
  handleColumnRowResize: (row: number, columns: number[], deltaPct: number) => void;
  handleColumnRowResizeEnd: () => void;
  handleColumnRowResizeStart: () => void;
  handleCommitColSizes: (sizes: number[]) => void;
  handleMerge: (aId: string, bId: string) => void;
  handleSplit: (cellId: string, axis: "horizontal" | "vertical", position: number) => void;
  horizontalResizeHandles: ReturnType<typeof getHorizontalResizeHandles>;
  layout: LayoutDefinition;
  liveColSizes: number[];
  onSetLiveColSizes: React.Dispatch<React.SetStateAction<number[]>>;
}) {
  const { rowCount } = getLayoutDimensions(layout);
  const mergeHandles = [
    ...findHorizontalMergeHandles(layout.cells, rowCount, colCount),
    ...findVerticalMergeHandles(layout.cells, rowCount, colCount),
  ];
  const splitHandles = layout.cells.flatMap((cell) =>
    getSplitLines(cell).map((line) => ({
      cell,
      cellId: cell.id,
      axis: line.axis,
      position: line.position,
    }))
  );

  return (
    <div
      ref={editorRef}
      className="group/editor relative overflow-visible rounded-item border border-border bg-background"
      style={{ width: editorSize, height: editorSize }}
    >
      {colOffsets.slice(1, -1).map((offset) => (
        <div
          key={`col-line-${offset}`}
          className="pointer-events-none absolute top-0 bottom-0 w-px bg-border"
          style={{ left: offset }}
        />
      ))}

      {layout.cells.map((cell) => {
        const rect = getCellRect(currentLayout, cell);
        const merged = isMergedCell(cell);
        const needsRightGap = cell.colStart + cell.colSpan < colCount;
        const needsBottomGap = cell.rowStart + cell.rowSpan < rowCount;

        return (
          <div
            key={cell.id}
            className={cn(
              "absolute flex items-center justify-center overflow-hidden border transition-colors",
              merged ? "border-accent/60 bg-secondary shadow-glow" : "border-border bg-surface"
            )}
            style={{
              left: `${rect.leftPct}%`,
              top: `${rect.topPct}%`,
              width: needsRightGap ? `calc(${rect.widthPct}% - 1px)` : `${rect.widthPct}%`,
              height: needsBottomGap ? `calc(${rect.heightPct}% - 1px)` : `${rect.heightPct}%`,
            }}
          >
            {merged ? (
              <div className="absolute top-2 left-2 rounded-full border border-accent/20 bg-accent/10 px-2 py-0.5 font-mono text-accent text-w-sm uppercase tracking-[0.14em]">
                Merged
              </div>
            ) : null}

            <span
              className={cn(
                "relative z-10 font-mono",
                merged ? "text-accent text-w-base" : "text-dim text-w-sm"
              )}
            >
              {merged ? `${cell.colSpan}×${cell.rowSpan}` : ""}
            </span>
          </div>
        );
      })}

      {mergeHandles.map((handle) => {
        const a = layout.cells.find((cell) => cell.id === handle.aId);
        if (!a) return null;
        const aRect = getCellRect(currentLayout, a);

        const x =
          handle.axis === "horizontal"
            ? (aRect.leftPct / 100) * editorSize + ((aRect.widthPct / 100) * editorSize) / 2 - 8
            : (colOffsets[handle.col] ?? 0) - 8;
        const y =
          handle.axis === "horizontal"
            ? (columnRowOffsets[Math.min(handle.col, columnRowOffsets.length - 1)]?.[handle.row] ??
                0) - 8
            : (aRect.topPct / 100) * editorSize + ((aRect.heightPct / 100) * editorSize) / 2 - 8;

        return (
          <MiniTrackButton
            key={`merge-${handle.aId}-${handle.bId}`}
            tooltip="Merge cells"
            onClick={() => handleMerge(handle.aId, handle.bId)}
            style={{ left: x, top: y, width: 16, height: 16 }}
            className="opacity-0 group-hover/editor:opacity-100"
          >
            <Plus className="icon-xs" />
          </MiniTrackButton>
        );
      })}

      {splitHandles.map((handle) => {
        if (handle.axis === "horizontal") {
          const rect = getCellRect(currentLayout, handle.cell);
          const columns = Array.from(
            { length: handle.cell.colSpan },
            (_, index) => handle.cell.colStart + index
          );
          const top =
            average(
              columns.map((columnIndex) => columnRowOffsets[columnIndex]?.[handle.position] ?? 0)
            ) - 4;

          return (
            <Tooltip key={`split-${handle.cellId}-${handle.axis}-${handle.position}`}>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => handleSplit(handle.cellId, handle.axis, handle.position)}
                  className="group/split absolute z-10 h-2 min-w-0 cursor-pointer p-0"
                  style={{
                    left: `${rect.leftPct}%`,
                    top,
                    width: `${rect.widthPct}%`,
                  }}
                >
                  <div className="mt-[3.5px] h-[1px] w-full border-border border-t border-dashed transition-colors group-hover/split:border-destructive" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Split cell</TooltipContent>
            </Tooltip>
          );
        }

        const rect = getCellRect(currentLayout, handle.cell);
        const left = (colOffsets[handle.position] ?? 0) - 4;

        return (
          <Tooltip key={`split-${handle.cellId}-${handle.axis}-${handle.position}`}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleSplit(handle.cellId, handle.axis, handle.position)}
                className="group/split absolute z-10 min-h-0 w-2 cursor-pointer p-0"
                style={{
                  left,
                  top: `${rect.topPct}%`,
                  height: `${rect.heightPct}%`,
                }}
              >
                <div className="ml-[3.5px] h-full w-[1px] border-border border-l border-dashed transition-colors group-hover/split:border-destructive" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Split cell</TooltipContent>
          </Tooltip>
        );
      })}

      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 15,
        }}
      >
        {liveColSizes.slice(0, -1).map((_, index) => {
          const boundaryOffset = liveColSizes
            .slice(0, index + 1)
            .reduce((sum, size) => sum + size, 0);

          return (
            <ResizeHandle
              key={`col-${boundaryOffset}`}
              axis="vertical"
              index={index}
              sizes={liveColSizes}
              containerRef={editorRef}
              onResize={onSetLiveColSizes}
              onResizeEnd={handleCommitColSizes}
            />
          );
        })}
        {horizontalResizeHandles.map((handle) => (
          <SegmentResizeHandle
            key={handle.id}
            axis="horizontal"
            containerRef={editorRef}
            leftPct={handle.leftPct}
            topPct={handle.topPct}
            widthPct={handle.widthPct}
            heightPct={0}
            onResizeStart={handleColumnRowResizeStart}
            onResize={(deltaPct) => handleColumnRowResize(handle.row, handle.columns, deltaPct)}
            onResizeEnd={handleColumnRowResizeEnd}
          />
        ))}
      </div>
    </div>
  );
}

function LayoutInfoSidebar({
  assignmentTargets,
  defaultAssignmentTargetKey,
  editorNotice,
  isDefault,
  onAssignLayoutToTarget,
  onDeleteDialogOpenChange,
  onDuplicateLayout,
  onResetLayout,
  onUpdateName,
  selectedLayout,
  selectedUsageCount,
}: {
  assignmentTargets: LayoutAssignmentTarget[];
  defaultAssignmentTargetKey: string | null;
  editorNotice: string | null;
  isDefault: boolean;
  onAssignLayoutToTarget: (ownerSlug: string, pageSlug: string) => void;
  onDeleteDialogOpenChange: (open: boolean) => void;
  onDuplicateLayout: () => void;
  onResetLayout: () => void;
  onUpdateName: (name: string) => void;
  selectedLayout: LayoutDefinition;
  selectedUsageCount: number;
}) {
  const { rowCount, colCount } = getLayoutDimensions(selectedLayout);
  const [selectedAssignmentTargetKeyOverride, setSelectedAssignmentTargetKeyOverride] = useState<
    string | null
  >(null);
  const selectedAssignmentTargetKey = useMemo(() => {
    if (assignmentTargets.length === 0) return null;
    if (
      selectedAssignmentTargetKeyOverride &&
      assignmentTargets.some((target) => target.key === selectedAssignmentTargetKeyOverride)
    ) {
      return selectedAssignmentTargetKeyOverride;
    }
    if (
      defaultAssignmentTargetKey &&
      assignmentTargets.some((target) => target.key === defaultAssignmentTargetKey)
    ) {
      return defaultAssignmentTargetKey;
    }
    return assignmentTargets[0]?.key ?? null;
  }, [assignmentTargets, defaultAssignmentTargetKey, selectedAssignmentTargetKeyOverride]);
  const selectedAssignmentTarget = useMemo(
    () =>
      assignmentTargets.find((target) => target.key === selectedAssignmentTargetKey) ??
      assignmentTargets[0] ??
      null,
    [assignmentTargets, selectedAssignmentTargetKey]
  );
  const selectedLayoutIsAssignedToTarget =
    selectedAssignmentTarget?.currentLayoutId === selectedLayout.id;
  const otherPagesUsingLayout = Math.max(
    selectedUsageCount - (selectedLayoutIsAssignedToTarget ? 1 : 0),
    0
  );

  return (
    <div className="flex w-full flex-col gap-4 lg:w-80 lg:flex-none">
      <div className="rounded-item border border-border bg-surface-raised/50 p-4">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <Label
            htmlFor="layout-name-input"
            className="mb-0 font-mono text-dim text-w-sm uppercase tracking-widest"
          >
            Layout Name
          </Label>
          {selectedUsageCount > 0 ? (
            <Badge variant="secondary" className="font-mono text-w-xs">
              {selectedUsageCount} page{selectedUsageCount !== 1 ? "s" : ""}
            </Badge>
          ) : null}
        </div>
        <Input
          id="layout-name-input"
          type="text"
          value={selectedLayout.name}
          onChange={(event) => onUpdateName(event.target.value)}
          disabled={isDefault}
          className={cn("h-9 w-full", isDefault && "cursor-not-allowed opacity-50")}
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onDuplicateLayout}
            className="uppercase-none flex h-auto items-center gap-1 px-2 py-1 font-mono text-dim text-w-xs transition-colors hover:text-foreground-secondary"
          >
            <Copy className="icon-xs" />
            Duplicate
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onResetLayout}
            className="uppercase-none flex h-auto items-center gap-1 px-2 py-1 font-mono text-dim text-w-xs transition-colors hover:text-foreground-secondary"
          >
            <RotateCcw className="icon-xs" />
            Reset
          </Button>
          {!isDefault ? (
            <Button
              type="button"
              variant="outline-destructive"
              size="sm"
              onClick={() => onDeleteDialogOpenChange(true)}
              className="uppercase-none flex h-auto items-center gap-1 px-2 py-1 font-mono text-w-xs"
            >
              <Trash2 className="icon-xs" />
              Delete
            </Button>
          ) : null}
        </div>
      </div>

      {assignmentTargets.length > 0 && selectedAssignmentTarget ? (
        <div className="rounded-item border border-border bg-surface-raised/50 p-4">
          <div className="flex items-center gap-2">
            <Label className="mb-0 font-mono text-dim text-w-sm uppercase tracking-widest">
              Assign Layout
            </Label>
            <Badge variant="secondary" className="font-mono text-w-xs">
              Page selector
            </Badge>
          </div>
          <p className="mt-2 font-mono text-dim text-w-sm">
            Pick a project/page target here or use the reverse assignment flow in Projects.
          </p>
          <div className="mt-3">
            <Label className="mb-2 font-mono text-dim text-w-xs uppercase tracking-widest">
              Target View
            </Label>
            <Select
              value={selectedAssignmentTarget.key}
              onValueChange={setSelectedAssignmentTargetKeyOverride}
            >
              <SelectTrigger
                size="lg"
                variant="surface"
                className="w-full"
                aria-label="Layout assignment target"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {assignmentTargets.map((target) => (
                  <SelectItem key={target.key} value={target.key}>
                    {target.ownerName} / {target.pageName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!selectedLayoutIsAssignedToTarget ? (
            <div className="mt-3 rounded-item border border-accent/20 bg-accent/5 p-3">
              <p className="font-mono text-foreground text-w-sm">
                <span className="text-accent">{selectedLayout.name}</span> is not assigned to{" "}
                {selectedAssignmentTarget.pageName}.
              </p>
              <Button
                type="button"
                variant="default"
                size="sm"
                uppercase={false}
                onClick={() =>
                  onAssignLayoutToTarget(
                    selectedAssignmentTarget.ownerSlug,
                    selectedAssignmentTarget.pageSlug
                  )
                }
                className="mt-3"
              >
                Assign to Selected View
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-item border border-border bg-surface-raised/50 p-4">
        <div className="font-mono text-dim text-w-sm uppercase tracking-widest">Editing Guide</div>
        <div className="mt-3 space-y-2 font-mono text-dim text-w-sm">
          <p>Resize, merge, and split apply immediately.</p>
          <p>Removing rows or columns opens a review before the change is applied.</p>
          <p>
            Current layout: {colCount} columns × {rowCount} rows · {selectedLayout.cells.length}{" "}
            cells
          </p>
          {otherPagesUsingLayout > 0 ? (
            <p className="text-warning">
              {otherPagesUsingLayout} other page{otherPagesUsingLayout !== 1 ? "s" : ""} also use
              this layout and may be affected by structural changes.
            </p>
          ) : null}
          {editorNotice ? <p className="text-warning">{editorNotice}</p> : null}
        </div>
      </div>
    </div>
  );
}

function GridEditorSummary({
  colCount,
  editorShellWidth,
  liveColSizes,
  liveColumnRowSizes,
}: {
  colCount: number;
  editorShellWidth: number;
  liveColSizes: number[];
  liveColumnRowSizes: number[][];
}) {
  return (
    <div
      className="grid w-full gap-3 font-mono text-dim text-w-sm"
      style={{ width: editorShellWidth }}
    >
      <div className="whitespace-nowrap rounded-item border border-border bg-surface px-3 py-2">
        Columns: {colCount} · {liveColSizes.map((size) => `${Math.round(size)}%`).join(" / ")}
      </div>
      <div className="rounded-item border border-border bg-surface px-3 py-2">
        Vertical splits:{" "}
        {liveColumnRowSizes
          .map((sizes, index) => `C${index + 1} ${sizes.map((size) => Math.round(size)).join("/")}`)
          .join(" · ")}
      </div>
    </div>
  );
}

function LayoutDeleteDialog({
  deleteDialogOpen,
  onDelete,
  onDeleteDialogOpenChange,
  selectedLayout,
  selectedUsageCount,
}: {
  deleteDialogOpen: boolean;
  onDelete: () => void;
  onDeleteDialogOpenChange: (open: boolean) => void;
  selectedLayout: LayoutDefinition;
  selectedUsageCount: number;
}) {
  return (
    <ConfirmationDialog
      open={deleteDialogOpen}
      onOpenChange={onDeleteDialogOpenChange}
      title="Delete Layout"
      confirmLabel="Delete layout"
      onConfirm={onDelete}
      successToast={`Deleted ${selectedLayout.name}`}
      errorToast="Failed to delete layout"
    >
      <div className="space-y-3">
        <DialogDescription>
          Delete <span className="text-foreground">{selectedLayout.name}</span>?
        </DialogDescription>
        {selectedUsageCount > 0 ? (
          <DialogDescription className="text-warning">
            {selectedUsageCount} page{selectedUsageCount !== 1 ? "s" : ""} currently use this
            layout. Their assignments will be cleared.
          </DialogDescription>
        ) : null}
      </div>
    </ConfirmationDialog>
  );
}

function TrackRemovalDialog({
  colCount,
  onConfirm,
  onOpenChange,
  pendingTrackRemoval,
  rowCount,
  selectedLayout,
  selectedUsageCount,
}: {
  colCount: number;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  pendingTrackRemoval: PendingTrackRemoval | null;
  rowCount: number;
  selectedLayout: LayoutDefinition;
  selectedUsageCount: number;
}) {
  return (
    <ConfirmationDialog
      open={pendingTrackRemoval !== null}
      onOpenChange={onOpenChange}
      title={`Review ${pendingTrackRemoval?.axis === "column" ? "Column" : "Row"} Removal`}
      confirmLabel="Apply change"
      onConfirm={onConfirm}
      successToast={
        pendingTrackRemoval
          ? `Removed ${pendingTrackRemoval.axis} ${pendingTrackRemoval.index + 1} from ${selectedLayout.name}`
          : "Layout updated"
      }
      errorToast="Failed to update layout"
    >
      {pendingTrackRemoval ? (
        <div className="space-y-4">
          <DialogDescription>
            Removing {pendingTrackRemoval.axis} {pendingTrackRemoval.index + 1} from{" "}
            <span className="text-foreground">{selectedLayout.name}</span> will update the grid from{" "}
            {colCount}×{rowCount} to {getLayoutDimensions(pendingTrackRemoval.layout).colCount}×
            {getLayoutDimensions(pendingTrackRemoval.layout).rowCount} before the change is applied.
          </DialogDescription>

          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">
              {pendingTrackRemoval.removedCellIds.length} cells removed
            </Badge>
            {pendingTrackRemoval.preview ? (
              <>
                <Badge variant="secondary">
                  {pendingTrackRemoval.preview.preservedCellIds.length} kept or remapped
                </Badge>
                <Badge
                  variant={
                    pendingTrackRemoval.droppedWidgetLabels.length > 0 ? "warning" : "secondary"
                  }
                >
                  {pendingTrackRemoval.droppedWidgetLabels.length} dropped
                </Badge>
              </>
            ) : null}
          </div>

          {pendingTrackRemoval.preview ? (
            <div className="space-y-3 rounded-item border border-border bg-surface p-3">
              <div>
                <p className="font-mono text-dim text-w-xs uppercase tracking-widest">
                  Assignment Preview
                </p>
                <p className="mt-1 font-mono text-dim text-w-sm">
                  This review reflects {pendingTrackRemoval.previewTargetLabel}, because this layout
                  is currently assigned there.
                </p>
              </div>

              <div className="space-y-2 font-mono text-w-sm">
                {pendingTrackRemoval.preservedWidgetLabels.length > 0 ? (
                  <div>
                    <p className="text-dim">Kept or remapped</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {pendingTrackRemoval.preservedWidgetLabels.map((label) => (
                        <Badge key={`kept-${label}`} variant="secondary">
                          {label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}

                {pendingTrackRemoval.droppedWidgetLabels.length > 0 ? (
                  <div>
                    <p className="text-warning">Removed from this assignment target</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {pendingTrackRemoval.droppedWidgetLabels.map((label) => (
                        <Badge key={`dropped-${label}`} variant="warning">
                          {label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-dim">
                    No assigned widgets would be dropped from this assignment target.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-item border border-border bg-surface p-3 font-mono text-dim text-w-sm">
              {selectedUsageCount > 0 ? (
                <p>
                  This layout is not currently assigned to the selected target. The review can
                  confirm the structural change, but {selectedUsageCount} page
                  {selectedUsageCount !== 1 ? "s" : ""} using this layout may still need widget
                  reassignment after apply.
                </p>
              ) : (
                <p>This saved layout is not currently assigned to any page.</p>
              )}
            </div>
          )}
        </div>
      ) : null}
    </ConfirmationDialog>
  );
}

// ---------------------------------------------------------------------------
// MiniGridPreview (exported for use in list panel and other files)
// ---------------------------------------------------------------------------

export function MiniGridPreview({
  layout,
  size = 48,
}: {
  layout: LayoutDefinition;
  size?: number;
}) {
  const gap = 1;
  const { rowCount, colCount } = getLayoutDimensions(layout);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="flex-shrink-0"
      role="img"
      aria-label={`Grid preview: ${layout.name}`}
    >
      <rect width={size} height={size} fill="var(--color-surface)" rx={2} />
      {layout.cells.map((cell) =>
        (() => {
          const rect = getCellRect(layout, cell);
          const needsRightGap = cell.colStart + cell.colSpan < colCount;
          const needsBottomGap = cell.rowStart + cell.rowSpan < rowCount;
          return (
            <rect
              key={cell.id}
              x={(rect.leftPct / 100) * size + gap}
              y={(rect.topPct / 100) * size + gap}
              width={(rect.widthPct / 100) * size - gap - (needsRightGap ? gap : 0)}
              height={(rect.heightPct / 100) * size - gap - (needsBottomGap ? gap : 0)}
              fill="var(--color-border)"
              rx={1}
            />
          );
        })()
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// GridEditor
// ---------------------------------------------------------------------------

function GridEditor({
  layout,
  onChange,
  onRequestTrackRemoval,
}: {
  layout: LayoutDefinition;
  onChange: (layout: LayoutDefinition, meta?: LayoutUpdateMeta) => void;
  onRequestTrackRemoval?: (request: TrackRemovalRequest) => void;
}) {
  const editorSize = 520;
  const railSize = 72;
  const railGap = 16;
  const editorShellWidth = railSize + railGap + editorSize;
  const editorRef = useRef<HTMLDivElement>(null);
  const { rowCount, colCount } = useMemo(() => getLayoutDimensions(layout), [layout]);
  const [liveColSizes, setLiveColSizes] = useState<number[]>(() => resolveColSizes(layout));
  const [liveColumnRowSizes, setLiveColumnRowSizes] = useState<number[][]>(() =>
    resolveColumnRowSizes(layout)
  );
  const rowResizeStartRef = useRef<number[][] | null>(null);

  useEffect(() => {
    setLiveColSizes(resolveColSizes(layout));
    setLiveColumnRowSizes(resolveColumnRowSizes(layout));
  }, [layout]);

  const colOffsets = useMemo(() => buildTrackOffsets(liveColSizes, editorSize), [liveColSizes]);
  const liveRowSizes = useMemo(
    () => summarizeColumnRowSizes(liveColumnRowSizes),
    [liveColumnRowSizes]
  );
  const rowOffsets = useMemo(() => buildTrackOffsets(liveRowSizes, editorSize), [liveRowSizes]);
  const columnRowOffsets = useMemo(
    () => liveColumnRowSizes.map((sizes) => buildTrackOffsets(sizes, editorSize)),
    [liveColumnRowSizes]
  );

  const currentLayout = useMemo<LayoutDefinition>(
    () => ({
      ...layout,
      colSizes: liveColSizes,
      rowSizes: liveRowSizes,
      columnRowSizes: liveColumnRowSizes,
    }),
    [layout, liveColSizes, liveColumnRowSizes, liveRowSizes]
  );
  const horizontalResizeHandles = useMemo(
    () => getHorizontalResizeHandles(currentLayout),
    [currentLayout]
  );

  const handleCommitColSizes = useCallback(
    (sizes: number[]) => {
      setLiveColSizes(sizes);
      onChange({ ...currentLayout, colSizes: sizes });
    },
    [currentLayout, onChange]
  );

  const handleColumnRowResizeStart = useCallback(() => {
    rowResizeStartRef.current = liveColumnRowSizes.map((sizes) => [...sizes]);
  }, [liveColumnRowSizes]);

  const handleColumnRowResize = useCallback(
    (row: number, columns: number[], deltaPct: number) => {
      const base = rowResizeStartRef.current ?? liveColumnRowSizes;
      setLiveColumnRowSizes(
        applyColumnBoundaryDelta(
          {
            ...currentLayout,
            columnRowSizes: base,
          },
          columns,
          row,
          deltaPct
        )
      );
    },
    [currentLayout, liveColumnRowSizes]
  );

  const handleColumnRowResizeEnd = useCallback(() => {
    rowResizeStartRef.current = null;
    onChange({
      ...currentLayout,
      rowSizes: summarizeColumnRowSizes(liveColumnRowSizes),
      columnRowSizes: liveColumnRowSizes,
    });
  }, [currentLayout, liveColumnRowSizes, onChange]);

  const normalizeStructuredLayout = useCallback(
    (nextLayout: LayoutDefinition) => normalizeSpanningCellBoundaries(nextLayout),
    []
  );

  const handleMerge = useCallback(
    (aId: string, bId: string) => {
      const newCells = mergeCells(currentLayout.cells, aId, bId);
      if (!validateGrid(newCells, { rowCount, colCount })) return;
      onChange(normalizeStructuredLayout({ ...currentLayout, cells: newCells }));
    },
    [colCount, currentLayout, normalizeStructuredLayout, onChange, rowCount]
  );

  const handleSplit = useCallback(
    (cellId: string, axis: "horizontal" | "vertical", position: number) => {
      const newCells = splitCell(currentLayout.cells, cellId, { axis, position });
      if (!validateGrid(newCells, { rowCount, colCount })) return;
      onChange(normalizeStructuredLayout({ ...currentLayout, cells: newCells }));
    },
    [colCount, currentLayout, normalizeStructuredLayout, onChange, rowCount]
  );

  const handleInsertColumn = useCallback(
    (position: number) => {
      const result = insertColumn(currentLayout, position);
      onChange(result.layout, { removedCellIds: result.removedCellIds });
    },
    [currentLayout, onChange]
  );

  const handleInsertRow = useCallback(
    (position: number) => {
      const result = insertRow(currentLayout, position);
      onChange(result.layout, { removedCellIds: result.removedCellIds });
    },
    [currentLayout, onChange]
  );

  const handleRemoveColumn = useCallback(
    (index: number) => {
      const result = removeColumn(currentLayout, index);
      if (onRequestTrackRemoval) {
        onRequestTrackRemoval({
          axis: "column",
          index,
          layout: result.layout,
          removedCellIds: result.removedCellIds,
        });
        return;
      }
      onChange(result.layout, { removedCellIds: result.removedCellIds });
    },
    [currentLayout, onChange, onRequestTrackRemoval]
  );

  const handleRemoveRow = useCallback(
    (index: number) => {
      const result = removeRow(currentLayout, index);
      if (onRequestTrackRemoval) {
        onRequestTrackRemoval({
          axis: "row",
          index,
          layout: result.layout,
          removedCellIds: result.removedCellIds,
        });
        return;
      }
      onChange(result.layout, { removedCellIds: result.removedCellIds });
    },
    [currentLayout, onChange, onRequestTrackRemoval]
  );

  return (
    <div className="mx-auto flex w-full max-w-none flex-col items-center gap-4">
      <div
        className="grid items-center gap-3"
        style={{
          gridTemplateColumns: `${railSize}px ${editorSize}px`,
          gridTemplateRows: "44px auto",
          width: editorShellWidth,
        }}
      >
        <div className="flex h-full items-center justify-center rounded-item border border-border bg-surface font-mono text-dim text-w-sm uppercase tracking-[0.18em]">
          Tracks
        </div>
        <TrackRail
          axis="horizontal"
          sizes={liveColSizes}
          offsets={colOffsets}
          length={editorSize}
          onInsert={handleInsertColumn}
          onRemove={handleRemoveColumn}
        />

        <TrackRail
          axis="vertical"
          sizes={liveRowSizes}
          offsets={rowOffsets}
          length={editorSize}
          onInsert={handleInsertRow}
          onRemove={handleRemoveRow}
        />

        <GridEditorCanvas
          colCount={colCount}
          colOffsets={colOffsets}
          columnRowOffsets={columnRowOffsets}
          currentLayout={currentLayout}
          editorRef={editorRef}
          editorSize={editorSize}
          handleColumnRowResize={handleColumnRowResize}
          handleColumnRowResizeEnd={handleColumnRowResizeEnd}
          handleColumnRowResizeStart={handleColumnRowResizeStart}
          handleCommitColSizes={handleCommitColSizes}
          handleMerge={handleMerge}
          handleSplit={handleSplit}
          horizontalResizeHandles={horizontalResizeHandles}
          layout={layout}
          liveColSizes={liveColSizes}
          onSetLiveColSizes={setLiveColSizes}
        />
      </div>

      <GridEditorSummary
        colCount={colCount}
        editorShellWidth={editorShellWidth}
        liveColSizes={liveColSizes}
        liveColumnRowSizes={liveColumnRowSizes}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// LayoutDetailPanel
// ---------------------------------------------------------------------------

interface LayoutDetailPanelProps {
  selectedLayout: LayoutDefinition;
  isDefault: boolean;
  selectedUsageCount: number;
  editorNotice: string | null;
  deleteDialogOpen: boolean;
  onDeleteDialogOpenChange: (open: boolean) => void;
  onUpdateName: (name: string) => void;
  onUpdateLayout: (layout: LayoutDefinition, meta?: LayoutUpdateMeta) => void;
  onDuplicateLayout: () => void;
  onBalanceColumns: () => void;
  onBalanceRows: () => void;
  onBalanceTracks: () => void;
  onResetLayout: () => void;
  onDelete: () => void;
  assignmentTargets: LayoutAssignmentTarget[];
  defaultAssignmentTargetKey: string | null;
  onAssignLayoutToTarget: (ownerSlug: string, pageSlug: string) => void;
}

export function LayoutDetailPanel({
  selectedLayout,
  isDefault,
  selectedUsageCount,
  editorNotice,
  deleteDialogOpen,
  onDeleteDialogOpenChange,
  onUpdateName,
  onUpdateLayout,
  onDuplicateLayout,
  onBalanceColumns,
  onBalanceRows,
  onBalanceTracks,
  onResetLayout,
  onDelete,
  assignmentTargets,
  defaultAssignmentTargetKey,
  onAssignLayoutToTarget,
}: LayoutDetailPanelProps) {
  const { rowCount, colCount } = getLayoutDimensions(selectedLayout);
  const [pendingTrackRemoval, setPendingTrackRemoval] = useState<PendingTrackRemoval | null>(null);
  const assignmentTargetUsingSelectedLayout = useMemo(
    () => assignmentTargets.find((target) => target.currentLayoutId === selectedLayout.id) ?? null,
    [assignmentTargets, selectedLayout.id]
  );

  const handleRequestTrackRemoval = useCallback(
    (request: TrackRemovalRequest) => {
      const preview = assignmentTargetUsingSelectedLayout
        ? previewDashboardLayoutChange(
            selectedLayout,
            request.layout,
            assignmentTargetUsingSelectedLayout.currentAssignments
          )
        : null;

      const preservedWidgetLabels = preview
        ? preview.assignedWidgets
            .filter((entry) => preview.preservedCellIds.includes(entry.cellId))
            .map((entry) => formatWidgetLabel(entry.widgetId))
        : [];
      const droppedWidgetLabels = preview
        ? preview.assignedWidgets
            .filter((entry) => preview.droppedCellIds.includes(entry.cellId))
            .map((entry) => formatWidgetLabel(entry.widgetId))
        : [];

      setPendingTrackRemoval({
        ...request,
        preview,
        preservedWidgetLabels,
        droppedWidgetLabels,
        previewTargetLabel: assignmentTargetUsingSelectedLayout
          ? `${assignmentTargetUsingSelectedLayout.ownerName} / ${assignmentTargetUsingSelectedLayout.pageName}`
          : null,
      });
    },
    [assignmentTargetUsingSelectedLayout, selectedLayout]
  );

  const handleConfirmTrackRemoval = useCallback(() => {
    if (!pendingTrackRemoval) return;
    onUpdateLayout(pendingTrackRemoval.layout, {
      removedCellIds: pendingTrackRemoval.removedCellIds,
    });
    setPendingTrackRemoval(null);
  }, [onUpdateLayout, pendingTrackRemoval]);

  return (
    <div className="scrollbar-thin flex flex-1 overflow-y-auto p-6">
      <div className="flex w-full flex-col gap-6 lg:flex-row lg:items-start">
        <LayoutInfoSidebar
          assignmentTargets={assignmentTargets}
          defaultAssignmentTargetKey={defaultAssignmentTargetKey}
          editorNotice={editorNotice}
          isDefault={isDefault}
          onAssignLayoutToTarget={onAssignLayoutToTarget}
          onDeleteDialogOpenChange={onDeleteDialogOpenChange}
          onDuplicateLayout={onDuplicateLayout}
          onResetLayout={onResetLayout}
          onUpdateName={onUpdateName}
          selectedLayout={selectedLayout}
          selectedUsageCount={selectedUsageCount}
        />

        <div className="min-w-0 flex-1">
          <div className="rounded-item border border-border bg-surface-raised/50 p-4">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-mono text-dim text-w-sm uppercase tracking-widest">
                  Layout Canvas
                </div>
                <p className="mt-2 max-w-sidebar font-mono text-dim text-w-sm">
                  Use the edge controls to add or remove rows and columns. Drag the resize guides to
                  rebalance tracks, then use merge and split controls to shape regions.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-mono text-dim text-w-xs uppercase tracking-widest">
                  Equalize
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={onBalanceColumns}
                      className="uppercase-none flex h-auto items-center gap-1 px-2 py-1 font-mono text-dim text-w-xs transition-colors hover:text-foreground-secondary"
                    >
                      Column Widths
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Make all column widths equal</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={onBalanceRows}
                      className="uppercase-none flex h-auto items-center gap-1 px-2 py-1 font-mono text-dim text-w-xs transition-colors hover:text-foreground-secondary"
                    >
                      Row Heights
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Make all row heights equal</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={onBalanceTracks}
                      className="uppercase-none flex h-auto items-center gap-1 px-2 py-1 font-mono text-dim text-w-xs transition-colors hover:text-foreground-secondary"
                    >
                      All
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Equalize both column widths and row heights</TooltipContent>
                </Tooltip>
              </div>
            </div>

            <GridEditor
              layout={selectedLayout}
              onChange={onUpdateLayout}
              onRequestTrackRemoval={handleRequestTrackRemoval}
            />
          </div>
        </div>
      </div>

      <LayoutDeleteDialog
        deleteDialogOpen={deleteDialogOpen}
        onDelete={onDelete}
        onDeleteDialogOpenChange={onDeleteDialogOpenChange}
        selectedLayout={selectedLayout}
        selectedUsageCount={selectedUsageCount}
      />

      <TrackRemovalDialog
        colCount={colCount}
        onConfirm={handleConfirmTrackRemoval}
        onOpenChange={(open) => {
          if (!open) setPendingTrackRemoval(null);
        }}
        pendingTrackRemoval={pendingTrackRemoval}
        rowCount={rowCount}
        selectedLayout={selectedLayout}
        selectedUsageCount={selectedUsageCount}
      />
    </div>
  );
}
