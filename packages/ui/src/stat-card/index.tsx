"use client";

import { cn } from "@radarboard/utils/cn";
import type { ReactNode } from "react";

export interface StatCardProps {
  label: ReactNode;
  value: ReactNode;
  description?: ReactNode;
  className?: string;
  variant?: "default" | "surface";
}

export function StatCard({
  label,
  value,
  description,
  className,
  variant = "default",
}: StatCardProps) {
  return (
    <div
      className={cn(
        "flex h-full flex-col justify-center rounded-none border border-border p-3 transition-interactive",
        variant === "default" ? "bg-surface-raised" : "bg-surface",
        className
      )}
    >
      <div className="mb-1 font-mono text-dim text-w-xs uppercase tracking-widest">{label}</div>
      <div className="truncate font-bold font-mono text-foreground text-w-lg">{value}</div>
      {Boolean(description) && (
        <div className="mt-1 font-mono text-dim text-w-xs">{description}</div>
      )}
    </div>
  );
}
