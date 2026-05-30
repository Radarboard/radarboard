import type { WidgetTemplateConfig } from "@radarboard/widget-engine/templates";
import { ListTree, type LucideIcon, Rows3, Sidebar } from "lucide-react";
import {
  createTemplateSection,
  type EditableSectionType,
  type TemplateRecipeKind,
  type TemplateRecipeModel,
  type TemplateSectionBucket,
} from "@/lib/template-editor";

export const RECIPE_OPTIONS: Array<{ kind: TemplateRecipeKind; label: string; icon: LucideIcon }> =
  [
    { kind: "summary_only", label: "Summary Only", icon: Rows3 },
    { kind: "content_only", label: "Content Only", icon: ListTree },
    { kind: "summary_list", label: "Summary + List", icon: Rows3 },
    { kind: "summary_chart_list", label: "Summary + Chart + List", icon: Rows3 },
    { kind: "rail_list", label: "Rail + List", icon: Sidebar },
    { kind: "summary_content", label: "Summary + Content", icon: Rows3 },
    { kind: "rail_content", label: "Rail + Content", icon: Sidebar },
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
