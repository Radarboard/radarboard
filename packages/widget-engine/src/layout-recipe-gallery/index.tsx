import type { LayoutDefinition } from "@radarboard/types/database";
import { Badge } from "@radarboard/ui/badge";
import { cn } from "@radarboard/utils/cn";
import {
  BASIC_3X3,
  BASIC_4X3,
  BASIC_4X4,
  generateGridTemplateAreas,
  getCellRect,
  getGridAreaName,
  getLayoutDimensions,
  getSortedCells,
  resolveColSizes,
  resolveRowSizes,
  sizesToGridTemplate,
} from "@radarboard/widget-engine/layouts";

export type LayoutRecipeMode = "split" | "structure" | "preview";

type PlaceholderKind =
  | "hero"
  | "kpi"
  | "list"
  | "chart"
  | "stream"
  | "detail"
  | "rail"
  | "tabs"
  | "grid";

interface LayoutRecipeSlot {
  cellId: string;
  title: string;
  subtitle: string;
  kind: PlaceholderKind;
}

export interface LayoutRecipeDescriptor {
  id: string;
  name: string;
  family: string;
  description: string;
  layout: LayoutDefinition;
  showTicker?: boolean;
  slots: LayoutRecipeSlot[];
}

const layoutRecipes: LayoutRecipeDescriptor[] = [
  {
    id: "basic-3x3",
    name: "Basic 3x3",
    family: "comparison-grid",
    description: "Balanced dashboard grid for broad monitoring across equal-priority widgets.",
    layout: BASIC_3X3,
    showTicker: true,
    slots: [
      { cellId: "cell-1", title: "Revenue", subtitle: "Headline KPI", kind: "kpi" },
      { cellId: "cell-2", title: "Sessions", subtitle: "Trend chart", kind: "chart" },
      { cellId: "cell-3", title: "Alerts", subtitle: "Triage queue", kind: "list" },
      { cellId: "cell-4", title: "Search", subtitle: "Acquisition", kind: "chart" },
      { cellId: "cell-5", title: "Builds", subtitle: "Release health", kind: "stream" },
      { cellId: "cell-6", title: "Support", subtitle: "Recent issues", kind: "list" },
      { cellId: "cell-7", title: "SEO", subtitle: "Query momentum", kind: "chart" },
      { cellId: "cell-8", title: "Reviews", subtitle: "Sentiment pulse", kind: "detail" },
      { cellId: "cell-9", title: "Domains", subtitle: "Status edges", kind: "stream" },
    ],
  },
  {
    id: "hero-focus",
    name: "Hero Focus",
    family: "summary-content",
    description: "Big primary story with supporting tiles for context and follow-up actions.",
    showTicker: true,
    layout: {
      id: "hero-focus",
      name: "Hero Focus",
      cells: [
        { id: "hero", rowStart: 0, colStart: 0, rowSpan: 2, colSpan: 2 },
        { id: "side-a", rowStart: 0, colStart: 2, rowSpan: 1, colSpan: 1 },
        { id: "side-b", rowStart: 1, colStart: 2, rowSpan: 1, colSpan: 1 },
        { id: "foot-a", rowStart: 2, colStart: 0, rowSpan: 1, colSpan: 1 },
        { id: "foot-b", rowStart: 2, colStart: 1, rowSpan: 1, colSpan: 1 },
        { id: "foot-c", rowStart: 2, colStart: 2, rowSpan: 1, colSpan: 1 },
      ],
      colSizes: [40, 32, 28],
      rowSizes: [34, 33, 33],
    },
    slots: [
      {
        cellId: "hero",
        title: "Release Narrative",
        subtitle: "Primary insight panel",
        kind: "hero",
      },
      { cellId: "side-a", title: "Conversion", subtitle: "Compact KPI", kind: "kpi" },
      { cellId: "side-b", title: "Incidents", subtitle: "Escalations", kind: "list" },
      { cellId: "foot-a", title: "Traffic", subtitle: "Trendline", kind: "chart" },
      { cellId: "foot-b", title: "Comments", subtitle: "Recent feedback", kind: "stream" },
      { cellId: "foot-c", title: "Owner", subtitle: "Action summary", kind: "detail" },
    ],
  },
  {
    id: "rail-workbench",
    name: "Rail Workbench",
    family: "rail-content",
    description: "Left rail for orientation, large center for analysis, bottom stack for workflow.",
    layout: {
      id: "rail-workbench",
      name: "Rail Workbench",
      cells: [
        { id: "rail", rowStart: 0, colStart: 0, rowSpan: 3, colSpan: 1 },
        { id: "main", rowStart: 0, colStart: 1, rowSpan: 2, colSpan: 2 },
        { id: "queue", rowStart: 2, colStart: 1, rowSpan: 1, colSpan: 1 },
        { id: "detail", rowStart: 2, colStart: 2, rowSpan: 1, colSpan: 1 },
      ],
      colSizes: [22, 46, 32],
      rowSizes: [35, 35, 30],
    },
    slots: [
      { cellId: "rail", title: "Context Rail", subtitle: "Filters + summary", kind: "rail" },
      { cellId: "main", title: "Main Analysis", subtitle: "Chart + narrative", kind: "hero" },
      { cellId: "queue", title: "Triage Queue", subtitle: "Ranked work", kind: "list" },
      { cellId: "detail", title: "Selected Detail", subtitle: "Side panel", kind: "detail" },
    ],
  },
  {
    id: "summary-band",
    name: "Summary Band",
    family: "summary-chart-list",
    description: "Top KPI strip with a deeper analytical region below it.",
    layout: {
      id: "summary-band",
      name: "Summary Band",
      cells: [
        { id: "sum-1", rowStart: 0, colStart: 0, rowSpan: 1, colSpan: 1 },
        { id: "sum-2", rowStart: 0, colStart: 1, rowSpan: 1, colSpan: 1 },
        { id: "sum-3", rowStart: 0, colStart: 2, rowSpan: 1, colSpan: 1 },
        { id: "main", rowStart: 1, colStart: 0, rowSpan: 2, colSpan: 2 },
        { id: "side-top", rowStart: 1, colStart: 2, rowSpan: 1, colSpan: 1 },
        { id: "side-bottom", rowStart: 2, colStart: 2, rowSpan: 1, colSpan: 1 },
      ],
      colSizes: [33, 33, 34],
      rowSizes: [22, 39, 39],
    },
    slots: [
      { cellId: "sum-1", title: "MRR", subtitle: "Headline", kind: "kpi" },
      { cellId: "sum-2", title: "Churn", subtitle: "Risk metric", kind: "kpi" },
      { cellId: "sum-3", title: "Trials", subtitle: "Funnel entry", kind: "kpi" },
      {
        cellId: "main",
        title: "Performance Curve",
        subtitle: "Primary chart surface",
        kind: "chart",
      },
      { cellId: "side-top", title: "Anomalies", subtitle: "Alerts", kind: "list" },
      { cellId: "side-bottom", title: "Narrative", subtitle: "Context detail", kind: "detail" },
    ],
  },
  {
    id: "summary-only-kpis",
    name: "Summary Only",
    family: "summary-only",
    description: "Pure KPI surface for executive snapshots and compact top-line reporting.",
    layout: {
      id: "summary-only-kpis",
      name: "Summary Only",
      cells: [
        { id: "kpi-1", rowStart: 0, colStart: 0, rowSpan: 1, colSpan: 1 },
        { id: "kpi-2", rowStart: 0, colStart: 1, rowSpan: 1, colSpan: 1 },
        { id: "kpi-3", rowStart: 0, colStart: 2, rowSpan: 1, colSpan: 1 },
        { id: "kpi-4", rowStart: 0, colStart: 3, rowSpan: 1, colSpan: 1 },
      ],
      colSizes: [25, 25, 25, 25],
      rowSizes: [100],
    },
    slots: [
      { cellId: "kpi-1", title: "Revenue", subtitle: "Primary KPI", kind: "kpi" },
      { cellId: "kpi-2", title: "Growth", subtitle: "Trend KPI", kind: "kpi" },
      { cellId: "kpi-3", title: "Customers", subtitle: "Audience KPI", kind: "kpi" },
      { cellId: "kpi-4", title: "Retention", subtitle: "Health KPI", kind: "kpi" },
    ],
  },
  {
    id: "content-only-stream",
    name: "Content Only Stream",
    family: "content-only",
    description: "Single immersive body surface for logs, feeds, queues, or real-time streams.",
    layout: {
      id: "content-only-stream",
      name: "Content Only Stream",
      cells: [{ id: "stream", rowStart: 0, colStart: 0, rowSpan: 1, colSpan: 1 }],
      colSizes: [100],
      rowSizes: [100],
    },
    slots: [{ cellId: "stream", title: "Event Stream", subtitle: "Primary body", kind: "stream" }],
  },
  {
    id: "summary-list-monitor",
    name: "Summary + List",
    family: "summary-list",
    description: "Metric header with one dominant ranked list or queue below it.",
    layout: {
      id: "summary-list-monitor",
      name: "Summary + List",
      cells: [
        { id: "top-1", rowStart: 0, colStart: 0, rowSpan: 1, colSpan: 1 },
        { id: "top-2", rowStart: 0, colStart: 1, rowSpan: 1, colSpan: 1 },
        { id: "list", rowStart: 1, colStart: 0, rowSpan: 2, colSpan: 2 },
      ],
      colSizes: [50, 50],
      rowSizes: [24, 38, 38],
    },
    slots: [
      { cellId: "top-1", title: "Errors", subtitle: "Summary", kind: "kpi" },
      { cellId: "top-2", title: "Resolved", subtitle: "Summary", kind: "kpi" },
      { cellId: "list", title: "Priority Queue", subtitle: "Main list", kind: "list" },
    ],
  },
  {
    id: "rail-list-monitor",
    name: "Rail + List",
    family: "rail-list",
    description: "A compact context rail that supports one main list body.",
    layout: {
      id: "rail-list-monitor",
      name: "Rail + List",
      cells: [
        { id: "rail", rowStart: 0, colStart: 0, rowSpan: 2, colSpan: 1 },
        { id: "list", rowStart: 0, colStart: 1, rowSpan: 2, colSpan: 2 },
      ],
      colSizes: [24, 38, 38],
      rowSizes: [50, 50],
    },
    slots: [
      { cellId: "rail", title: "Issue Context", subtitle: "Rail summary", kind: "rail" },
      { cellId: "list", title: "Issue List", subtitle: "Main body", kind: "list" },
    ],
  },
  {
    id: "summary-content-tabs",
    name: "Summary + Tabs",
    family: "summary-content-tabs",
    description: "Metric summary with a tabbed content surface for mutually exclusive modes.",
    layout: {
      id: "summary-content-tabs",
      name: "Summary + Tabs",
      cells: [
        { id: "kpi-a", rowStart: 0, colStart: 0, rowSpan: 1, colSpan: 1 },
        { id: "kpi-b", rowStart: 0, colStart: 1, rowSpan: 1, colSpan: 1 },
        { id: "tabs", rowStart: 1, colStart: 0, rowSpan: 2, colSpan: 2 },
      ],
      colSizes: [50, 50],
      rowSizes: [22, 39, 39],
    },
    slots: [
      { cellId: "kpi-a", title: "Checks Up", subtitle: "Summary", kind: "kpi" },
      { cellId: "kpi-b", title: "Incidents", subtitle: "Summary", kind: "kpi" },
      { cellId: "tabs", title: "Checks / Incidents", subtitle: "Tabbed body", kind: "tabs" },
    ],
  },
  {
    id: "card-grid-library",
    name: "Card Grid Library",
    family: "grid-cards",
    description: "Parallel card collection for content libraries, bookmarks, or curated items.",
    layout: {
      id: "card-grid-library",
      name: "Card Grid Library",
      cells: [
        { id: "card-1", rowStart: 0, colStart: 0, rowSpan: 1, colSpan: 1 },
        { id: "card-2", rowStart: 0, colStart: 1, rowSpan: 1, colSpan: 1 },
        { id: "card-3", rowStart: 0, colStart: 2, rowSpan: 1, colSpan: 1 },
        { id: "card-4", rowStart: 1, colStart: 0, rowSpan: 1, colSpan: 1 },
        { id: "card-5", rowStart: 1, colStart: 1, rowSpan: 1, colSpan: 1 },
        { id: "card-6", rowStart: 1, colStart: 2, rowSpan: 1, colSpan: 1 },
      ],
      colSizes: [33.33, 33.33, 33.34],
      rowSizes: [50, 50],
    },
    slots: [
      { cellId: "card-1", title: "Card One", subtitle: "Grid card", kind: "grid" },
      { cellId: "card-2", title: "Card Two", subtitle: "Grid card", kind: "grid" },
      { cellId: "card-3", title: "Card Three", subtitle: "Grid card", kind: "grid" },
      { cellId: "card-4", title: "Card Four", subtitle: "Grid card", kind: "grid" },
      { cellId: "card-5", title: "Card Five", subtitle: "Grid card", kind: "grid" },
      { cellId: "card-6", title: "Card Six", subtitle: "Grid card", kind: "grid" },
    ],
  },
  {
    id: "basic-4x3",
    name: "Basic 4x3",
    family: "comparison-grid",
    description: "Wider dashboard grid with 12 equal cells for comprehensive monitoring.",
    layout: BASIC_4X3,
    showTicker: true,
    slots: [
      { cellId: "cell-1", title: "Revenue", subtitle: "Headline KPI", kind: "kpi" },
      { cellId: "cell-2", title: "Sessions", subtitle: "Trend chart", kind: "chart" },
      { cellId: "cell-3", title: "Errors", subtitle: "Triage queue", kind: "list" },
      { cellId: "cell-4", title: "Search", subtitle: "Acquisition", kind: "chart" },
      { cellId: "cell-5", title: "Builds", subtitle: "Release health", kind: "stream" },
      { cellId: "cell-6", title: "Support", subtitle: "Recent issues", kind: "list" },
      { cellId: "cell-7", title: "SEO", subtitle: "Query momentum", kind: "chart" },
      { cellId: "cell-8", title: "Reviews", subtitle: "Sentiment pulse", kind: "detail" },
      { cellId: "cell-9", title: "Domains", subtitle: "Status edges", kind: "stream" },
      { cellId: "cell-10", title: "Downloads", subtitle: "Package metrics", kind: "kpi" },
      { cellId: "cell-11", title: "Deploys", subtitle: "Deploy cadence", kind: "stream" },
      { cellId: "cell-12", title: "Stars", subtitle: "Community growth", kind: "chart" },
    ],
  },
  {
    id: "basic-4x4",
    name: "Basic 4x4",
    family: "comparison-grid",
    description: "Full 16-cell dashboard grid for maximum visibility across all metrics.",
    layout: BASIC_4X4,
    showTicker: true,
    slots: [
      { cellId: "cell-1", title: "Revenue", subtitle: "Headline KPI", kind: "kpi" },
      { cellId: "cell-2", title: "Sessions", subtitle: "Trend chart", kind: "chart" },
      { cellId: "cell-3", title: "Errors", subtitle: "Triage queue", kind: "list" },
      { cellId: "cell-4", title: "Search", subtitle: "Acquisition", kind: "chart" },
      { cellId: "cell-5", title: "Builds", subtitle: "Release health", kind: "stream" },
      { cellId: "cell-6", title: "Support", subtitle: "Recent issues", kind: "list" },
      { cellId: "cell-7", title: "SEO", subtitle: "Query momentum", kind: "chart" },
      { cellId: "cell-8", title: "Reviews", subtitle: "Sentiment pulse", kind: "detail" },
      { cellId: "cell-9", title: "Domains", subtitle: "Status edges", kind: "stream" },
      { cellId: "cell-10", title: "Downloads", subtitle: "Package metrics", kind: "kpi" },
      { cellId: "cell-11", title: "Deploys", subtitle: "Deploy cadence", kind: "stream" },
      { cellId: "cell-12", title: "Stars", subtitle: "Community growth", kind: "chart" },
      { cellId: "cell-13", title: "Commits", subtitle: "Activity stream", kind: "stream" },
      { cellId: "cell-14", title: "PRs", subtitle: "Review queue", kind: "list" },
      { cellId: "cell-15", title: "Shipping", subtitle: "Release log", kind: "detail" },
      { cellId: "cell-16", title: "Bookmarks", subtitle: "Curated links", kind: "grid" },
    ],
  },
];

