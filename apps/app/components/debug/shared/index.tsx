"use client";

import { Button } from "@radarboard/ui/button";
import { StatCard } from "@radarboard/ui/stat-card";
import { cn } from "@radarboard/utils/cn";
import type React from "react";

// ---------------------------------------------------------------------------
// Reusable primitives for debug sections
// ---------------------------------------------------------------------------

/** Loading spinner / placeholder for debug section data. */
export function LoadingState() {
  return (
    <div className="flex items-center justify-center py-12 text-dim text-w-sm">Loading...</div>
  );
}

/** Section header with label and optional refresh button. */
export function SectionHeader({ label, onRefresh }: { label: string; onRefresh?: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="font-mono text-dim text-w-xs uppercase tracking-widest">{label}</h3>
      {Boolean(onRefresh) && (
        <Button
          type="button"
          variant="ghost-link"
          spacing="none"
          uppercase={false}
          onClick={onRefresh}
          className="text-dim text-w-xs"
        >
          Refresh
        </Button>
      )}
    </div>
  );
}

/** Section wrapper with consistent padding and gap. */
export function DebugSection({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("flex flex-col gap-4", className)}>{children}</div>;
}

/** Standardised stat strip for summary KPIs at the top of a section. */
export function StatStrip({ stats }: { stats: { label: string; value: string }[] }) {
  return (
    <div className={cn("grid gap-3", `grid-cols-${Math.min(stats.length, 6)}`)}>
      {stats.map((s) => (
        <StatCard key={s.label} label={s.label} value={s.value} variant="surface" />
      ))}
    </div>
  );
}

/** Table wrapper with consistent styling. */
export function DebugTable({
  headers,
  children,
}: {
  headers: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="scrollbar-thin overflow-x-auto">
      <table className="w-full border-collapse font-mono text-w-sm">
        <thead>
          <tr className="border-secondary border-b">
            {headers.map((h) => (
              <th
                key={h}
                className="whitespace-nowrap px-3 py-2 text-left text-dim text-w-sm uppercase tracking-wider"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

/** Standard table row with hover highlight. */
export function DebugRow({ children }: { children: React.ReactNode }) {
  return (
    <tr className="border-background border-b transition-colors hover:bg-muted">{children}</tr>
  );
}

/** Table cell. */
export function DebugCell({
  children,
  className,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <td className={cn("px-3 py-2", className)} title={title}>
      {children}
    </td>
  );
}

/** Utility: format duration in ms to human-readable. */
export function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/** Utility: format relative time from ISO string. */
export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/** Tag/badge pill. */
export function DebugBadge({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "accent" | "muted" | "error" | "warning" | "success";
}) {
  return (
    <span
      className={cn(
        "rounded-item px-1.5 py-0.5 font-mono text-w-sm",
        variant === "accent" && "border border-accent/20 bg-accent/10 text-accent",
        variant === "muted" && "border border-border bg-secondary text-dim",
        variant === "error" && "border border-destructive/20 bg-destructive/10 text-destructive",
        variant === "success" && "border border-success/20 bg-success/10 text-success",
        variant === "warning" && "border border-warning/20 bg-warning/10 text-warning",
        variant === "default" && "border border-border bg-secondary text-foreground-secondary"
      )}
    >
      {children}
    </span>
  );
}
