"use client";

import { useLogs } from "@radarboard/hooks/use-logs";
import type { LogsWidgetConfig, WidgetRenderProps } from "@radarboard/widget-sdk/widget-types";
import { useEffect, useRef } from "react";
import { LogEntryRow, LogListHeader } from "../log-entry";

/** Compact logs view for the dashboard grid. Shows a scrollable list of recent log entries. */
export function LogsCompact(_props: WidgetRenderProps<LogsWidgetConfig>) {
  const { logs, loading } = useLogs({ limit: 50 });
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  });

  if (loading && logs.length === 0) {
    return (
      <div className="flex h-full items-center justify-center font-mono text-dim text-w-sm">
        Loading logs...
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="flex h-full items-center justify-center font-mono text-dim text-w-sm">
        No logs yet. Logs appear as API routes are called.
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto">
      <LogListHeader compact />
      {logs.map((entry) => (
        <LogEntryRow key={entry.id} entry={entry} compact />
      ))}
    </div>
  );
}
