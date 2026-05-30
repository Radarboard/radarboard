import { cn } from "@radarboard/utils/cn";
import type { LayoutGap } from "../types";

const GAP_CLASS: Record<LayoutGap, string> = {
  none: "gap-0",
  sm: "gap-2",
  md: "gap-3",
};

export function getLayoutGapClass(gap: LayoutGap | undefined) {
  return GAP_CLASS[gap ?? "none"];
}

export function getGridColumnsClass(columns: 1 | 2 | 3 | 4) {
  return cn(
    columns === 1 && "grid-cols-1",
    columns === 2 && "grid-cols-2",
    columns === 3 && "grid-cols-3",
    columns === 4 && "grid-cols-4"
  );
}
