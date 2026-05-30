"use client";

import { cn } from "@radarboard/utils/cn";
import type { ReactNode } from "react";

interface SummaryQuadShellProps {
  slots: readonly [ReactNode, ReactNode, ReactNode, ReactNode];
  className?: string;
}

export function SummaryQuadShell({ slots, className }: SummaryQuadShellProps) {
  const [first, second, third, fourth] = slots;

  return (
    <div
      className={cn(
        "grid h-full min-h-0 auto-rows-fr @[240px]:grid-cols-2 grid-cols-1 gap-px bg-secondary",
        className
      )}
    >
      <div className="h-full min-h-0">{first}</div>
      <div className="h-full min-h-0">{second}</div>
      <div className="h-full min-h-0">{third}</div>
      <div className="h-full min-h-0">{fourth}</div>
    </div>
  );
}
