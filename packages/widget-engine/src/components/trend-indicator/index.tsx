"use client";

import { cn } from "@radarboard/utils/cn";
import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";

export type TrendDirection = "up" | "down" | "flat";

interface TrendIndicatorProps {
  direction: TrendDirection;
  changePct: number;
  className?: string;
  /** Show percentage value next to arrow. Default: true. */
  showValue?: boolean;
  /** Size variant. Default: "sm". */
  size?: "xs" | "sm" | "md";
}

const DIRECTION_CONFIG = {
  up: { Icon: ArrowUp, color: "text-success", label: "Trending up" },
  down: { Icon: ArrowDown, color: "text-destructive", label: "Trending down" },
  flat: { Icon: ArrowRight, color: "text-dim", label: "Flat" },
} as const;

const SIZE_CONFIG = {
  xs: { icon: "h-2.5 w-2.5", text: "text-w-xs" },
  sm: { icon: "h-3 w-3", text: "text-w-xs" },
  md: { icon: "h-4 w-4", text: "text-w-sm" },
} as const;

export function TrendIndicator({
  direction,
  changePct,
  className,
  showValue = true,
  size = "sm",
}: TrendIndicatorProps) {
  const { Icon, color, label } = DIRECTION_CONFIG[direction];
  const sizeStyle = SIZE_CONFIG[size];
  const formattedPct = `${changePct > 0 ? "+" : ""}${changePct}%`;

  return (
    <span
      className={cn("inline-flex items-center gap-0.5 font-mono", color, className)}
      title={`${label}: ${formattedPct}`}
    >
      <Icon className={sizeStyle.icon} />
      {showValue && <span className={sizeStyle.text}>{formattedPct}</span>}
    </span>
  );
}
