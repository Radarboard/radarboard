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
  LoadingState,
  SectionHeader,
  StatStrip,
} from "../../shared";

interface ExtensionUsageSummary {
  extensionId: string;
  extensionType: string;
  totalMounts: number;
  totalErrors: number;
  lastActiveDay: string;
}

interface UsageResponse {
  usage: ExtensionUsageSummary[];
}

function errorRate(ext: ExtensionUsageSummary): number {
  if (ext.totalMounts === 0) return 0;
  return (ext.totalErrors / ext.totalMounts) * 100;
}

function rateVariant(rate: number): "success" | "warning" | "error" | "muted" {
  if (rate === 0) return "success";
  if (rate < 5) return "warning";
  return "error";
}

export function ExtensionHealthSection() {
  const [data, setData] = useState<ExtensionUsageSummary[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(API_ROUTES.extensionsUsage);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as UsageResponse;
      setData(json.usage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) return <LoadingState />;
  if (error) return <EmptyState message={error} />;
  if (!data || data.length === 0) {
    return (
      <EmptyState message="No extension usage data yet. Usage is tracked as extensions are mounted." />
    );
  }

  const totalMounts = data.reduce((acc, ext) => acc + ext.totalMounts, 0);
  const totalErrors = data.reduce((acc, ext) => acc + ext.totalErrors, 0);
  const overallErrorRate = totalMounts > 0 ? ((totalErrors / totalMounts) * 100).toFixed(1) : "0";
  const activeExtensions = data.filter((ext) => ext.totalMounts > 0).length;

  return (
    <div className="space-y-6">
      <SectionHeader label="Extension Health" onRefresh={fetchData} />

      <StatStrip
        stats={[
          { label: "Active Extensions", value: String(activeExtensions) },
          { label: "Total Mounts", value: totalMounts.toLocaleString() },
          { label: "Total Errors", value: String(totalErrors) },
          { label: "Error Rate", value: `${overallErrorRate}%` },
        ]}
      />

      <DebugSection>
        <DebugTable
          headers={["Extension", "Type", "Mounts", "Errors", "Error Rate", "Last Active"]}
        >
          {data.map((ext) => {
            const rate = errorRate(ext);
            return (
              <DebugRow key={`${ext.extensionType}-${ext.extensionId}`}>
                <DebugCell className="font-mono">{ext.extensionId}</DebugCell>
                <DebugCell>
                  <DebugBadge variant="muted">{ext.extensionType}</DebugBadge>
                </DebugCell>
                <DebugCell className="font-mono">{ext.totalMounts.toLocaleString()}</DebugCell>
                <DebugCell className="font-mono">{ext.totalErrors}</DebugCell>
                <DebugCell>
                  <DebugBadge variant={rateVariant(rate)}>{rate.toFixed(1)}%</DebugBadge>
                </DebugCell>
                <DebugCell className="text-dim">{ext.lastActiveDay}</DebugCell>
              </DebugRow>
            );
          })}
        </DebugTable>
      </DebugSection>
    </div>
  );
}
