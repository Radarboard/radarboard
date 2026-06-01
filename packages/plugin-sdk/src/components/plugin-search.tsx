"use client";

import { Input } from "@radarboard/ui/input";
import { cn } from "@radarboard/utils/cn";
import { Search } from "lucide-react";

export interface PluginSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
}

/**
 * Standardized search input for plugin list panes.
 *
 * Consistent styling: bordered input with left-aligned search icon,
 * focus accent border, and placeholder text.
 */
export function PluginSearchInput({
  value,
  onChange,
  placeholder = "Search...",
  className,
  onKeyDown,
}: PluginSearchInputProps) {
  return (
    <div className={cn("relative", className)}>
      <Search className="icon-sm absolute top-1/2 left-2.5 -translate-y-1/2 text-dim" />
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        variant="surface"
        size="lg"
        className="pr-3 pl-8 text-w-sm"
      />
    </div>
  );
}
