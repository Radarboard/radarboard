"use client";

import { cn } from "@radarboard/utils/cn";
import type { ReactNode } from "react";
import type { SplitLayoutConfig } from "../../types";
import { getLayoutGapClass } from "../layout-utils";

interface SplitSectionProps {
  config: SplitLayoutConfig;
  leftContent: ReactNode;
  rightContent: ReactNode;
}

export function SplitSection({ config, leftContent, rightContent }: SplitSectionProps) {
  const hasLeft = (config.left?.length ?? 0) > 0;

  if (!hasLeft) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{rightContent}</div>
    );
  }

  return (
    <div
      className={cn("flex min-h-0 min-w-0 flex-1 overflow-hidden", getLayoutGapClass(config.gap))}
    >
      <div
        className={cn(
          "min-h-0 shrink-0 overflow-hidden",
          config.divider !== false && "border-border border-r"
        )}
        style={{ width: config.leftWidth ?? 192 }}
      >
        <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">{leftContent}</div>
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{rightContent}</div>
    </div>
  );
}
