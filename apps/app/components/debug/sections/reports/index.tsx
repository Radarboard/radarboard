"use client";

import { API_ROUTES, reportRoute } from "@radarboard/types/api-routes";
import { EmptyState } from "@radarboard/ui/empty-state";
import { Download } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  DebugBadge,
  DebugCell,
  DebugRow,
  DebugSection,
  DebugTable,
  LoadingState,
  SectionHeader,
  StatStrip,
} from "../../shared";

interface ReportEntry {
  id: string;
  title: string;
  markdown: string;
  generatedAt: number;
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function ReportsSection() {
  const [reports, setReports] = useState<ReportEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(API_ROUTES.debugReports);
    if (res.ok) {
      const data = (await res.json()) as { reports: ReportEntry[] };
      setReports(data.reports ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load().catch(() => {
      /* fire-and-forget */
    });
  }, [load]);

  const selectedReport = reports.find((r) => r.id === selectedId);

  return (
    <DebugSection>
      <StatStrip stats={[{ label: "Total reports", value: reports.length.toString() }]} />

      <SectionHeader label={`${reports.length} exported reports`} onRefresh={load} />

      {Boolean(loading) && <LoadingState />}
      {!loading && reports.length === 0 && (
        <EmptyState message="No reports yet. Use the export_report AI tool to generate analysis reports." />
      )}
      {!loading && reports.length > 0 && !selectedReport && (
        <DebugTable headers={["Title", "Generated", "Age", "Actions"]}>
          {reports.map((r) => (
            <DebugRow key={r.id}>
              <DebugCell>
                <button
                  type="button"
                  onClick={() => setSelectedId(r.id)}
                  className="text-left font-mono text-foreground text-w-sm hover:underline"
                >
                  {r.title}
                </button>
              </DebugCell>
              <DebugCell className="text-dim">{formatTime(r.generatedAt)}</DebugCell>
              <DebugCell>
                <DebugBadge variant="muted">{timeAgo(r.generatedAt)}</DebugBadge>
              </DebugCell>
              <DebugCell>
                <a
                  href={reportRoute(r.id)}
                  download
                  className="inline-flex items-center gap-1 text-dim text-w-xs hover:text-foreground"
                >
                  <Download className="h-3 w-3" />
                  Download
                </a>
              </DebugCell>
            </DebugRow>
          ))}
        </DebugTable>
      )}
      {selectedReport && (
        <div className="flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-mono font-semibold text-sm">{selectedReport.title}</h3>
            <div className="flex items-center gap-2">
              <a
                href={reportRoute(selectedReport.id)}
                download
                className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-dim text-w-xs hover:text-foreground"
              >
                <Download className="h-3 w-3" />
                Download
              </a>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="rounded border border-border px-2 py-1 text-dim text-w-xs hover:text-foreground"
              >
                Back to list
              </button>
            </div>
          </div>
          <div className="whitespace-pre-wrap rounded border border-border bg-surface-secondary p-4 font-mono text-w-sm">
            {selectedReport.markdown}
          </div>
        </div>
      )}
    </DebugSection>
  );
}