function placeholderChrome(kind: PlaceholderKind) {
  switch (kind) {
    case "hero":
      return (
        <div className="space-y-3">
          <div className="h-3 w-24 rounded-full bg-white/15" />
          <div className="space-y-2">
            <div className="h-8 w-4/5 rounded-item bg-white/10" />
            <div className="h-8 w-2/3 rounded-item bg-white/5" />
          </div>
          <div className="grid grid-cols-3 gap-2 pt-2">
            <div className="h-18 rounded-item bg-white/8" />
            <div className="h-18 rounded-item bg-white/8" />
            <div className="h-18 rounded-item bg-white/8" />
          </div>
        </div>
      );
    case "chart":
      return (
        <div className="space-y-3">
          <div className="h-24 rounded-item border border-white/10 bg-secondary" />
          <div className="grid grid-cols-4 gap-2">
            {["w-10", "w-16", "w-12", "w-8"].map((width) => (
              <div key={width} className={cn("h-2 rounded-full bg-white/10", width)} />
            ))}
          </div>
        </div>
      );
    case "list": {
      const listWidths = ["100%", "92%", "78%", "84%"] as const;
      return (
        <div className="space-y-2">
          {listWidths.map((width) => (
            <div
              key={width}
              className="flex items-center justify-between rounded-item border border-white/8 bg-white/4 px-3 py-2"
            >
              <div className="h-2.5 rounded-full bg-white/10" style={{ width }} />
              <div className="ml-3 h-2.5 w-10 rounded-full bg-white/5" />
            </div>
          ))}
        </div>
      );
    }
    case "stream": {
      const streamPlaceholders = [
        "stream-1",
        "stream-2",
        "stream-3",
        "stream-4",
        "stream-5",
      ] as const;
      return (
        <div className="space-y-2">
          {streamPlaceholders.map((placeholderId) => (
            <div
              key={placeholderId}
              className="flex items-center gap-2 rounded-item bg-white/4 px-2 py-1.5"
            >
              <div className="h-2 w-2 rounded-full bg-success" />
              <div className="h-2.5 flex-1 rounded-full bg-white/10" />
            </div>
          ))}
        </div>
      );
    }
    case "detail":
      return (
        <div className="space-y-3">
          <div className="h-16 rounded-item border border-white/8 bg-white/5" />
          <div className="space-y-2">
            <div className="h-2.5 w-full rounded-full bg-white/10" />
            <div className="h-2.5 w-4/5 rounded-full bg-white/10" />
            <div className="h-2.5 w-3/5 rounded-full bg-white/5" />
          </div>
        </div>
      );
    case "rail": {
      const railPlaceholders = ["rail-1", "rail-2", "rail-3", "rail-4"] as const;
      return (
        <div className="space-y-3">
          <div className="h-16 rounded-item border border-white/8 bg-white/6" />
          <div className="space-y-2">
            {railPlaceholders.map((placeholderId) => (
              <div key={placeholderId} className="h-7 rounded-item bg-white/5" />
            ))}
          </div>
        </div>
      );
    }
    case "tabs":
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-1 border-white/10 border-b pb-2">
            <div className="rounded-item bg-white/10 px-2 py-1 font-mono text-w-sm uppercase">
              Checks
            </div>
            <div className="rounded-item px-2 py-1 font-mono text-w-sm text-white/45 uppercase">
              Incidents
            </div>
            <div className="rounded-item px-2 py-1 font-mono text-w-sm text-white/45 uppercase">
              History
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-8 rounded-item bg-white/8" />
            <div className="h-8 rounded-item bg-white/6" />
            <div className="h-8 rounded-item bg-white/6" />
          </div>
        </div>
      );
    case "grid":
      return (
        <div className="space-y-3">
          <div className="h-14 rounded-item bg-white/8" />
          <div className="h-2.5 w-5/6 rounded-full bg-white/10" />
          <div className="h-2.5 w-2/3 rounded-full bg-white/6" />
        </div>
      );
    default:
      return (
        <div className="space-y-3">
          <div className="h-3 w-18 rounded-full bg-white/15" />
          <div className="h-9 w-3/4 rounded-item bg-white/8" />
          <div className="h-2.5 w-1/2 rounded-full bg-white/10" />
        </div>
      );
  }
}

