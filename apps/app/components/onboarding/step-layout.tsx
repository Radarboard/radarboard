"use client";

import { Button } from "@radarboard/ui/button";
import { cn } from "@radarboard/utils/cn";
import type { LayoutBlueprintDescriptor } from "@radarboard/widget-engine/blueprints";
import { LAYOUT_RECIPES } from "@radarboard/widget-engine/layout-recipe-gallery";
import { getCellRect, getLayoutDimensions } from "@radarboard/widget-engine/layouts";
import { Check } from "lucide-react";
import { useState } from "react";
import { BlueprintGrid } from "@/components/settings/settings-layouts/blueprint-picker";
import {
  adaptLayoutToColumns,
  type ColumnCount,
  ColumnSelector,
  useDetectedColumns,
} from "@/components/settings/settings-layouts/preset-picker";
import type { OnboardingState } from "./types";

interface StepLayoutProps {
  state: OnboardingState;
  onChange: (patch: Partial<OnboardingState>) => void;
  onNext: () => void;
  onBack: () => void;
}

type LayoutTab = "blueprints" | "templates";

export function StepLayout({ state, onChange, onNext, onBack }: StepLayoutProps) {
  const detectedCols = useDetectedColumns();
  const [columns, setColumns] = useState<ColumnCount>(detectedCols);
  const [tab, setTab] = useState<LayoutTab>("templates");

  const handleSelectBlueprint = (blueprint: LayoutBlueprintDescriptor) => {
    onChange({ blueprintId: blueprint.id });
  };

  // Store the native recipe id (not the column-adapted layout id, which is
  // mangled to `<id>-<cols>col`) so completion can resolve it from LAYOUT_RECIPES.
  const handleSelectTemplate = (recipeId: string) => {
    onChange({ blueprintId: `template:${recipeId}` });
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden px-4 pt-4 sm:px-6 sm:pt-6">
      <div className="mb-1 font-mono text-dim text-w-sm uppercase tracking-widest">
        Dashboard Layout
      </div>
      <p className="mb-3 font-mono text-dim text-w-sm">
        Start from a Template — an empty All Projects grid you fill yourself — or switch to
        Blueprints for a ready-made dashboard tailored to your setup. Project-only widgets can be
        added after you create a project.
      </p>

      <div className="mb-4 flex items-center gap-4">
        <div className="flex gap-1 rounded-item bg-surface-raised p-0.5">
          {(["templates", "blueprints"] as const).map((t) => (
            <Button
              key={t}
              type="button"
              variant="ghost"
              size="sm"
              uppercase={false}
              onClick={() => setTab(t)}
              className={cn(
                "rounded-item px-3 py-1.5 font-mono text-w-sm capitalize transition-colors",
                tab === t
                  ? "bg-accent text-accent-foreground"
                  : "text-foreground-secondary hover:text-foreground"
              )}
            >
              {t}
            </Button>
          ))}
        </div>
        <ColumnSelector value={columns} detected={detectedCols} onChange={setColumns} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {tab === "blueprints" ? (
          <BlueprintGrid
            personas={state.profile ? [state.profile] : []}
            connectedIntegrations={state.connectedIntegrations}
            adaptLayout={(layout) => adaptLayoutToColumns(layout, columns)}
            onSelect={handleSelectBlueprint}
            selectedId={state.blueprintId}
            dashboardScope="all-projects"
          />
        ) : (
          <TemplateGrid
            columns={columns}
            onSelect={handleSelectTemplate}
            selectedId={state.blueprintId}
          />
        )}
      </div>

      <div className="flex shrink-0 items-center justify-between border-border/40 border-t py-4">
        <Button variant="ghost" onClick={onBack} className="font-mono uppercase tracking-widest">
          Back
        </Button>
        <Button
          variant={state.blueprintId ? "default" : "ghost"}
          onClick={onNext}
          className="font-mono uppercase tracking-widest"
        >
          {state.blueprintId ? "Continue" : "Skip"}
        </Button>
      </div>
    </div>
  );
}

/** Reuses the same layout recipes as Settings > Layouts > Add Layout. */
function TemplateGrid({
  columns,
  onSelect,
  selectedId,
}: {
  columns: ColumnCount;
  onSelect: (recipeId: string) => void;
  /** Currently selected layout id (`template:<recipeId>`), for visual highlight. */
  selectedId?: string | null;
}) {
  const recipes = LAYOUT_RECIPES.filter((r) => r.id !== "content-only-stream");

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {recipes.map((recipe) => {
        const adapted = adaptLayoutToColumns(recipe.layout, columns);
        const { rowCount, colCount } = getLayoutDimensions(adapted);
        const isSelected = selectedId === `template:${recipe.id}`;
        return (
          <Button
            key={recipe.id}
            type="button"
            variant="ghost"
            spacing="none"
            uppercase={false}
            fullWidth
            aria-pressed={isSelected}
            onClick={() => onSelect(recipe.id)}
            className={cn(
              "group flex h-auto flex-col items-stretch justify-start overflow-hidden whitespace-normal rounded-item border border-border bg-surface text-left transition-colors",
              "hover:border-accent hover:bg-surface-raised",
              isSelected && "border-accent bg-surface-raised ring-2 ring-accent ring-inset"
            )}
          >
            <div className="w-full p-3">
              <div className="relative aspect-[1.35/1] w-full rounded-item border border-border bg-secondary">
                {adapted.cells.map((cell) => {
                  const rect = getCellRect(adapted, cell);
                  const needsRightGap = cell.colStart + cell.colSpan < colCount;
                  const needsBottomGap = cell.rowStart + cell.rowSpan < rowCount;
                  return (
                    <div
                      key={cell.id}
                      className={cn(
                        "absolute border",
                        isSelected
                          ? "border-accent/60 bg-accent/20"
                          : "border-foreground/40 bg-foreground/[0.15]"
                      )}
                      style={{
                        left: `${rect.leftPct}%`,
                        top: `${rect.topPct}%`,
                        width: needsRightGap
                          ? `calc(${rect.widthPct}% - 1px)`
                          : `${rect.widthPct}%`,
                        height: needsBottomGap
                          ? `calc(${rect.heightPct}% - 1px)`
                          : `${rect.heightPct}%`,
                      }}
                    />
                  );
                })}
              </div>
            </div>
            <div className="flex w-full flex-col gap-1 border-border border-t px-3 py-2.5">
              <span className="flex items-center gap-1.5 truncate font-mono text-foreground text-w-sm">
                {isSelected && <Check className="h-3 w-3 shrink-0 text-accent" />}
                {recipe.name}
              </span>
              <span className="font-mono text-dim text-w-xs">
                {isSelected ? "Selected" : `${adapted.cells.length} cells`}
              </span>
            </div>
          </Button>
        );
      })}
    </div>
  );
}
