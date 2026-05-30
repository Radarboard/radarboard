"use client";

import type { OnboardingState } from "@radarboard/feature-onboarding/types";
import type { LayoutDefinition } from "@radarboard/types/database";
import { Button } from "@radarboard/ui/button";
import { cn } from "@radarboard/utils/cn";
import {
  LAYOUT_BLUEPRINTS,
  type LayoutBlueprintDescriptor,
  scoreBlueprintFit,
} from "@radarboard/widget-engine/blueprints";
import { LAYOUT_RECIPES } from "@radarboard/widget-engine/layout-recipe-gallery";
import { getCellRect, getLayoutDimensions } from "@radarboard/widget-engine/layouts";
import { useEffect, useState } from "react";
import { BlueprintGrid } from "@/components/settings/settings-layouts/blueprint-picker";
import {
  adaptLayoutToColumns,
  type ColumnCount,
  ColumnSelector,
  useDetectedColumns,
} from "@/components/settings/settings-layouts/preset-picker";

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
  const [tab, setTab] = useState<LayoutTab>("blueprints");
  const suggestedBlueprintId = !state.blueprintId
    ? LAYOUT_BLUEPRINTS.map((bp) => ({
        id: bp.id,
        score: scoreBlueprintFit(bp, {
          personas: state.profile ? [state.profile] : [],
          connectedIntegrations: state.connectedIntegrations,
        }),
      })).sort((a, b) => b.score - a.score)[0]
    : null;

  // Auto-select the best-matching blueprint when the step loads.
  useEffect(() => {
    if (state.blueprintId) return;
    if (suggestedBlueprintId && suggestedBlueprintId.score > 0) {
      onChange({ blueprintId: suggestedBlueprintId.id });
    }
  }, [onChange, state.blueprintId, suggestedBlueprintId]);

  const handleSelectBlueprint = (blueprint: LayoutBlueprintDescriptor) => {
    onChange({ blueprintId: blueprint.id });
  };

  const handleSelectTemplate = (layout: LayoutDefinition) => {
    onChange({ blueprintId: `template:${layout.id}` });
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden px-4 pt-4 sm:px-6 sm:pt-6">
      <div className="mb-1 font-mono text-dim text-w-sm uppercase tracking-widest">
        Dashboard Layout
      </div>
      <p className="mb-3 font-mono text-dim text-w-sm">
        Choose a layout for your dashboard. Blueprints include suggested widgets. Templates are
        empty grids you fill yourself.
      </p>

      <div className="mb-4 flex items-center gap-4">
        <div className="flex gap-1 rounded-item bg-surface-raised p-0.5">
          {(["blueprints", "templates"] as const).map((t) => (
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
          />
        ) : (
          <TemplateGrid columns={columns} onSelect={handleSelectTemplate} />
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
}: {
  columns: ColumnCount;
  onSelect: (layout: LayoutDefinition) => void;
}) {
  const recipes = LAYOUT_RECIPES.filter((r) => r.id !== "content-only-stream");

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {recipes.map((recipe) => {
        const adapted = adaptLayoutToColumns(recipe.layout, columns);
        const { rowCount, colCount } = getLayoutDimensions(adapted);
        return (
          <Button
            key={recipe.id}
            type="button"
            variant="ghost"
            spacing="none"
            uppercase={false}
            fullWidth
            onClick={() => onSelect(adapted)}
            className={cn(
              "group flex h-auto flex-col items-stretch justify-start overflow-hidden whitespace-normal rounded-item border border-border bg-surface text-left transition-colors",
              "hover:border-accent hover:bg-surface-raised"
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
                      className="absolute border border-foreground/40 bg-foreground/[0.15]"
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
              <span className="truncate font-mono text-foreground text-w-sm">{recipe.name}</span>
              <span className="font-mono text-dim text-w-xs">{adapted.cells.length} cells</span>
            </div>
          </Button>
        );
      })}
    </div>
  );
}
