"use client";

import type { LogEntry } from "@radarboard/types/logs";
import { cn } from "@radarboard/utils/cn";
import { InlineListHeader, InlineListRow } from "@radarboard/widget-engine/inline-list-layout";
import { useState } from "react";

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

interface LogEntryRowProps {
  entry: LogEntry;
  compact?: boolean;
}

export function LogListHeader({ compact = false }: { compact?: boolean }) {
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

/** A single log entry row with expandable metadata. */
export function LogEntryRow({ entry, compact = false }: LogEntryRowProps) {
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

      {Boolean(expanded) && hasMetadata && (
        <pre className="mx-3 mt-1 mb-2 overflow-x-auto whitespace-pre-wrap break-all rounded-item border border-border bg-[#0a0a0a] p-2 text-dim text-w-sm">
          {JSON.stringify(entry.metadata, null, 2)}
        </pre>
      )}
    </div>
  );
}
