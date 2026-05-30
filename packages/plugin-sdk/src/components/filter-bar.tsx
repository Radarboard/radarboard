"use client";

import { Button } from "@radarboard/ui/button";
import { cn } from "@radarboard/utils/cn";

export interface FilterOption<T extends string = string> {
  value: T;
  label: string;
  count?: number;
}

export interface FilterBarProps<T extends string = string> {
  options: FilterOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  /** Size variant */
  size?: "sm" | "md";
}

/**
 * Shared tab/button-group filter bar for status, priority, category filtering.
 *
 * Used by tasks (status/priority tabs), expenses (category filters), etc.
 */
export function FilterBar<T extends string = string>({
  options,
  value,
  onChange,
  className,
  size = "sm",
}: FilterBarProps<T>) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {options.map((option) => (
        <Button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          variant={value === option.value ? "active" : "ghost"}
          size={size === "sm" ? "sm" : "default"}
          uppercase
          className={cn(value !== option.value && "text-dim hover:text-foreground-secondary")}
        >
          {option.label}
          {option.count !== undefined && (
            <span className="ml-1 text-dim tabular-nums">{option.count}</span>
          )}
        </Button>
      ))}
    </div>
  );
}
