"use client";

import { API_ROUTES } from "@radarboard/types/api-routes";
import { EmptyState } from "@radarboard/ui/empty-state";
import { useCallback, useEffect, useMemo, useState } from "react";
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

type ExtensionHealthStatus = "ok" | "warning" | "error";
type ExtensionHealthKind = "feature" | "integration" | "virtual-integration" | "plugin" | "widget";

interface ExtensionHealthIssue {
  level: "warning" | "error";
  code: string;
  message: string;
  extensionId?: string;
  extensionType?: ExtensionHealthKind;
}

interface ExtensionHealthDetail {
  id: string;
  name: string;
  type: ExtensionHealthKind;
  status: ExtensionHealthStatus;
  checks: string[];
  metrics: Record<string, string | number | boolean>;
}

interface HealthResponse {
  overall: number;
  coverage: { score: number; configured: number; total: number };
  registry: {
    expected: { features: number; integrations: number; plugins: number; widgets: number };
    registered: { features: number; integrations: number; plugins: number; widgets: number };
    dataSources: { integration: number; widget: number };
  };
  details: ExtensionHealthDetail[];
  issues: ExtensionHealthIssue[];
}

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

interface ExtensionHealthState {
  health: HealthResponse;
  usage: ExtensionUsageSummary[];
}

function statusVariant(status: ExtensionHealthStatus): "success" | "warning" | "error" {
  if (status === "error") return "error";
  if (status === "warning") return "warning";
  return "success";
}

function issueVariant(level: ExtensionHealthIssue["level"]): "warning" | "error" {
  return level === "error" ? "error" : "warning";
}

function formatMetricValue(value: string | number | boolean): string {
  if (typeof value === "boolean") return value ? "yes" : "no";
  return String(value);
}

function usageKey(type: string, id: string): string {
  return `${type}:${id}`;
}

function issueCountFor(
  issues: ExtensionHealthIssue[],
  type: ExtensionHealthKind,
  id: string
): number {
  return issues.filter((issue) => issue.extensionType === type && issue.extensionId === id).length;
}

