"use client";

import { useLogs } from "@radarboard/hooks/use-logs";
import type { LogEntry, LogLevel } from "@radarboard/types/logs";
import { Button } from "@radarboard/ui/button";
import { EmptyState } from "@radarboard/ui/empty-state";
import { Input } from "@radarboard/ui/input";
import { cn } from "@radarboard/utils/cn";
import { type RefObject, useEffect, useRef, useState } from "react";
import { InlineListHeader, InlineListRow } from "../../../components/inline-list-layout";
import type { StreamListSectionConfig } from "../../types";

const LEVELS: Array<{ value: LogLevel | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "error", label: "Error" },
  { value: "warn", label: "Warn" },
  { value: "info", label: "Info" },
  { value: "debug", label: "Debug" },
];

const LEVEL_COLORS: Record<string, string> = {
  debug: "text-dim bg-secondary",
  info: "text-[#58a6ff] bg-[#0d1b2e]",
  warn: "text-[#d29922] bg-[#2b2000]",
  error: "text-[#f85149] bg-[#2d0000]",
};

const COMPACT_GRID_TEMPLATE = "44px 84px minmax(0,1fr) 54px 14px";
const EXPANDED_GRID_TEMPLATE = "48px 120px minmax(0,1fr) 64px 14px";

function formatTimestamp(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 5) return "now";
  if (seconds < 60) return `${String(seconds)}s ago`;
  if (seconds < 3600) return `${String(Math.floor(seconds / 60))}m ago`;
  if (seconds < 86400) return `${String(Math.floor(seconds / 3600))}h ago`;
  return `${String(Math.floor(seconds / 86400))}d ago`;
}

function StreamListHeader({ compact = false }: { compact?: boolean }) {
  return (
    <InlineListHeader
      gridTemplateColumns={compact ? COMPACT_GRID_TEMPLATE : EXPANDED_GRID_TEMPLATE}
      columns={[
        { key: "level", label: "Lvl" },
        { key: "source", label: "Source" },
        { key: "message", label: "Message" },
        { key: "time", label: "Time", align: "right" },
        { key: "expand", label: "", align: "center" },
      ]}
    />
  );
}

