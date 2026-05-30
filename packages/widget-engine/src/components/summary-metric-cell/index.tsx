"use client";

import { cn } from "@radarboard/utils/cn";
import type { CSSProperties } from "react";

interface SummaryMetricCellProps {
  label: string;
  value: string;
  variant?: "default" | "podium-gold" | "podium-silver" | "podium-bronze";
  valueClassName?: string;
  valueStyle?: CSSProperties;
}

const VARIANT_STYLES = {
  default: {
    container: "",
    value: "text-foreground",
  },
  "podium-gold": {
    container: "bg-yellow-400/10 border-b-2 border-yellow-900/40",
    value: "text-yellow-400",
  },
  "podium-silver": {
    container: "bg-slate-400/10 border-b-2 border-slate-700/40",
    value: "text-slate-300",
  },
  "podium-bronze": {
    container: "bg-orange-400/10 border-b-2 border-orange-900/40",
    value: "text-orange-400",
  },
} as const;

export function SummaryMetricCell({
  label,
  value,
  variant = "default",
  valueClassName,
  valueStyle,
}: SummaryMetricCellProps) {
  const style = VARIANT_STYLES[variant];

  return (
    <div
      className={cn(
        "flex h-full flex-col justify-center gap-0.5 border-border border-r px-3 py-2 last:border-r-0",
        style.container
      )}
    >
      <span className="truncate font-mono @[200px]:text-w-sm text-dim text-w-xs uppercase tracking-wider">
        {label}
      </span>
      <span
        className={cn(
          "truncate font-mono font-semibold @[200px]:text-w-xl text-w-lg",
          style.value,
          valueClassName
        )}
        style={valueStyle}
      >
        {value}
      </span>
    </div>
  );
}
