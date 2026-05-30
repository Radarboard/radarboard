"use client";

import { Button } from "@radarboard/ui/button";
import { Tabs, TabsList } from "@radarboard/ui/tabs";
import { cn } from "@radarboard/utils/cn";
import type { ReactNode } from "react";

export interface WidgetSegmentedTabItem {
  id: string;
  label: string;
  icon?: ReactNode;
  count?: number;
  accentColor?: string;
}

interface SegmentedTabButtonProps {
  active: boolean;
  compact: boolean;
  item: WidgetSegmentedTabItem;
  onSelect: (value: string) => void;
}

interface WidgetSegmentedTabsProps {
  value: string;
  onValueChange: (value: string) => void;
  items: WidgetSegmentedTabItem[];
  variant?: "compact" | "expanded";
  className?: string;
}

function SegmentedTabButton({ active, compact, item, onSelect }: SegmentedTabButtonProps) {
  const accentColor = item.accentColor;

  return (
    <Button
      type="button"
      variant="ghost"
      role="tab"
      tabIndex={active ? 0 : -1}
      aria-selected={active}
      data-state={active ? "active" : "inactive"}
      onClick={() => onSelect(item.id)}
      className={cn(
        "uppercase-none flex h-auto flex-none items-center gap-1.5 rounded-none border-transparent border-b-2 bg-transparent font-mono font-normal normal-case tracking-normal transition-colors",
        compact ? "px-3 py-2 text-w-sm" : "px-4 py-2.5 text-w-base",
        active ? "text-foreground" : "text-dim hover:bg-muted hover:text-foreground-secondary"
      )}
      style={
        active && accentColor
          ? {
              color: accentColor,
              borderBottomColor: accentColor,
            }
          : undefined
      }
    >
      {item.icon !== undefined ? <span className="shrink-0">{item.icon}</span> : null}
      {item.label}
      {typeof item.count === "number" ? (
        <span
          className={cn(
            "rounded-item px-1.5 text-w-sm",
            active ? "text-foreground" : "bg-secondary text-dim"
          )}
          style={
            active && accentColor
              ? {
                  color: accentColor,
                  backgroundColor: `${accentColor}10`,
                }
              : undefined
          }
        >
          {item.count}
        </span>
      ) : null}
    </Button>
  );
}

export function WidgetSegmentedTabs({
  value,
  onValueChange,
  items,
  variant = "expanded",
  className,
}: WidgetSegmentedTabsProps) {
  const compact = variant === "compact";

  return (
    <Tabs value={value} onValueChange={onValueChange} className={className}>
      <TabsList>
        {items.map((item) => (
          <SegmentedTabButton
            key={item.id}
            active={value === item.id}
            compact={compact}
            item={item}
            onSelect={onValueChange}
          />
        ))}
      </TabsList>
    </Tabs>
  );
}
