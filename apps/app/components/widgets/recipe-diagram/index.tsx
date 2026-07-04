import { cn } from "@radarboard/utils/cn";
import type { RecipeRegion } from "../widget-visual-editor-model";

const BAR_IDS = ["a", "b", "c"] as const;
const CHART_BARS = [
  { id: "c1", h: 0.5 },
  { id: "c2", h: 0.8 },
  { id: "c3", h: 0.4 },
  { id: "c4", h: 1 },
  { id: "c5", h: 0.65 },
] as const;
const ROW_IDS = ["r1", "r2", "r3"] as const;

/** A tiny schematic of one region (KPI band, list, chart, content, or rail). */
function RegionGlyph({ region, active }: { region: RecipeRegion; active: boolean }) {
  const fill = active ? "bg-accent/70" : "bg-dim/60";
  const faint = active ? "bg-accent/30" : "bg-dim/30";

  if (region === "summary" || region === "rail") {
    const isRail = region === "rail";
    return (
      <div className={cn("flex flex-1 gap-0.5", isRail ? "flex-col" : "flex-row")}>
        {BAR_IDS.map((id) => (
          <div key={id} className={cn("flex-1 rounded-[1px]", fill)} />
        ))}
      </div>
    );
  }
  if (region === "chart") {
    return (
      <div className="flex flex-1 items-end gap-0.5">
        {CHART_BARS.map((bar) => (
          <div
            key={bar.id}
            className={cn("flex-1 rounded-[1px]", fill)}
            style={{ height: `${bar.h * 100}%` }}
          />
        ))}
      </div>
    );
  }
  // list or content: stacked rows (list is taller, so gets one extra row).
  const rowIds = region === "list" ? ROW_IDS : ROW_IDS.slice(0, 2);
  return (
    <div className="flex flex-1 flex-col gap-0.5">
      {rowIds.map((id, index) => (
        <div key={id} className={cn("flex-1 rounded-[1px]", index === 0 ? fill : faint)} />
      ))}
    </div>
  );
}

/** A small layout schematic for a template recipe, drawn from its regions. */
export function RecipeDiagram({
  orientation,
  regions,
  active = false,
  className,
}: {
  orientation: "stack" | "rail";
  regions: RecipeRegion[];
  active?: boolean;
  className?: string;
}) {
  if (orientation === "rail") {
    const [rail, ...rest] = regions;
    return (
      <div className={cn("flex h-8 w-11 gap-0.5 rounded-[2px] p-0.5", className)}>
        <div className="flex w-1/3">
          <RegionGlyph region={rail ?? "rail"} active={active} />
        </div>
        <div className="flex flex-1 flex-col gap-0.5">
          {rest.map((region) => (
            <RegionGlyph key={region} region={region} active={active} />
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className={cn("flex h-8 w-11 flex-col gap-0.5 rounded-[2px] p-0.5", className)}>
      {regions.map((region) => (
        <RegionGlyph key={region} region={region} active={active} />
      ))}
    </div>
  );
}