function buildRecipeGridStyle(layout: LayoutDefinition, showTicker: boolean) {
  const { colCount } = getLayoutDimensions(layout);
  const areas = generateGridTemplateAreas(layout);
  const tickerArea = `"${Array.from({ length: colCount }, () => "ticker").join(" ")}"`;

  return {
    gridTemplateColumns: sizesToGridTemplate(resolveColSizes(layout)),
    gridTemplateRows: showTicker
      ? `${sizesToGridTemplate(resolveRowSizes(layout))} auto`
      : sizesToGridTemplate(resolveRowSizes(layout)),
    gridTemplateAreas: showTicker ? `${areas} ${tickerArea}` : areas,
  };
}

export function LayoutRecipeGrid({ recipe }: { recipe: LayoutRecipeDescriptor }) {
  return (
    <div
      className="grid aspect-[1.35/1] gap-1 overflow-hidden border border-border bg-secondary"
      style={buildRecipeGridStyle(recipe.layout, recipe.showTicker ?? false)}
    >
      {getSortedCells(recipe.layout.cells).map((cell) => (
        <div
          key={cell.id}
          className="border border-border bg-surface"
          style={{ gridArea: getGridAreaName(cell.id) }}
        />
      ))}
      {recipe.showTicker ? (
        <div className="border-border border-t bg-surface" style={{ gridArea: "ticker" }} />
      ) : null}
    </div>
  );
}

