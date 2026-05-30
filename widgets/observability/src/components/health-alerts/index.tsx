import type { HealthCheck } from "@radarboard/types/health";
import { cn } from "@radarboard/utils/cn";
import { AlertTriangle } from "lucide-react";

interface HealthAlertsProps {
  checks: HealthCheck[];
}

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

export function HealthAlerts({ checks }: HealthAlertsProps) {
  const downChecks = checks.filter((c) => c.status === "down");
  const hasDownServices = downChecks.length > 0;

  return (
    <div className="flex flex-col gap-0">
      {hasDownServices && (
        <div className="flex items-center gap-2 border-border border-b bg-[#1a0808] px-3 py-1.5">
          <AlertTriangle className="icon-xs text-destructive" />
          <span className="font-mono text-destructive text-w-sm uppercase">
            {downChecks.length} service{downChecks.length > 1 ? "s" : ""} down
          </span>
        </div>
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-1 px-3 py-2">
        {checks.map((check) => (
          <div key={check.id} className="flex items-center gap-1.5">
            <StatusDot status={check.status} />
            <span className="font-mono text-foreground-secondary text-w-base">{check.name}</span>
            <span className="font-mono text-dim text-w-sm">{check.responseTimeMs}ms</span>
          </div>
        ))}
      </div>
    </div>
  );
}
