"use client";

import type { SpanRecord } from "@radarboard/observability";
import { API_ROUTES } from "@radarboard/types/api-routes";
import { EmptyState } from "@radarboard/ui/empty-state";
import { useCallback, useEffect, useState } from "react";
import {
  DebugBadge,
  DebugCell,
  DebugRow,
  DebugSection,
  DebugTable,
  formatMs,
  LoadingState,
  SectionHeader,
  StatStrip,
} from "../../shared";

interface SpansResponse {
  spans: SpanRecord[];
  stats: {
    totalSpans: number;
    errorCount: number;
    avgDurationMs: number;
    sources: Record<string, number>;
  };
}

const STATUS_VARIANT: Record<string, "success" | "error" | "muted"> = {
  ok: "success",
  error: "error",
  unset: "muted",
};

function relativeFromMs(ts: number): string {
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

export function SpansSection() {
  const [data, setData] = useState<SpansResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(API_ROUTES.debugSpans);
      if (res.ok) {
        setData(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  if (loading) return <LoadingState />;

  if (!data || data.spans.length === 0) {
    return (
      <DebugSection>
        <SectionHeader label="Performance Spans" onRefresh={load} />
        <EmptyState
          title="No spans recorded yet"
          message="Spans will appear after API routes and plugin lifecycle hooks execute."
        />
      </DebugSection>
    );
  }

  const topSources = Object.entries(data.stats.sources)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  return (
    <DebugSection>
      <SectionHeader label="Performance Spans" onRefresh={load} />

      <StatStrip
        stats={[
          { label: "Total Spans", value: String(data.stats.totalSpans) },
          { label: "Errors", value: String(data.stats.errorCount) },
          { label: "Avg Duration", value: formatMs(data.stats.avgDurationMs) },
          {
            label: "Top Source",
            value: topSources[0] ? `${topSources[0][0]} (${topSources[0][1]})` : "—",
          },
        ]}
      />

      <DebugTable
        headers={["Name", "Status", "Duration", "Trace ID", "Parent", "When", "Attributes"]}
      >
        {data.spans
          .slice()
          .reverse()
          .map((s) => (
            <DebugRow key={s.spanId}>
              <DebugCell className="max-w-[200px] truncate font-medium" title={s.name}>
                {s.name}
              </DebugCell>
              <DebugCell>
                <DebugBadge variant={STATUS_VARIANT[s.status] ?? "muted"}>{s.status}</DebugBadge>
              </DebugCell>
              <DebugCell>{formatMs(s.durationMs)}</DebugCell>
              <DebugCell className="font-mono text-dim text-w-sm">
                {s.traceId.slice(0, 8)}
              </DebugCell>
              <DebugCell className="font-mono text-dim text-w-sm">
                {s.parentSpanId ? s.parentSpanId.slice(0, 8) : "—"}
              </DebugCell>
              <DebugCell className="text-dim">{relativeFromMs(s.startTimeMs)}</DebugCell>
              <DebugCell
                className="max-w-[150px] truncate text-dim"
                title={JSON.stringify(s.attributes)}
              >
                {Object.keys(s.attributes).length > 0
                  ? Object.entries(s.attributes)
                      .map(([k, v]) => `${k}=${v}`)
                      .join(", ")
                  : "—"}
              </DebugCell>
            </DebugRow>
          ))}
      </DebugTable>
    </DebugSection>
  );
}
