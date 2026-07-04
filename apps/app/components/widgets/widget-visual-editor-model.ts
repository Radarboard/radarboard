import type { WidgetTemplateConfig } from "@radarboard/widget-engine/templates";
import {
  createTemplateSection,
  type EditableSectionType,
  type TemplateRecipeKind,
  type TemplateRecipeModel,
  type TemplateSectionBucket,
} from "@/lib/template-editor";

/** A block in a recipe's visual shape, used to draw the little layout diagram. */
export type RecipeRegion = "summary" | "list" | "chart" | "content" | "rail";

export interface RecipeOption {
  kind: TemplateRecipeKind;
  label: string;
  /** Plain-language description of what the layout looks like. */
  description: string;
  /** How the regions stack: top-to-bottom or side-by-side (rail). */
  orientation: "stack" | "rail";
  /** The regions that make up the layout, in order. */
  regions: RecipeRegion[];
  /** Marks the friendly default to nudge beginners toward. */
  recommended?: boolean;
}

export const RECIPE_OPTIONS: RecipeOption[] = [
  {
    kind: "summary_list",
    label: "Summary + List",
    description: "A row of KPI numbers on top, then a list of items below. Great all-rounder.",
    orientation: "stack",
    regions: ["summary", "list"],
    recommended: true,
  },
  {
    kind: "summary_only",
    label: "Summary Only",
    description: "Just a row of KPI numbers — no list. Best for a few headline metrics.",
    orientation: "stack",
    regions: ["summary"],
  },
  {
    kind: "content_only",
    label: "Content Only",
    description: "A single block (list, table, or chart) with no KPI row.",
    orientation: "stack",
    regions: ["content"],
  },
  {
    kind: "summary_chart_list",
    label: "Summary + Chart + List",
    description: "KPIs, then a chart, then a list — a full overview in one widget.",
    orientation: "stack",
    regions: ["summary", "chart", "list"],
  },
  {
    kind: "summary_content",
    label: "Summary + Content",
    description: "A KPI row on top with one content block below it.",
    orientation: "stack",
    regions: ["summary", "content"],
  },
  {
    kind: "rail_list",
    label: "Rail + List",
    description: "A narrow sidebar of stats beside a list.",
    orientation: "rail",
    regions: ["rail", "list"],
  },
  {
    kind: "rail_content",
    label: "Rail + Content",
    description: "A narrow sidebar of stats beside a content block.",
    orientation: "rail",
    regions: ["rail", "content"],
  },
];

export const DEFAULT_SECTION_TYPES: Record<TemplateSectionBucket, EditableSectionType> = {
  summary: "kpi-row",
  rail: "headline-stat",
  content: "list",
};

export const SECTION_TYPE_OPTIONS: EditableSectionType[] = [
  "activity-chart",
  "headline-stat",
  "overview-panel",
  "kpi-row",
  "summary-quad",
  "filter-bar",
  "grid",
  "list",
  "row-list",
  "stream-list",
  "dense-ranked-table",
  "table",
  "chart",
  "alert",
  "tabs",
];

export function bucketLabel(bucket: TemplateSectionBucket): string {
  switch (bucket) {
    case "summary":
      return "Summary";
    case "rail":
      return "Rail";
    case "content":
      return "Content";
    default:
      return bucket;
  }
}

function getLastSection(
  sections: WidgetTemplateConfig["sections"],
  fallback: EditableSectionType,
  sourceId: string
): WidgetTemplateConfig["sections"] {
  const lastSection = sections.at(-1);
  return lastSection ? [lastSection] : [createTemplateSection(fallback, sourceId)];
}

export function normalizeRecipeModel(
  model: TemplateRecipeModel,
  nextKind: TemplateRecipeKind,
  sourceId: string
): TemplateRecipeModel {
  if (nextKind === "content_only") {
    return {
      ...model,
      summary: [],
      rail: [],
      content:
        model.content.length > 0
          ? model.content.slice(-1)
          : [createTemplateSection("list", sourceId)],
    };
  }

  if (nextKind === "summary_only") {
    const summarySource = model.summary.length > 0 ? model.summary : model.content;
    return {
      ...model,
      summary:
        summarySource.length > 0
          ? summarySource
          : [createTemplateSection("headline-stat", sourceId)],
      rail: [],
      content: [],
    };
  }

  if (nextKind === "summary_list") {
    return {
      ...model,
      rail: [],
      content: getLastSection(model.content, "list", sourceId),
    };
  }

  if (nextKind === "rail_list") {
    return {
      ...model,
      summary: [],
      content: getLastSection(model.content, "row-list", sourceId),
    };
  }

  if (nextKind === "summary_chart_list") {
    const chart = model.content.find(
      (section: WidgetTemplateConfig["sections"][number]) => section.type === "chart"
    );
    const list = model.content.find(
      (section: WidgetTemplateConfig["sections"][number]) =>
        section.type === "list" || section.type === "row-list" || section.type === "table"
    );

    return {
      ...model,
      rail: [],
      content: [
        chart ?? createTemplateSection("chart", sourceId),
        list ?? createTemplateSection("list", sourceId),
      ],
    };
  }

  return model;
}
