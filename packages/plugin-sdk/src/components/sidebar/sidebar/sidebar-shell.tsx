"use client";

import { cn } from "@radarboard/utils/cn";
import type React from "react";

export interface SidebarShellProps {
  /** Header content (label + create button, stats, etc.) */
  header?: React.ReactNode;
  /** Scrollable content (sections, nav items, filters) */
  children: React.ReactNode;
  className?: string;
}

/**
 * Shared sidebar container for plugin ThreePaneWorkspace first column.
 *
 * Provides the standard layout:
 * ```
 * [Header — fixed, border-bottom]
 * [Scrollable content — flex-1]
 * ```
 *
 * All plugin sidebars share this structure: tasks, notes, expenses,
 * rss-reader, and changelog.
 */
export function SidebarShell({ header, children, className }: SidebarShellProps) {
  return (
    <div
      className={cn(
        "scrollbar-thin flex h-full flex-col overflow-y-auto overflow-x-hidden",
        className
      )}
    >
      {Boolean(header) && <div className="shrink-0 border-border border-b px-3 py-2">{header}</div>}
      <div className="flex-1 py-1">{children}</div>
    </div>
  );
}

export interface SidebarHeaderProps {
  /** Section label (e.g. "Folders", "RSS Reader") */
  label: string;
  /** Optional action button (e.g. FolderPlus, Plus) */
  action?: React.ReactNode;
  /** Optional stats/count below the label */
  stats?: React.ReactNode;
}

/**
 * Standard sidebar header with label + optional action button.
 */
export function SidebarHeader({ label, action, stats }: SidebarHeaderProps) {
  return (
    <>
      <div className="flex items-center justify-between">
        <span className="font-mono text-dim text-w-sm uppercase tracking-widest">{label}</span>
        {action}
      </div>
      {stats}
    </>
  );
}
