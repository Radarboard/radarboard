"use client";

import type { LayoutDefinition } from "@radarboard/types/database";
import { Button } from "@radarboard/ui/button";
import { cn } from "@radarboard/utils/cn";
import { getLayoutDimensions } from "@radarboard/widget-engine/layouts";
import { Lock } from "lucide-react";
import { CollapsibleListPanel, ListPanelHeader } from "../settings-list-panel";
import { MiniGridPreview } from "./layout-detail-panel";

// ---------------------------------------------------------------------------
// LayoutListItem
// ---------------------------------------------------------------------------

function LayoutListItem({
  layout,
  isSelected,
  isDefault,
  isActive,
  usedByCount,
  onSelect,
}: {
  layout: LayoutDefinition;
  isSelected: boolean;
  isDefault: boolean;
  isActive: boolean;
  usedByCount: number;
  onSelect: () => void;
}) {
  const { rowCount, colCount } = getLayoutDimensions(layout);

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onSelect}
      className={cn(
        "uppercase-none flex h-auto w-full items-center justify-start gap-3 rounded-none border px-3 py-2.5 text-left font-sans transition-colors",
        isSelected
          ? "border-accent bg-accent/10"
          : "border-border bg-surface hover:border-accent/40 hover:bg-surface-raised"
      )}
    >
      <MiniGridPreview layout={layout} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-mono text-foreground text-w-xs">{layout.name}</span>
          {Boolean(isDefault) && <Lock className="icon-xs flex-shrink-0 text-dim" />}
          {Boolean(isActive) && (
            <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent" />
          )}
        </div>
        <div className="flex items-center gap-2 font-mono text-dim text-w-xs">
          <span>
            {colCount}×{rowCount}
          </span>
          <span>
            {layout.cells.length} cell{layout.cells.length !== 1 ? "s" : ""}
          </span>
          {usedByCount > 0 && (
            <span className="font-mono text-accent text-w-sm">
              {usedByCount} page{usedByCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>
    </Button>
  );
}

// ---------------------------------------------------------------------------
// LayoutListPanel
// ---------------------------------------------------------------------------

interface LayoutListPanelProps {
  filteredLayouts: LayoutDefinition[];
  selectedLayoutId: string;
  defaultLayoutId: string;
  activeLayoutId: string;
  usageMap: Record<string, number>;
  search: string;
  onSearchChange: (value: string) => void;
  onCreateLayout: () => void;
  onSelectLayout: (id: string) => void;
  onClearNotice: () => void;
}

export function LayoutListPanel({
  filteredLayouts,
  selectedLayoutId,
  defaultLayoutId,
  activeLayoutId,
  usageMap,
  search,
  onSearchChange,
  onCreateLayout,
  onSelectLayout,
  onClearNotice,
}: LayoutListPanelProps) {
  return (
    <CollapsibleListPanel className="min-h-0">
      <ListPanelHeader
        title="Layouts"
        subtitle="Create and manage grid layouts."
        searchPlaceholder="Search layouts…"
        searchValue={search}
        onSearchChange={onSearchChange}
        onAdd={onCreateLayout}
        addLabel="Create new layout"
      />

      <div className="scrollbar-thin flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        {filteredLayouts.length === 0 && (
          <p className="py-4 text-center font-mono text-dim text-w-xs">No layouts found.</p>
        )}
        {filteredLayouts.map((layout) => (
          <LayoutListItem
            key={layout.id}
            layout={layout}
            isSelected={layout.id === selectedLayoutId}
            isDefault={layout.id === defaultLayoutId}
            isActive={layout.id === activeLayoutId}
            usedByCount={usageMap[layout.id] ?? 0}
            onSelect={() => {
              onSelectLayout(layout.id);
              onClearNotice();
            }}
          />
        ))}
      </div>
    </CollapsibleListPanel>
  );
}
