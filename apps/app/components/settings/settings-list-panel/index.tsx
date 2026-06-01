"use client";

import { Button } from "@radarboard/ui/button";
import { Input } from "@radarboard/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@radarboard/ui/tooltip";
import { cn } from "@radarboard/utils/cn";
import { ChevronsLeft, List, Plus, Search } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";

/**
 * Consistent column width for all settings list panels (Projects, Layouts, MCP Servers).
 * Use as `className={SETTINGS_LIST_WIDTH}` on the panel container.
 */
export const SETTINGS_LIST_WIDTH = "w-[260px]";

/**
 * Shared header for settings list panels.
 *
 * Renders: title + subtitle + add button on one row, search below.
 * Every list panel (Projects, Layouts, MCP Servers) uses this for visual consistency.
 */
export function ListPanelHeader({
  title,
  subtitle,
  searchPlaceholder,
  searchValue,
  onSearchChange,
  onAdd,
  addLabel,
}: {
  title: string;
  subtitle: string;
  searchPlaceholder: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onAdd: () => void;
  /** Accessible label for the add button. */
  addLabel: string;
}) {
  return (
    <div className="shrink-0 border-border border-b p-3">
      <div className="mb-2 flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-mono text-dim text-w-xs uppercase tracking-widest">{title}</div>
          <div className="truncate text-dim/70 text-w-xs">{subtitle}</div>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={onAdd}
              className="uppercase-none h-7 w-7 border-border text-dim transition-colors hover:border-accent/40 hover:text-foreground-secondary"
              aria-label={addLabel}
            >
              <Plus className="icon-xs" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{addLabel}</TooltipContent>
        </Tooltip>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="icon-xs pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-dim" />
        <Input
          type="search"
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-8 w-full pr-2 pl-8 font-mono text-w-xs"
        />
      </div>
    </div>
  );
}

/** Breakpoint below which the list panel auto-collapses. */
const LIST_COLLAPSE_BREAKPOINT = 1024;

/**
 * Wrapper that auto-collapses its children (a list panel) on small viewports.
 * When collapsed, shows a small toggle button; when expanded, overlays the detail area.
 * Use `]` key to toggle.
 */
export function CollapsibleListPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${LIST_COLLAPSE_BREAKPOINT}px)`);
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setCollapsed(e.matches);
      if (!e.matches) setPanelOpen(false);
    };
    handleChange(mq);
    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, []);

  // ] key toggles list panel fold/unfold
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "]" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
          return;
        if (!collapsed) return;
        e.preventDefault();
        setPanelOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [collapsed]);

  // Normal: render as-is
  if (!collapsed) {
    return (
      <div
        className={cn(
          SETTINGS_LIST_WIDTH,
          "flex shrink-0 flex-col border-border border-r",
          className
        )}
      >
        {children}
      </div>
    );
  }

  // Collapsed: show toggle button
  if (!panelOpen) {
    return (
      <TooltipProvider delayDuration={200}>
        <div className="flex shrink-0 border-border border-r">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setPanelOpen(true)}
                className="h-auto rounded-none px-2 py-3 text-dim hover:bg-muted hover:text-foreground-secondary"
                aria-label="Show list panel"
              >
                <List className="icon-sm" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              Show list <kbd className="ml-1 text-dim">]</kbd>
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    );
  }

  // Collapsed + open: overlay
  return (
    <div
      className={cn(
        "absolute inset-y-0 left-0 z-10 flex w-[260px] shrink-0 flex-col border-border border-r bg-surface shadow-lg",
        className
      )}
    >
      <div className="flex justify-end border-border border-b px-2 py-1">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setPanelOpen(false)}
          className="h-auto rounded-item px-2 py-1 text-dim hover:text-foreground-secondary"
          aria-label="Hide list panel"
        >
          <ChevronsLeft className="icon-sm" />
        </Button>
      </div>
      {children}
    </div>
  );
}
