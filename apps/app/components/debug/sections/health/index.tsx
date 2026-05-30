"use client";

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

interface SourceHealth {
  key: string;
  status: "healthy" | "degraded" | "unhealthy";
  totalRequests: number;
  successCount: number;
  failureCount: number;
  availabilityPct: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  lastFailure: { timestamp: number; error?: string } | null;
  lastSuccess: { timestamp: number } | null;
}

interface HealthResponse {
  status: string;
  totalSources: number;
  unhealthyCount: number;
  degradedCount: number;
  sources: SourceHealth[];
}

const STATUS_VARIANT: Record<string, "success" | "warning" | "error" | "muted"> = {
  healthy: "success",
  degraded: "warning",
  unhealthy: "error",
};

function _formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function relativeFromMs(ts: number): string {
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

export function HealthSection() {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(API_ROUTES.healthIntegrations);
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

  if (!data || data.totalSources === 0) {
    return (
      <DebugSection>
        <SectionHeader label="Integration Health" onRefresh={load} />
        <EmptyState
          title="No health data yet"
          message="Health data will appear after integrations make their first API calls."
        />
      </DebugSection>
    );
  }

  const healthyCount = data.totalSources - data.unhealthyCount - data.degradedCount;

  return (
    <DebugSection>
      <SectionHeader label="Integration Health" onRefresh={load} />

      <StatStrip
        stats={[
          { label: "Sources", value: String(data.totalSources) },
          { label: "Healthy", value: String(healthyCount) },
          { label: "Degraded", value: String(data.degradedCount) },
          { label: "Unhealthy", value: String(data.unhealthyCount) },
        ]}
      />

      <DebugTable
        headers={[
          "Source",
          "Status",
          "Availability",
          "Requests",
          "Avg Latency",
          "P95 Latency",
          "Last Success",
          "Last Error",
        ]}
      >
        {data.sources.map((s) => (
          <DebugRow key={s.key}>
            <DebugCell className="font-medium">{s.key}</DebugCell>
            <DebugCell>
              <DebugBadge variant={STATUS_VARIANT[s.status] ?? "muted"}>{s.status}</DebugBadge>
            </DebugCell>
            <DebugCell>{s.availabilityPct}%</DebugCell>
            <DebugCell>
              {s.successCount}/{s.totalRequests}
            </DebugCell>
            <DebugCell>{formatMs(s.avgLatencyMs)}</DebugCell>
            <DebugCell>{formatMs(s.p95LatencyMs)}</DebugCell>
            <DebugCell className="text-dim">
              {s.lastSuccess ? relativeFromMs(s.lastSuccess.timestamp) : "—"}
            </DebugCell>
            <DebugCell className="max-w-[200px] truncate text-dim" title={s.lastFailure?.error}>
              {s.lastFailure
                ? `${relativeFromMs(s.lastFailure.timestamp)}${s.lastFailure.error ? ` — ${s.lastFailure.error}` : ""}`
                : "—"}
            </DebugCell>
          </DebugRow>
        ))}
      </DebugTable>
    </DebugSection>
  );
}
