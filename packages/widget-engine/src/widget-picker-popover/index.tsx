"use client";

import { Button } from "@radarboard/ui/button";
import { Input } from "@radarboard/ui/input";
import { cn } from "@radarboard/utils/cn";
import type { GridSlot } from "@radarboard/widget-sdk/widget-types";
import { Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { WIDGET_REGISTRY } from "../widgets/registry";

interface WidgetPickerPopoverProps {
  /** Whether the popover is open. */
  open: boolean;
  /** Called when the popover should close. */
  onOpenChange: (open: boolean) => void;
  /** Current widget layout — used to determine which widgets are already placed. */
  widgetLayout: Record<GridSlot, string | null>;
  /** Called when the user selects a widget. */
  onSelect: (widgetId: string) => void;
}

export function WidgetPickerPopover({
  open,
  onOpenChange,
  widgetLayout,
  onSelect,
}: WidgetPickerPopoverProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const attachInputRef = useCallback((node: HTMLInputElement | null) => {
    inputRef.current = node;
    node?.focus();
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setSearchQuery("");
        onOpenChange(false);
      }
    }
    // Use a timeout so the opening click doesn't immediately close
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClick);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [open, onOpenChange]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setSearchQuery("");
        onOpenChange(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  // Build set of already-placed widget IDs
  const placedWidgetIds = new Set(
    Object.values(widgetLayout).filter((id): id is string => id !== null)
  );

  // Get available (unplaced) widgets
  const allWidgets = Array.from(WIDGET_REGISTRY.values());
  const availableWidgets = allWidgets.filter((w) => !placedWidgetIds.has(w.id));

  // Filter by search query
  const filteredWidgets = searchQuery.trim()
    ? availableWidgets.filter(
        (w) =>
          w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          w.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : availableWidgets;

  const handleSelect = useCallback(
    (widgetId: string) => {
      setSearchQuery("");
      onSelect(widgetId);
      onOpenChange(false);
    },
    [onSelect, onOpenChange]
  );

  if (!open) return null;

  return (
    <div
      ref={popoverRef}
      className="absolute top-1/2 left-1/2 z-ticker w-sidebar -translate-x-1/2 -translate-y-1/2 rounded-item border border-border bg-surface shadow-2xl"
    >
      {/* Search */}
      <div className="border-border border-b p-2">
        <div className="relative">
          <Search className="icon-xs absolute top-1/2 left-2 -translate-y-1/2 text-dim" />
          <Input
            ref={attachInputRef}
            type="text"
            placeholder="Search widgets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            variant="surface"
            size="lg"
            className="bg-surface pr-2 pl-7 font-mono"
          />
        </div>
      </div>

      {/* Widget list */}
      <div className="scrollbar-thin max-h-widget-md overflow-y-auto p-1">
        {filteredWidgets.length === 0 ? (
          <div className="py-6 text-center">
            <p className="font-mono text-dim text-w-sm">
              {availableWidgets.length === 0
                ? "All widgets are placed"
                : "No widgets match your search"}
            </p>
          </div>
        ) : (
          filteredWidgets.map((widget) => (
            <Button
              key={widget.id}
              type="button"
              variant="ghost"
              uppercase={false}
              onClick={() => handleSelect(widget.id)}
              className={cn(
                "w-full cursor-pointer rounded-item px-3 py-2 text-left transition-colors",
                "group hover:bg-surface-raised"
              )}
            >
              <div className="font-mono text-foreground-secondary text-w-base group-hover:text-[#eee]">
                {widget.name}
              </div>
              <div className="mt-0.5 line-clamp-1 font-mono text-dim text-w-sm">
                {widget.description}
              </div>
            </Button>
          ))
        )}
      </div>
    </div>
  );
}