function StreamListRow({ entry, compact = false }: { entry: LogEntry; compact?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const levelColor = LEVEL_COLORS[entry.level] ?? LEVEL_COLORS.debug;
  const hasMetadata = entry.metadata && Object.keys(entry.metadata).length > 0;

  return (
    <div className="border-border border-b">
      <InlineListRow
        gridTemplateColumns={compact ? COMPACT_GRID_TEMPLATE : EXPANDED_GRID_TEMPLATE}
        onClick={hasMetadata ? () => setExpanded((value) => !value) : undefined}
        cells={[
          {
            key: "level",
            content: (
              <span
                className={cn(
                  "inline-flex items-center justify-center rounded-item px-1 py-0.5 font-mono text-w-sm uppercase tracking-wider",
                  levelColor
                )}
              >
                {entry.level.slice(0, 3)}
              </span>
            ),
          },
          {
            key: "source",
            content: (
              <span className="block truncate font-mono text-dim text-w-sm">{entry.source}</span>
            ),
          },
          {
            key: "message",
            content: (
              <span className="block truncate text-foreground-secondary">{entry.message}</span>
            ),
          },
          {
            key: "time",
            align: "right",
            content: (
              <span className="block font-mono text-dim text-w-sm tabular-nums">
                {formatTimestamp(entry.timestamp)}
              </span>
            ),
          },
          {
            key: "expand",
            align: "center",
            content: hasMetadata ? (
              <span className="block font-mono text-dim text-w-sm">{expanded ? "-" : "+"}</span>
            ) : null,
          },
        ]}
      />

      {expanded && hasMetadata ? (
        <pre className="mx-3 mt-1 mb-2 overflow-x-auto whitespace-pre-wrap break-all rounded-item border border-border bg-[#0a0a0a] p-2 text-dim text-w-sm">
          {JSON.stringify(entry.metadata, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}

function StreamListControls({
  levelFilter,
  onLevelChange,
  search,
  onSearchChange,
  live,
  onLiveChange,
  connected,
  logCount,
  onClear,
  showSearch,
  showLiveToggle,
}: {
  levelFilter: LogLevel | "all";
  onLevelChange: (level: LogLevel | "all") => void;
  search: string;
  onSearchChange: (search: string) => void;
  live: boolean;
  onLiveChange: (live: boolean) => void;
  connected: boolean;
  logCount: number;
  onClear: () => void;
  showSearch: boolean;
  showLiveToggle: boolean;
}) {
  return (
    <div className="flex shrink-0 items-center gap-3 border-border border-b px-3 py-2.5">
      <div className="flex items-center gap-1">
        {LEVELS.map((level) => (
          <Button
            key={level.value}
            type="button"
            variant="ghost"
            size="sm"
            uppercase={false}
            onClick={() => onLevelChange(level.value)}
            className={cn(
              "cursor-pointer rounded-item px-2 py-0.5 font-mono text-w-sm uppercase tracking-wider transition-colors",
              levelFilter === level.value
                ? "bg-secondary text-foreground"
                : "text-dim hover:text-muted-foreground"
            )}
          >
            {level.label}
          </Button>
        ))}
      </div>

      {showSearch ? (
        <Input
          type="text"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search logs..."
          variant="surface"
          size="sm"
          className="w-36 font-mono text-w-sm"
        />
      ) : null}

      {showLiveToggle ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          uppercase={false}
          onClick={() => onLiveChange(!live)}
          className={cn(
            "flex cursor-pointer items-center gap-1 rounded-item px-2 py-0.5 font-mono text-w-sm uppercase tracking-wider transition-colors",
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
      ) : null}

      <div className="ml-auto flex items-center gap-2">
        <span className="font-mono text-dim text-w-sm">{logCount} entries</span>
        <Button
          type="button"
          variant="ghost-link"
          spacing="none"
          uppercase={false}
          onClick={onClear}
          className="cursor-pointer px-2 py-0.5 font-mono text-dim text-w-sm hover:text-muted-foreground"
        >
          Clear
        </Button>
      </div>
    </div>
  );
}

export function StreamListSection({ config }: { config: StreamListSectionConfig }) {
  const compact = (config.variant ?? "compact") === "compact";
  const [levelFilter, setLevelFilter] = useState<LogLevel | "all">(config.defaultLevel ?? "all");
  const [search, setSearch] = useState("");
  const [live, setLive] = useState(config.defaultLive ?? false);
  const [autoScroll, setAutoScroll] = useState(config.autoScroll ?? true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { logs, loading, error, clear, connected } = useLogs({
    level: levelFilter === "all" ? undefined : levelFilter,
    search: search || undefined,
    limit: config.maxItems ?? (compact ? 50 : 500),
    live,
  });

  useEffect(() => {
    if (!autoScroll) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [autoScroll]);

  useEffect(() => {
    if (compact) return;
    const el = scrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
      setAutoScroll(isAtBottom);
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [compact]);

  if (loading && logs.length === 0) {
    return <EmptyState message="Loading logs..." variant="compact" />;
  }

  if (logs.length === 0) {
    return <EmptyState message={config.emptyMessage ?? "No logs yet."} variant="compact" />;
  }

  return (
    <StreamListBody
      compact={compact}
      config={config}
      logs={logs}
      error={error}
      clear={clear}
      connected={connected}
      levelFilter={levelFilter}
      onLevelChange={setLevelFilter}
      search={search}
      onSearchChange={setSearch}
      live={live}
      onLiveChange={setLive}
      autoScroll={autoScroll}
      onEnableAutoScroll={() => {
        setAutoScroll(true);
        const el = scrollRef.current;
        if (el) el.scrollTop = el.scrollHeight;
      }}
      scrollRef={scrollRef}
    />
  );
}

function StreamListBody({
  compact,
  config,
  logs,
  error,
  clear,
  connected,
  levelFilter,
  onLevelChange,
  search,
  onSearchChange,
  live,
  onLiveChange,
  autoScroll,
  onEnableAutoScroll,
  scrollRef,
}: {
  compact: boolean;
  config: StreamListSectionConfig;
  logs: LogEntry[];
  error: string | null;
  clear: () => Promise<void>;
  connected: boolean;
  levelFilter: LogLevel | "all";
  onLevelChange: (level: LogLevel | "all") => void;
  search: string;
  onSearchChange: (search: string) => void;
  live: boolean;
  onLiveChange: (live: boolean) => void;
  autoScroll: boolean;
  onEnableAutoScroll: () => void;
  scrollRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="flex h-full flex-col">
      {!compact ? (
        <StreamListControls
          levelFilter={levelFilter}
          onLevelChange={onLevelChange}
          search={search}
          onSearchChange={onSearchChange}
          live={live}
          onLiveChange={onLiveChange}
          connected={connected}
          logCount={logs.length}
          onClear={() => {
            clear().catch(() => {
              /* fire-and-forget */
            });
          }}
          showSearch={config.showSearch ?? true}
          showLiveToggle={config.showLiveToggle ?? true}
        />
      ) : null}

      {error ? (
        <div className="border-border border-b bg-[#2d0000] px-3 py-1.5 font-mono text-[#f85149] text-w-sm">
          {error}
        </div>
      ) : null}

      <div ref={scrollRef} className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
        <StreamListHeader compact={compact} />
        {logs.map((entry) => (
          <StreamListRow key={entry.id} entry={entry} compact={compact} />
        ))}
      </div>

      {!compact && !autoScroll && logs.length > 0 ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          uppercase={false}
          onClick={onEnableAutoScroll}
          className="absolute right-3 bottom-3 cursor-pointer rounded-item border border-border bg-secondary px-2 py-1 font-mono text-foreground-secondary text-w-sm transition-colors hover:bg-secondary"
        >
          Scroll to bottom
        </Button>
      ) : null}
    </div>
  );
}
