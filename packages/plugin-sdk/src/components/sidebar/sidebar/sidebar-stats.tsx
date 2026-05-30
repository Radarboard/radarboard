"use client";

import { cn } from "@radarboard/utils/cn";

export interface SidebarStatsProps {
  /** Large headline number (e.g. "60", "$249") */
  value: string;
  /** Label below the number (e.g. "Unread items", "monthly spend") */
  label: string;
  /** Optional color class for the value (e.g. "text-success") */
  valueClassName?: string;
}

/**
 * Consistent headline stat for sidebar headers.
 *
 * Used by RSS Reader (unread count), Expenses (monthly spend),
 * and similar patterns.
 *
 * ```
 * 60
 * Unread items
 * ```
 */
export function SidebarStats({ value, label, valueClassName }: SidebarStatsProps) {
  return (
    <div className="mt-1">
      <div className={cn("font-bold font-mono text-2xl text-foreground-secondary", valueClassName)}>
        {value}
      </div>
      <div className="text-dim text-w-sm">{label}</div>
    </div>
  );
}
