"use client";

import { cn } from "@radarboard/utils/cn";
import type React from "react";

export interface PluginListRowProps {
  /** Left indicator — icon, colored dot, or avatar */
  indicator?: React.ReactNode;
  /** Indicator color for a simple dot (e.g. "bg-success-bg"). When set, renders a dot instead of `indicator`. */
  dotColor?: string;
  /** Primary title */
  title: React.ReactNode;
  /** Optional badge/pill next to the title */
  titleBadge?: React.ReactNode;
  /** Secondary line below title (truncated) */
  subtitle?: React.ReactNode;
  /** Third line — tags, pills, metadata chips */
  chips?: React.ReactNode;
  /** Right-aligned metadata (timestamp, cost, status text) */
  meta?: React.ReactNode;
  /** Whether this row is currently selected */
  selected?: boolean;
  /** Click handler */
  onClick?: () => void;
  /** Hover-revealed action buttons */
  hoverActions?: React.ReactNode;
  /** Always-visible action buttons (e.g. delete) */
  actions?: React.ReactNode;
  /** Strikethrough title (e.g. completed tasks) */
  strikethrough?: boolean;
  className?: string;
}

/**
 * Unified list row for all plugin list panes.
 *
 * Standardises padding, spacing, selected/hover states, and layout
 * across tasks, notes, bookmarks, expenses, changelog, rss-reader,
 * status-page, and webhook-relay.
 *
 * ```
 * [dot/icon]  [title] [badge]        [meta]
 *             [subtitle]
 *             [chips/tags]
 *                              [hover actions]
 * ```
 */
export function PluginListRow({
  indicator,
  dotColor,
  title,
  titleBadge,
  subtitle,
  chips,
  meta,
  selected,
  onClick,
  hoverActions,
  actions,
  strikethrough,
  className,
}: PluginListRowProps) {
  const content = (
    <>
      {/* Left indicator */}
      {Boolean(indicator || dotColor) && (
        <span className="mt-1 shrink-0">
          {dotColor ? (
            <span className={cn("inline-block h-2 w-2 rounded-full", dotColor)} />
          ) : (
            indicator
          )}
        </span>
      )}

      {/* Content */}
      <div className="min-w-0 flex-1">
        {/* Title row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <span
              className={cn(
                "truncate text-foreground-secondary text-w-sm",
                strikethrough && "text-dim line-through"
              )}
            >
              {title}
            </span>
            {titleBadge}
          </div>
          {Boolean(meta) && <span className="shrink-0 font-mono text-dim text-w-sm">{meta}</span>}
        </div>

        {/* Subtitle */}
        {Boolean(subtitle) && <div className="mt-0.5 truncate text-dim text-w-sm">{subtitle}</div>}

        {/* Chips/tags */}
        {Boolean(chips) && <div className="mt-1 flex flex-wrap items-center gap-1">{chips}</div>}
      </div>

      {/* Always-visible actions */}
      {Boolean(actions) && <div className="flex shrink-0 items-center gap-1">{actions}</div>}

      {/* Hover-revealed actions */}
      {Boolean(hoverActions) && (
        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {hoverActions}
        </div>
      )}
    </>
  );

  const classes = cn(
    "group flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors",
    onClick && "cursor-pointer",
    selected ? "bg-secondary" : "hover:bg-surface-raised",
    className
  );

  if (onClick) {
    return (
      // biome-ignore lint/a11y/useSemanticElements: row contains nested action buttons, so a real button wrapper would be invalid
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(event: React.KeyboardEvent<HTMLDivElement>) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onClick();
          }
        }}
        className={classes}
      >
        {content}
      </div>
    );
  }

  return <div className={classes}>{content}</div>;
}

// ---------------------------------------------------------------------------
// Reusable sub-components for list rows
// ---------------------------------------------------------------------------

export interface ListRowChipProps {
  children: React.ReactNode;
  className?: string;
}

/** Small pill/badge for tags, categories, versions, etc. */
export function ListRowChip({ children, className }: ListRowChipProps) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-item border border-border px-1.5 py-0.5 font-mono text-dim text-w-xs",
        className
      )}
    >
      {children}
    </span>
  );
}

/** Colored status/priority chip */
export function ListRowStatusChip({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn("shrink-0 rounded-item px-1.5 py-0.5 font-mono text-w-xs uppercase", className)}
    >
      {children}
    </span>
  );
}
