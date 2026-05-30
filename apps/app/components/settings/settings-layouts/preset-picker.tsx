"use client";

import type { LayoutCell, LayoutDefinition, UserProfile } from "@radarboard/types/database";
import {
  Dialog,
  DialogBody,
  DialogCancelButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@radarboard/ui/app-dialog";
import { Badge } from "@radarboard/ui/badge";
import { Button } from "@radarboard/ui/button";
import { cn } from "@radarboard/utils/cn";
import type { LayoutBlueprintDescriptor } from "@radarboard/widget-engine/blueprints";
import { LAYOUT_RECIPES } from "@radarboard/widget-engine/layout-recipe-gallery";
import { getCellRect, getLayoutDimensions } from "@radarboard/widget-engine/layouts";
import { useMemo, useState } from "react";
import { BlueprintGrid } from "./blueprint-picker";

// ---------------------------------------------------------------------------
// Column count type & auto-detection
// ---------------------------------------------------------------------------

export type ColumnCount = 2 | 3 | 4;

export function detectColumns(screenWidth: number, screenHeight: number): ColumnCount {
  if (screenWidth === 0) return 3;
  // Portrait / vertical screens: prefer 2 columns
  if (screenHeight > screenWidth * 1.2) return 2;
  // Small screens (13" laptops)
  if (screenWidth < 1440) return 2;
  // Large screens (27"+, ultrawide)
  if (screenWidth >= 1920) return 4;
  return 3;
}

export function useDetectedColumns(): ColumnCount {
  const [cols] = useState<ColumnCount>(() =>
    typeof window === "undefined"
      ? 3
      : detectColumns(
          window.screen?.width ?? window.innerWidth,
          window.screen?.height ?? window.innerHeight
        )
  );
  return cols;
}

// ---------------------------------------------------------------------------
// Layout column adaptation
// ---------------------------------------------------------------------------

/** Build equal column sizes that sum to exactly 100. */
function equalColSizes(cols: number): number[] {
  const size = +(100 / cols).toFixed(2);
  return Array.from({ length: cols }, (_, i) =>
    i === cols - 1 ? +(100 - size * (cols - 1)).toFixed(2) : size
  );
}

/** Rebuild a uniform (all 1×1) grid to the target column count. */
function rebuildUniformGrid(
  layout: LayoutDefinition,
  targetCols: ColumnCount,
  sourceRows: number
): LayoutDefinition {
  const cells: LayoutCell[] = [];
  for (let row = 0; row < sourceRows; row++) {
    for (let col = 0; col < targetCols; col++) {
      const index = row * targetCols + col;
      cells.push({ id: `cell-${index + 1}`, rowStart: row, colStart: col, rowSpan: 1, colSpan: 1 });
    }
  }
  return {
    ...layout,
    id: `${layout.id}-${targetCols}col`,
    name: layout.name.replace(/\d+×\d+/, `${targetCols}×${sourceRows}`),
    cells,
    colSizes: equalColSizes(targetCols),
  };
}

/** Extend a structured layout by adding columns on the right edge. */
function extendColumns(
  layout: LayoutDefinition,
  sourceCols: number,
  targetCols: ColumnCount
): LayoutDefinition {
  const extraCols = targetCols - sourceCols;
  const newCells: LayoutCell[] = [];
  let addedCount = 0;

  for (const cell of layout.cells) {
    const isRightEdge = cell.colStart + cell.colSpan === sourceCols;
    if (isRightEdge && cell.colSpan > 1) {
      newCells.push({ ...cell, colSpan: cell.colSpan + extraCols });
    } else if (isRightEdge) {
      newCells.push(cell);
      for (let e = 0; e < extraCols; e++) {
        addedCount++;
        newCells.push({
          id: `added-${addedCount}`,
          rowStart: cell.rowStart,
          colStart: sourceCols + e,
          rowSpan: cell.rowSpan,
          colSpan: 1,
        });
      }
    } else {
      newCells.push(cell);
    }
  }

  return {
    ...layout,
    id: `${layout.id}-${targetCols}col`,
    cells: newCells,
    colSizes: equalColSizes(targetCols),
  };
}

/** Shrink a structured layout by dropping/clamping cells beyond targetCols. */
function shrinkColumns(layout: LayoutDefinition, targetCols: ColumnCount): LayoutDefinition {
  const newCells = layout.cells
    .filter((cell) => cell.colStart < targetCols)
    .map((cell) => ({ ...cell, colSpan: Math.min(cell.colSpan, targetCols - cell.colStart) }));
  return {
    ...layout,
    id: `${layout.id}-${targetCols}col`,
    cells: newCells,
    colSizes: equalColSizes(targetCols),
  };
}

export function adaptLayoutToColumns(
  layout: LayoutDefinition,
  targetCols: ColumnCount
): LayoutDefinition {
  const { colCount: sourceCols, rowCount: sourceRows } = getLayoutDimensions(layout);
  if (sourceCols === targetCols) return layout;

  const allUniform = layout.cells.every((c) => c.colSpan === 1 && c.rowSpan === 1);
  if (allUniform) return rebuildUniformGrid(layout, targetCols, sourceRows);
  if (targetCols > sourceCols) return extendColumns(layout, sourceCols, targetCols);
  return shrinkColumns(layout, targetCols);
}

// ---------------------------------------------------------------------------
// Blank layout
// ---------------------------------------------------------------------------

const BLANK_LAYOUT: LayoutDefinition = {
  id: "blank",
  name: "Blank",
  cells: [{ id: "cell-1", rowStart: 0, colStart: 0, rowSpan: 1, colSpan: 1 }],
  colSizes: [100],
  rowSizes: [100],
};

// ---------------------------------------------------------------------------
// PresetCardPreview
// ---------------------------------------------------------------------------

function PresetCardPreview({ layout }: { layout: LayoutDefinition }) {
  const { rowCount, colCount } = getLayoutDimensions(layout);

  return (
    <div className="relative aspect-[1.35/1] w-full rounded-item border border-border bg-secondary">
      {layout.cells.map((cell) => {
        const rect = getCellRect(layout, cell);
        const needsRightGap = cell.colStart + cell.colSpan < colCount;
        const needsBottomGap = cell.rowStart + cell.rowSpan < rowCount;

        return (
          <div
            key={cell.id}
            className="absolute border border-foreground/40 bg-foreground/[0.15]"
            style={{
              left: `${rect.leftPct}%`,
              top: `${rect.topPct}%`,
              width: needsRightGap ? `calc(${rect.widthPct}% - 1px)` : `${rect.widthPct}%`,
              height: needsBottomGap ? `calc(${rect.heightPct}% - 1px)` : `${rect.heightPct}%`,
            }}
          />
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PresetCard
// ---------------------------------------------------------------------------

function BlankPreview() {
  return (
    <div className="relative flex aspect-[1.35/1] w-full items-center justify-center rounded-item border border-foreground/30 border-dashed bg-secondary">
      <div className="flex flex-col items-center gap-1.5 text-foreground/40">
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
        <span className="font-mono text-w-xs">Start from scratch</span>
      </div>
    </div>
  );
}

function PresetCard({
  name,
  description,
  cellCount,
  layout,
  isBlank,
  onSelect,
}: {
  name: string;
  description: string;
  cellCount: number;
  layout: LayoutDefinition;
  isBlank?: boolean;
  onSelect: () => void;
}) {
  return (
    <Button
      type="button"
      onClick={onSelect}
      variant="outline"
      spacing="none"
      uppercase={false}
      fullWidth
      className={cn(
        "group flex h-auto flex-col items-stretch justify-start overflow-hidden whitespace-normal bg-surface text-left",
        "hover:border-accent hover:bg-surface-raised"
      )}
    >
      <div className="w-full p-3">
        {isBlank ? <BlankPreview /> : <PresetCardPreview layout={layout} />}
      </div>
      <div className="flex w-full flex-1 flex-col gap-1 border-border border-t px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-mono text-foreground text-w-sm">{name}</span>
          <Badge variant="default">{cellCount} cells</Badge>
        </div>
        <p className="line-clamp-2 font-mono text-dim text-w-xs leading-relaxed">{description}</p>
      </div>
    </Button>
  );
}

// ---------------------------------------------------------------------------
// ColumnSelector
// ---------------------------------------------------------------------------

const COLUMN_OPTIONS: ColumnCount[] = [2, 3, 4];

export function ColumnSelector({
  value,
  detected,
  onChange,
}: {
  value: ColumnCount;
  detected: ColumnCount;
  onChange: (cols: ColumnCount) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-dim text-w-sm uppercase tracking-wider">Columns</span>
      <div className="flex gap-1">
        {COLUMN_OPTIONS.map((cols) => (
          <Button
            key={cols}
            type="button"
            onClick={() => onChange(cols)}
            variant={value === cols ? "default" : "secondary"}
            uppercase={false}
          >
            {cols}
          </Button>
        ))}
      </div>
      {value === detected ? (
        <span className="font-mono text-dim text-w-xs">Auto-detected for your screen</span>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// LayoutPresetPicker
// ---------------------------------------------------------------------------

type PickerTab = "templates" | "blueprints";

function TabToggle({ value, onChange }: { value: PickerTab; onChange: (tab: PickerTab) => void }) {
  return (
    <div className="flex gap-1 rounded-item bg-surface-raised p-0.5">
      {(["templates", "blueprints"] as const).map((tab) => (
        <Button
          key={tab}
          type="button"
          onClick={() => onChange(tab)}
          variant={value === tab ? "default" : "ghost"}
          uppercase={false}
          className={cn(
            "capitalize",
            value !== tab && "text-foreground-secondary hover:text-foreground"
          )}
        >
          {tab}
        </Button>
      ))}
    </div>
  );
}

interface LayoutPresetPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (layout: LayoutDefinition) => void;
  onSelectBlueprint?: (blueprint: LayoutBlueprintDescriptor) => void;
  /** User personas for blueprint scoring. */
  personas?: UserProfile[];
  /** Connected integration IDs for blueprint scoring. */
  connectedIntegrations?: string[];
}

const EMPTY_PERSONAS: UserProfile[] = [];
const EMPTY_CONNECTED_INTEGRATIONS: string[] = [];

export function LayoutPresetPicker({
  open,
  onOpenChange,
  onSelect,
  onSelectBlueprint,
  personas = EMPTY_PERSONAS,
  connectedIntegrations = EMPTY_CONNECTED_INTEGRATIONS,
}: LayoutPresetPickerProps) {
  const detectedCols = useDetectedColumns();
  const [columns, setColumns] = useState<ColumnCount>(detectedCols);
  const [tab, setTab] = useState<PickerTab>(onSelectBlueprint ? "blueprints" : "templates");

  const filteredRecipes = useMemo(
    () => LAYOUT_RECIPES.filter((r) => r.id !== "content-only-stream"),
    []
  );

  const adaptedRecipes = useMemo(
    () =>
      filteredRecipes.map((recipe) => ({
        recipe,
        adapted: adaptLayoutToColumns(recipe.layout, columns),
      })),
    [filteredRecipes, columns]
  );

  const title = tab === "templates" ? "Choose a Layout Template" : "Choose a Blueprint";
  const description =
    tab === "templates"
      ? "Pick a grid template to start from, or create a blank layout. You can fully customize any layout after creation."
      : "Blueprints include both grid structure and pre-assigned widgets. Pick one that matches your workflow.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="mb-4 flex items-center gap-4">
            {onSelectBlueprint ? <TabToggle value={tab} onChange={setTab} /> : null}
            <ColumnSelector value={columns} detected={detectedCols} onChange={setColumns} />
          </div>
          {tab === "templates" && (
            <div className="grid grid-cols-4 gap-3">
              <PresetCard
                name="Blank"
                description="Single empty cell. Add rows and columns to build your own layout."
                cellCount={BLANK_LAYOUT.cells.length}
                layout={BLANK_LAYOUT}
                isBlank
                onSelect={() => onSelect({ ...BLANK_LAYOUT, name: "Custom Layout" })}
              />
              {adaptedRecipes.map(({ recipe, adapted }) => (
                <PresetCard
                  key={recipe.id}
                  name={recipe.name}
                  description={recipe.description}
                  cellCount={adapted.cells.length}
                  layout={adapted}
                  onSelect={() => onSelect(adapted)}
                />
              ))}
            </div>
          )}
          {tab === "blueprints" && onSelectBlueprint ? (
            <BlueprintGrid
              personas={personas}
              connectedIntegrations={connectedIntegrations}
              adaptLayout={(layout) => adaptLayoutToColumns(layout, columns)}
              onSelect={onSelectBlueprint}
            />
          ) : null}
        </DialogBody>
        <DialogFooter className="justify-end">
          <DialogCancelButton onClick={() => onOpenChange(false)}>Cancel</DialogCancelButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
