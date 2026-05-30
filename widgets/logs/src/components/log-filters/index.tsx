"use client";

import type { LogLevel } from "@radarboard/types/logs";
import { Button } from "@radarboard/ui/button";
import { Input } from "@radarboard/ui/input";
import { NativeSelect } from "@radarboard/ui/select";
import { cn } from "@radarboard/utils/cn";

const LEVELS: Array<{ value: LogLevel | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "error", label: "Error" },
  { value: "warn", label: "Warn" },
  { value: "info", label: "Info" },
  { value: "debug", label: "Debug" },
];

interface LogFiltersProps {
  activeLevel: LogLevel | "all";
  onLevelChange: (level: LogLevel | "all") => void;
  search: string;
  onSearchChange: (search: string) => void;
  live: boolean;
  onLiveChange: (live: boolean) => void;
  connected: boolean;
  logCount: number;
  onClear: () => void;
}

/** Filter bar for the expanded logs widget. */
export function LogFilters({
  activeLevel,
  onLevelChange,
  search,
  onSearchChange,
  live,
  onLiveChange,
  connected,
  logCount,
  onClear,
}: LogFiltersProps) {
  return (
    <div className="flex shrink-0 items-center gap-3 border-border border-b px-3 py-2.5">
      <NativeSelect
        value={activeLevel}
        onChange={(e) => onLevelChange(e.target.value as LogLevel | "all")}
        variant="surface"
        size="sm"
        className="w-28 font-mono text-w-sm uppercase tracking-wider"
      >
        {LEVELS.map((level) => (
          <option key={level.value} value={level.value}>
            {level.label}
          </option>
        ))}
      </NativeSelect>

      {/* Search input */}
      <Input
        type="text"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search logs..."
        variant="surface"
        size="sm"
        className="w-36 font-mono text-w-sm"
      />

      {/* Live toggle */}
      <Button
        type="button"
        onClick={() => onLiveChange(!live)}
        variant="ghost"
        size="sm"
        uppercase
        className={cn(
          live ? "bg-[#0d2818] text-[#3fb950]" : "text-dim hover:text-muted-foreground"
        )}
      >
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            (() => {
              if (live && connected) return "animate-pulse bg-[#3fb950]";
              if (live) return "bg-[#d29922]";
              return "bg-[#444]";
            })()
          )}
        />
        {live ? "Live" : "Polling"}
      </Button>

      {/* Spacer + count + clear */}
      <div className="ml-auto flex items-center gap-2">
        <span className="font-mono text-dim text-w-sm">{logCount} entries</span>
        <Button
          type="button"
          onClick={onClear}
          variant="ghost"
          size="sm"
          uppercase={false}
          className="text-dim hover:text-muted-foreground"
        >
          Clear
        </Button>
      </div>
    </div>
  );
}
