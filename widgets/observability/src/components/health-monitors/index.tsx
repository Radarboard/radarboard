import type { HealthCheck, HealthIncident } from "@radarboard/types/health";
import { InfoRow } from "@radarboard/ui/info-row";
import { ScrollArea } from "@radarboard/ui/scroll-area";
import { cn } from "@radarboard/utils/cn";
import { InlineListHeader, InlineListRow } from "@radarboard/widget-engine/inline-list-layout";
import { AlertTriangle } from "lucide-react";

// --- Status Dot ---

function StatusDot({ status }: { status: HealthCheck["status"] }) {
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 shrink-0 rounded-full",
        status === "up" && "bg-[#4ade80]",
        status === "down" && "bg-[#e05555]",
        status === "degraded" && "bg-[#f5c542]"
      )}
    />
  );
}

// --- Time Ago ---

function formatTimeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// --- Health Monitors Widget ---

interface HealthMonitorsProps {
  checks: HealthCheck[];
  incidents: HealthIncident[];
}

export function HealthMonitors({ checks, incidents }: HealthMonitorsProps) {
  const activeIncidents = incidents.length;

  return (
    <div className="flex h-full">
      {/* Active incidents (if any) */}
      {activeIncidents > 0 && (
        <div className="flex w-56 shrink-0 flex-col border-border border-r">
          <div className="flex items-center gap-1.5 border-border border-b bg-[#1a0808] px-3 py-2">
            <AlertTriangle className="icon-xs text-destructive" />
            <span className="font-mono text-destructive text-w-sm uppercase">
              {activeIncidents} active incident{activeIncidents > 1 ? "s" : ""}
            </span>
          </div>
          <ScrollArea className="flex-1">
            {incidents.map((incident) => (
              <InfoRow
                key={incident.id}
                density="compact"
                className="py-1.5"
                subtitleClassName="mt-0.5"
                leading={<AlertTriangle className="icon-xs text-destructive" />}
                title={incident.name}
                titleClassName="text-destructive"
                subtitle={
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate font-mono text-dim text-w-sm">{incident.cause}</span>
                    <span className="shrink-0 font-mono text-dim text-w-sm">
                      {formatTimeAgo(incident.startedAt)}
                    </span>
                  </div>
                }
              />
            ))}
          </ScrollArea>
        </div>
      )}

      {/* Monitor grid */}
      <ScrollArea className="flex-1">
        <div className="flex flex-col">
          <InlineListHeader
            gridTemplateColumns="minmax(0,1fr) 72px 72px"
            columns={[
              { key: "check", label: "Check" },
              { key: "latency", label: "Latency", align: "right" },
              { key: "time", label: "Time", align: "right" },
            ]}
          />
          <div className="divide-y divide-[#222]">
            {checks.map((check) => (
              <div
                key={check.id}
                className={cn(
                  check.status === "down" && "bg-[#1a0808]",
                  check.status === "degraded" && "bg-[#1a1508]"
                )}
              >
                <InlineListRow
                  gridTemplateColumns="minmax(0,1fr) 72px 72px"
                  cells={[
                    {
                      key: "check",
                      content: (
                        <div className="flex min-w-0 items-center gap-2">
                          <StatusDot status={check.status} />
                          <span className="truncate text-foreground-secondary text-w-sm">
                            {check.name}
                          </span>
                        </div>
                      ),
                    },
                    {
                      key: "latency",
                      align: "right",
                      content: (
                        <span className="block font-mono text-dim text-w-sm">
                          {check.responseTimeMs}ms
                        </span>
                      ),
                    },
                    {
                      key: "time",
                      align: "right",
                      content: (
                        <span className="block font-mono text-dim text-w-sm">
                          {formatTimeAgo(check.lastCheckedAt)}
                        </span>
                      ),
                    },
                  ]}
                />
              </div>
            ))}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
