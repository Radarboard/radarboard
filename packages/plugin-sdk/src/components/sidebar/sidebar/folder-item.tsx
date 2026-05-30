"use client";

import { cn } from "@radarboard/utils/cn";
import type React from "react";

export interface FolderItemProps {
  icon: React.ReactNode;
  label: string;
  /** Count badge — number or string. Hidden when 0 or empty. */
  count?: number | string;
  selected: boolean;
  onClick: () => void;
  dimmed?: boolean;
}

/**
 * Shared sidebar navigation item.
 *
 * Used across all plugin sidebars for folder, feed, view, and
 * category navigation. Provides consistent sizing, spacing, and
 * selected/hover states.
 */
export function FolderItem({ icon, label, count, selected, onClick, dimmed }: FolderItemProps) {
  const hasCount = count !== undefined && count !== 0 && count !== "" && count !== "0";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 px-3 py-1.5 font-mono text-w-base transition-colors",
        selected
          ? "bg-secondary text-foreground-secondary"
          : "text-dim hover:bg-secondary/50 hover:text-foreground-secondary",
        dimmed && "opacity-50"
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span className="flex-1 truncate text-left">{label}</span>
      {Boolean(hasCount) && <span className="text-dim text-w-sm tabular-nums">{count}</span>}
    </button>
  );
}