function StructurePreview({ recipe }: { recipe: LayoutRecipeDescriptor }) {
  return (
    <div className="relative aspect-[1.35/1] rounded-item border border-border bg-surface">
      {recipe.layout.cells.map((cell) => {
        const rect = getCellRect(recipe.layout, cell);
        return (
          <div
            key={cell.id}
            className="absolute overflow-hidden border border-white/25 border-dashed bg-white/[0.04] p-2"
            style={{
              left: `${rect.leftPct}%`,
              top: `${rect.topPct}%`,
              width: `${rect.widthPct}%`,
              height: `${rect.heightPct}%`,
            }}
          >
            <div className="font-mono text-dim text-w-sm uppercase tracking-[0.18em]">
              {cell.id}
            </div>
            <div className="mt-2 font-mono text-w-sm text-white/80">
              {cell.colSpan}c x {cell.rowSpan}r
            </div>
          </div>
        );
      })}
      {recipe.showTicker ? (
        <div className="absolute right-0 bottom-0 left-0 h-8 border-white/10 border-t bg-black/60 px-2 py-1 font-mono text-dim text-w-sm uppercase tracking-[0.18em]">
          ticker
        </div>
      ) : null}
    </div>
  );
}

function LayoutPreview({ recipe }: { recipe: LayoutRecipeDescriptor }) {
  const gridStyle = buildRecipeGridStyle(recipe.layout, recipe.showTicker ?? false);
  const slots = new Map(recipe.slots.map((slot) => [slot.cellId, slot]));

  return (
    <div
      className="grid aspect-[1.35/1] gap-1.5 overflow-hidden rounded-item border border-border bg-secondary"
      style={gridStyle}
    >
      {getSortedCells(recipe.layout.cells).map((cell) => {
        const slot = slots.get(cell.id);
        return (
          <div
            key={cell.id}
            className="flex flex-col justify-between bg-surface px-3 py-3"
            style={{ gridArea: getGridAreaName(cell.id) }}
          >
            <div className="mb-3">
              <div className="font-mono text-dim text-w-sm uppercase tracking-[0.18em]">
                {slot?.subtitle ?? "Widget"}
              </div>
              <div className="mt-1 text-w-base text-white">{slot?.title ?? cell.id}</div>
            </div>
            {placeholderChrome(slot?.kind ?? "kpi")}
          </div>
        );
      })}
      {recipe.showTicker ? (
        <div
          className="flex items-center gap-2 bg-black/70 px-3 py-2"
          style={{ gridArea: "ticker" }}
        >
          <Badge variant="default">Ticker</Badge>
          <div className="h-2.5 w-28 rounded-full bg-white/10" />
          <div className="h-2.5 w-36 rounded-full bg-white/10" />
        </div>
      ) : null}
    </div>
  );
}

