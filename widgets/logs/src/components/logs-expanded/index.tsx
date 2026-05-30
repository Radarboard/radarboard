"use client";

import { useLogs } from "@radarboard/hooks/use-logs";
import type { LogLevel } from "@radarboard/types/logs";
import { Button } from "@radarboard/ui/button";
import type { LogsWidgetConfig, WidgetRenderProps } from "@radarboard/widget-sdk/widget-types";
import { useEffect, useRef, useState } from "react";
import { LogEntryRow, LogListHeader } from "../log-entry";
import { LogFilters } from "../log-filters";

/** Expanded logs view with filters, search, live streaming, and auto-scroll. */
export function LogsExpanded(_props: WidgetRenderProps<LogsWidgetConfig>) {
  const [levelFilter, setLevelFilter] = useState<LogLevel | "all">("all");
  const [search, setSearch] = useState("");
  const [live, setLive] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { logs, loading, error, clear, connected } = useLogs({
    level: levelFilter === "all" ? undefined : levelFilter,
    search: search || undefined,
    limit: 500,
    live,
  });

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (!autoScroll) return;
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [autoScroll]);

  // Detect manual scroll to disable auto-scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
      setAutoScroll(isAtBottom);
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="flex h-full flex-col">
      {/* Filter bar */}
      <LogFilters
        activeLevel={levelFilter}
        onLevelChange={setLevelFilter}
        search={search}
        onSearchChange={setSearch}
        live={live}
        onLiveChange={setLive}
        connected={connected}
        logCount={logs.length}
        onClear={clear}
      />

      {/* Error banner */}
      {Boolean(error) && (
        <div className="border-border border-b bg-[#2d0000] px-3 py-1.5 font-mono text-[#f85149] text-w-sm">
          {error}
        </div>
      )}

      {/* Log list */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        {loading && logs.length === 0 && (
          <div className="flex h-full items-center justify-center font-mono text-dim text-w-sm">
            Loading logs...
          </div>
        )}
        {!loading && logs.length === 0 && (
          <div className="flex h-full items-center justify-center font-mono text-dim text-w-sm">
            No logs match the current filters.
          </div>
        )}
        {logs.length > 0 && (
          <>
            <LogListHeader />
            {logs.map((entry) => (
              <LogEntryRow key={entry.id} entry={entry} />
            ))}
          </>
        )}
      </div>

      {/* Auto-scroll indicator */}
      {!autoScroll && logs.length > 0 && (
        <Button
          type="button"
          onClick={() => {
            setAutoScroll(true);
            const el = scrollRef.current;
            if (el) {
              el.scrollTop = el.scrollHeight;
            }
          }}
          variant="secondary"
          size="sm"
          uppercase={false}
          className="absolute right-3 bottom-3"
        >
          Scroll to bottom
        </Button>
      )}
    </div>
  );
}
