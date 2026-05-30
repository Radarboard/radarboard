"use client";

import { Button } from "@radarboard/ui/button";
import { cn } from "@radarboard/utils/cn";

export interface PluginListTab<T extends string = string> {
  value: T;
  label: string;
  /** Optional custom class applied when this tab is active */
  activeClassName?: string;
}

export interface PluginListTabsProps<T extends string = string> {
  tabs: PluginListTab<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/**
 * Horizontal tab bar for switching between list views (e.g. Active/Trash, Unread/Read).
 *
 * Place below `PluginListHeader` and above the scrollable list area.
 */
export function PluginListTabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: PluginListTabsProps<T>) {
  return (
    <div className={cn("flex items-center gap-1 border-border border-b px-3 py-1.5", className)}>
      {tabs.map((tab) => (
        <Button
          key={tab.value}
          type="button"
          onClick={() => onChange(tab.value)}
          variant={value === tab.value ? "active" : "ghost"}
          size="sm"
          uppercase={false}
          className={cn(value !== tab.value && "text-dim hover:text-dim", tab.activeClassName)}
        >
          {tab.label}
        </Button>
      ))}
    </div>
  );
}