export function ExtensionHealthSection() {
  const [data, setData] = useState<ExtensionHealthState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [healthRes, usageRes] = await Promise.all([
        fetch(API_ROUTES.extensionsHealthScore),
        fetch(API_ROUTES.extensionsUsage),
      ]);
      if (!healthRes.ok) throw new Error(`Health HTTP ${healthRes.status}`);
      if (!usageRes.ok) throw new Error(`Usage HTTP ${usageRes.status}`);

      const health = (await healthRes.json()) as HealthResponse;
      const usage = (await usageRes.json()) as UsageResponse;
      setData({ health, usage: usage.usage });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch extension health");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const usageByExtension = useMemo(() => {
    const map = new Map<string, ExtensionUsageSummary>();
    for (const item of data?.usage ?? []) {
      map.set(usageKey(item.extensionType, item.extensionId), item);
    }
    return map;
  }, [data?.usage]);

  if (loading) return <LoadingState />;
  if (error) return <EmptyState message={error} />;
  if (!data) return <EmptyState message="Extension health data is unavailable." />;

  const { health } = data;
  const expectedTotal =
    health.registry.expected.features +
    health.registry.expected.integrations +
    health.registry.expected.plugins +
    health.registry.expected.widgets;
  const registeredTotal =
    health.registry.registered.features +
    health.registry.registered.integrations +
    health.registry.registered.plugins +
    health.registry.registered.widgets;
  const errorCount = health.issues.filter((issue) => issue.level === "error").length;
  const warningCount = health.issues.length - errorCount;

  return (
    <div className="space-y-6">
      <SectionHeader label="Extension Health" onRefresh={fetchData} />

      <StatStrip
        stats={[
          { label: "Health Score", value: `${health.overall}%` },
          { label: "Registered", value: `${registeredTotal}/${expectedTotal}` },
          {
            label: "Data Sources",
            value: String(
              health.registry.dataSources.integration + health.registry.dataSources.widget
            ),
          },
          { label: "Issues", value: String(health.issues.length) },
        ]}
      />

      <DebugSection>
        <DebugTable
          headers={["Extension", "Type", "Status", "Checks", "Usage", "Errors", "Issues"]}
        >
          {health.details.map((extension) => {
            const usage = usageByExtension.get(usageKey(extension.type, extension.id));
            const issues = issueCountFor(health.issues, extension.type, extension.id);
            return (
              <DebugRow key={`${extension.type}-${extension.id}`}>
                <DebugCell>
                  <div className="min-w-0">
                    <div className="truncate text-foreground">{extension.name}</div>
                    <div className="truncate text-dim text-w-xs">{extension.id}</div>
                  </div>
                </DebugCell>
                <DebugCell>
                  <DebugBadge variant="muted">{extension.type}</DebugBadge>
                </DebugCell>
                <DebugCell>
                  <DebugBadge variant={statusVariant(extension.status)}>
                    {extension.status}
                  </DebugBadge>
                </DebugCell>
                <DebugCell className="text-dim">
                  <div className="flex flex-wrap gap-1">
                    {extension.checks.map((check) => (
                      <DebugBadge key={check} variant="muted">
                        {check}
                      </DebugBadge>
                    ))}
                  </div>
                </DebugCell>
                <DebugCell className="font-mono">
                  {usage?.totalMounts.toLocaleString() ?? "0"}
                </DebugCell>
                <DebugCell className="font-mono">{usage?.totalErrors ?? 0}</DebugCell>
                <DebugCell>
                  {issues > 0 ? (
                    <DebugBadge variant="warning">{issues}</DebugBadge>
                  ) : (
                    <DebugBadge variant="success">0</DebugBadge>
                  )}
                </DebugCell>
              </DebugRow>
            );
          })}
        </DebugTable>
      </DebugSection>

      <DebugSection>
        <SectionHeader label="Registry Coverage" />
        <DebugTable headers={["Category", "Expected", "Registered"]}>
          {(["features", "integrations", "plugins", "widgets"] as const).map((category) => (
            <DebugRow key={category}>
              <DebugCell className="font-mono">{category}</DebugCell>
              <DebugCell className="font-mono">{health.registry.expected[category]}</DebugCell>
              <DebugCell className="font-mono">{health.registry.registered[category]}</DebugCell>
            </DebugRow>
          ))}
          <DebugRow>
            <DebugCell className="font-mono">integration data sources</DebugCell>
            <DebugCell className="font-mono">-</DebugCell>
            <DebugCell className="font-mono">{health.registry.dataSources.integration}</DebugCell>
          </DebugRow>
          <DebugRow>
            <DebugCell className="font-mono">widget resolvers</DebugCell>
            <DebugCell className="font-mono">-</DebugCell>
            <DebugCell className="font-mono">{health.registry.dataSources.widget}</DebugCell>
          </DebugRow>
        </DebugTable>
      </DebugSection>

      <DebugSection>
        <SectionHeader label={`Issues (${errorCount} errors, ${warningCount} warnings)`} />
        {health.issues.length === 0 ? (
          <EmptyState message="No extension registry, credential, dependency, or resolver issues detected." />
        ) : (
          <DebugTable headers={["Level", "Extension", "Code", "Message"]}>
            {health.issues.map((issue, index) => (
              <DebugRow
                key={`${issue.code}-${issue.extensionType ?? "system"}-${issue.extensionId ?? index}`}
              >
                <DebugCell>
                  <DebugBadge variant={issueVariant(issue.level)}>{issue.level}</DebugBadge>
                </DebugCell>
                <DebugCell className="font-mono">
                  {issue.extensionType && issue.extensionId
                    ? `${issue.extensionType}/${issue.extensionId}`
                    : "system"}
                </DebugCell>
                <DebugCell className="font-mono text-dim">{issue.code}</DebugCell>
                <DebugCell>{issue.message}</DebugCell>
              </DebugRow>
            ))}
          </DebugTable>
        )}
      </DebugSection>

      <DebugSection>
        <SectionHeader label="Metrics" />
        <DebugTable headers={["Extension", "Metric", "Value"]}>
          {health.details.flatMap((extension) =>
            Object.entries(extension.metrics).map(([key, value]) => (
              <DebugRow key={`${extension.type}-${extension.id}-${key}`}>
                <DebugCell className="font-mono">{`${extension.type}/${extension.id}`}</DebugCell>
                <DebugCell className="font-mono text-dim">{key}</DebugCell>
                <DebugCell className="font-mono">{formatMetricValue(value)}</DebugCell>
              </DebugRow>
            ))
          )}
        </DebugTable>
      </DebugSection>
    </div>
  );
}
