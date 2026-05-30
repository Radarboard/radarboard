"use client";

import { Button } from "@radarboard/ui/button";
import { cn } from "@radarboard/utils/cn";
import { Plus } from "lucide-react";
import type React from "react";
import { PluginSearchInput } from "./plugin-search";

export interface PluginListHeaderProps {
  /** Section label (e.g. "Notes", "Expenses") */
  label: string;
  /** Item count (e.g. "3 notes") */
  count?: string;
  /** Search state — omit to hide search */
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  };
  /** Add/create button — omit to hide */
  addButton?: {
    label: string;
    onClick: () => void;
    /** Replace default Plus icon */
    icon?: React.ReactNode;
    /** Render a completely custom element instead of the default button */
    custom?: React.ReactNode;
  };
  /** Extra content after count (e.g. sort dropdown) */
  extra?: React.ReactNode;
  className?: string;
}

/**
 * Standardized list pane header for plugin overlays.
 *
 * Consistent layout:
 * ```
 * [Section Label]           [+ Add Button]
 * [Search input with icon]
 * [Count text] [extra]
 * ```
 */
export function PluginListHeader({
  label,
  count,
  search,
  addButton,
  extra,
  className,
}: PluginListHeaderProps) {
  return (
    <div className={cn("space-y-2 border-border border-b px-3 py-2", className)}>
      {/* Row 1: Label + Add button */}
      <div className="flex items-center justify-between gap-2">
        <div className="font-mono text-dim text-w-sm uppercase tracking-widest">{label}</div>
        {addButton != null
          ? (addButton.custom ?? (
              <Button
                type="button"
                onClick={addButton.onClick}
                variant="secondary"
                size="default"
                uppercase={false}
                className="gap-1.5"
              >
                {addButton.icon ?? <Plus className="icon-base" />}
                {addButton.label}
              </Button>
            ))
          : null}
      </div>

      {/* Row 2: Search */}
      {search != null ? (
        <PluginSearchInput
          value={search.value}
          onChange={search.onChange}
          placeholder={search.placeholder}
        />
      ) : null}

      {/* Row 3: Count + extra */}
      {Boolean(count || extra) && (
        <div className="flex items-center justify-between gap-2">
          {Boolean(count) && <div className="text-dim text-w-sm">{count}</div>}
          {extra}
        </div>
      )}
    </div>
  );
}