export function LayoutRecipeGallery({
  mode = "split",
  recipes = layoutRecipes,
}: {
  mode?: LayoutRecipeMode;
  recipes?: LayoutRecipeDescriptor[];
}) {
  return (
    <div className="space-y-4">
      <div className="max-w-3xl space-y-2">
        <div className="font-mono text-dim text-w-sm uppercase tracking-[0.24em]">
          Widget Layout Recipes
        </div>
        <p className="text-foreground-secondary text-w-sm leading-6">
          Real layout definitions shown both as structure grammar and as populated widget previews.
          Use this gallery to decide which dashboard recipes feel intentional before wiring real
          data.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {recipes.map((recipe) => (
          <article key={recipe.id} className="border border-border bg-surface">
            <div className="border-border border-b px-4 py-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-mono text-dim text-w-sm uppercase tracking-[0.18em]">
                    Recipe
                  </div>
                  <h3 className="mt-1 text-foreground text-lg">{recipe.name}</h3>
                  <div className="mt-2">
                    <Badge variant="default">{recipe.family}</Badge>
                  </div>
                </div>
                <Badge variant="project" color="var(--color-accent)">
                  {recipe.layout.cells.length} cells
                </Badge>
              </div>
              <p className="mt-2 max-w-[52ch] text-foreground-secondary text-w-sm leading-6">
                {recipe.description}
              </p>
            </div>

            <div className="grid gap-4 p-4">
              {mode !== "preview" ? (
                <div className={cn(mode === "split" ? "space-y-2" : "space-y-3")}>
                  <div className="font-mono text-dim text-w-sm uppercase tracking-[0.18em]">
                    Structure
                  </div>
                  <StructurePreview recipe={recipe} />
                </div>
              ) : null}

              {mode !== "structure" ? (
                <div className={cn(mode === "split" ? "space-y-2" : "space-y-3")}>
                  <div className="font-mono text-dim text-w-sm uppercase tracking-[0.18em]">
                    Preview
                  </div>
                  <LayoutPreview recipe={recipe} />
                </div>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export const LAYOUT_RECIPES = layoutRecipes;
