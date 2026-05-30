"use client";

import { cn } from "@radarboard/utils/cn";

type FreshnessStatus = "fresh" | "delayed" | "stale";

interface FreshnessIndicatorProps {
  /** Timestamp when data was last fetched (ms since epoch). */
  fetchedAt: number | null;
  /** Expected maximum age in seconds before data is considered delayed. Default: 300 (5min). */
  expectedMaxAgeSeconds?: number;
  /** When false, the indicator is hidden to avoid misleading status on unconfigured widgets. */
  configured?: boolean;
  className?: string;
}

const STATUS_CONFIG: Record<FreshnessStatus, { color: string; label: string }> = {
  fresh: { color: "bg-success-bg", label: "Data is fresh" },
  delayed: { color: "bg-warning", label: "Data may be delayed" },
  stale: { color: "bg-destructive", label: "Data is stale" },
};

function computeStatus(fetchedAt: number | null, expectedMaxAgeSeconds: number): FreshnessStatus {
  if (!fetchedAt) return "stale";
  const ageSeconds = (Date.now() - fetchedAt) / 1000;
  if (ageSeconds <= expectedMaxAgeSeconds) return "fresh";
  if (ageSeconds <= expectedMaxAgeSeconds * 2) return "delayed";
  return "stale";
}

export function FreshnessIndicator({
  fetchedAt,
  expectedMaxAgeSeconds = 300,
  configured = true,
  className,
}: FreshnessIndicatorProps) {
  if (!configured) return null; // Hide on unconfigured widgets

  const status = computeStatus(fetchedAt, expectedMaxAgeSeconds);
  const { color, label } = STATUS_CONFIG[status];

  if (status === "fresh") return null; // Don't show indicator when fresh

  return (
    <span
      className={cn("inline-block h-2 w-2 shrink-0 rounded-full", color, className)}
      title={label}
      aria-label={label}
      role="status"
    />
  );
}

/** Export for testing. */
export { computeStatus };
