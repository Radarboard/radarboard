"use client";

import { cn } from "@radarboard/utils/cn";
import type { ReactNode } from "react";
import type { GridLayoutConfig } from "../../types";
import { getGridColumnsClass, getLayoutGapClass } from "../layout-utils";

interface GridSectionProps {
  config: GridLayoutConfig;
  children: ReactNode;
}

export function GridSection({ config, children }: GridSectionProps) {
  return (
    <div
      className={cn(
        "grid min-h-0",
        getGridColumnsClass(config.columns),
        getLayoutGapClass(config.gap)
      )}
    >
      {children}
    </div>
  );
}
