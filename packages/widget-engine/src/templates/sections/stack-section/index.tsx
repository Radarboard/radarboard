"use client";

import { cn } from "@radarboard/utils/cn";
import type { ReactNode } from "react";
import type { ChartSectionConfig, SectionConfig, StackLayoutConfig } from "../../types";
import { getLayoutGapClass } from "../layout-utils";

interface StackSectionProps {
  config: StackLayoutConfig;
  children: ReactNode;
}

function hasFillHeightSection(sections: SectionConfig[]): boolean {
  return sections.some((s) => s.type === "chart" && (s as ChartSectionConfig).fillHeight === true);
}

export function StackSection({ config, children }: StackSectionProps) {
  const shouldFill = hasFillHeightSection(config.sections);
  return (
    <div
      className={cn(
        "flex min-h-0 flex-col",
        shouldFill && "h-full flex-1",
        getLayoutGapClass(config.gap)
      )}
    >
      {children}
    </div>
  );
}
