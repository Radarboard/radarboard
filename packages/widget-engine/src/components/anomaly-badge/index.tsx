"use client";

import { cn } from "@radarboard/utils/cn";
import { AlertTriangle } from "lucide-react";

interface AnomalyBadgeProps {
  /** Number of anomalies detected. */
  count: number;
  /** Highest z-score among detected anomalies. */
  maxZScore?: number;
  className?: string;
}

type Severity = "warning" | "critical";

function getSeverity(count: number, maxZScore?: number): Severity {
  if (count >= 3 || (maxZScore && Math.abs(maxZScore) >= 3)) return "critical";
  return "warning";
}

const SEVERITY_CONFIG: Record<Severity, { bg: string; text: string; dot: string }> = {
  warning: {
    bg: "bg-warning/15",
    text: "text-warning",
    dot: "bg-warning",
  },
  critical: {
    bg: "bg-destructive/15",
    text: "text-destructive",
    dot: "bg-destructive",
  },
};

export function AnomalyBadge({ count, maxZScore, className }: AnomalyBadgeProps) {
  if (count === 0) return null;

  const severity = getSeverity(count, maxZScore);
  const { bg, text } = SEVERITY_CONFIG[severity];
  const label = `${count} anomal${count === 1 ? "y" : "ies"} detected${maxZScore ? ` (z=${maxZScore.toFixed(1)})` : ""}`;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-mono text-w-xs",
        bg,
        text,
        className
      )}
      title={label}
      aria-label={label}
      role="status"
    >
      <AlertTriangle className="h-2.5 w-2.5" />
      <span>{count}</span>
    </span>
  );
}

/** Export for testing. */
export { getSeverity };
