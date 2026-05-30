import {
  createContentOnlyRecipe,
  createRailContentRecipe,
  createRailListRecipe,
  createSummaryChartListRecipe,
  createSummaryContentRecipe,
  createSummaryListRecipe,
  createSummaryOnlyRecipe,
} from "../recipes";
import type {
  SectionConfig,
  SplitLayoutConfig,
  StackLayoutConfig,
  WidgetTemplateConfig,
} from "../types";

export const TEMPLATE_CONFIG_VERSION = 2;

export type CanonicalTemplateRecipeKind =
  | "summary_only"
  | "content_only"
  | "summary_content"
  | "summary_list"
  | "summary_chart_list"
  | "rail_content"
  | "rail_list";

export type TemplateRecipeKind = CanonicalTemplateRecipeKind | "feed_list";

export type TemplateSectionBucket = "summary" | "rail" | "content";

export interface TemplateRecipeModel {
  kind: TemplateRecipeKind;
  summary: SectionConfig[];
  content: SectionConfig[];
  rail: SectionConfig[];
  railWidth?: number;
}

const SUMMARY_SECTION_TYPES = new Set([
  "alert",
  "filter-bar",
  "headline-stat",
  "kpi-row",
  "overview-panel",
  "summary-quad",
]);

function toSectionArray(sections: SectionConfig[] | undefined): SectionConfig[] {
  return sections ? [...sections] : [];
}

function pickFirstSection(...sections: Array<SectionConfig | undefined>): SectionConfig | null {
  return sections.find((section): section is SectionConfig => section !== undefined) ?? null;
}

function isListLikeSection(section: SectionConfig | undefined): boolean {
  return section?.type === "list" || section?.type === "row-list" || section?.type === "table";
}

function isSummarySection(section: SectionConfig | undefined): boolean {
  if (!section) return false;
  return SUMMARY_SECTION_TYPES.has(section.type);
}

function countLeadingSummarySections(sections: SectionConfig[]): number {
  let count = 0;
  for (const section of sections) {
    if (!isSummarySection(section)) break;
    count += 1;
  }
  return count;
}

function inferLinearRecipe(sections: SectionConfig[]): TemplateRecipeModel | null {
  if (sections.length === 0) return null;

  if (sections.every((section) => isSummarySection(section))) {
    return {
      kind: "summary_only",
      summary: sections,
      content: [],
      rail: [],
    };
  }

  const summaryCount = countLeadingSummarySections(sections);
  if (summaryCount === 0) {
    return {
      kind: "content_only",
      summary: [],
      content: sections,
      rail: [],
    };
  }

  const summary = sections.slice(0, summaryCount);
  const content = sections.slice(summaryCount);

  if (content.length === 1 && isListLikeSection(content[0])) {
    return {
      kind: "summary_list",
      summary,
      content,
      rail: [],
    };
  }

  if (content.length === 2 && content[0]?.type === "chart" && isListLikeSection(content[1])) {
    return {
      kind: "summary_chart_list",
      summary,
      content,
      rail: [],
    };
  }

  return {
    kind: "summary_content",
    summary,
    content,
    rail: [],
  };
}

function inferFromStack(section: StackLayoutConfig): TemplateRecipeModel | null {
  return inferLinearRecipe(section.sections);
}

function inferFromSplit(section: SplitLayoutConfig): TemplateRecipeModel {
  const content = toSectionArray(section.right);
  return {
    kind: content.length === 1 && isListLikeSection(content[0]) ? "rail_list" : "rail_content",
    summary: [],
    content,
    rail: toSectionArray(section.left),
    railWidth: section.leftWidth,
  };
}

export function normalizeTemplateRecipeKind(kind: TemplateRecipeKind): CanonicalTemplateRecipeKind {
  return kind === "feed_list" ? "content_only" : kind;
}

export function normalizeTemplateRecipeModel(model: TemplateRecipeModel): TemplateRecipeModel {
  return {
    ...model,
    kind: normalizeTemplateRecipeKind(model.kind),
    summary: [...model.summary],
    content: [...model.content],
    rail: [...model.rail],
  };
}

export function inferTemplateRecipe(sections: SectionConfig[]): TemplateRecipeModel | null {
  if (sections.length === 0) return null;

  if (sections.length === 1) {
    const [section] = sections;
    if (!section) return null;

    if (section.type === "stack") {
      return inferFromStack(section);
    }

    if (section.type === "split") {
      return inferFromSplit(section);
    }
  }

  return inferLinearRecipe(sections);
}

export function buildTemplateRecipe(model: TemplateRecipeModel): SectionConfig[] {
  const normalized = normalizeTemplateRecipeModel(model);

  switch (normalized.kind) {
    case "summary_only":
      return createSummaryOnlyRecipe({
        summary: normalized.summary,
      });
    case "content_only":
      return createContentOnlyRecipe({
        content: normalized.content,
      });
    case "rail_list": {
      const list = pickFirstSection(
        normalized.content[0],
        normalized.rail[0],
        normalized.summary[0]
      );
      if (!list) {
        return createRailContentRecipe({
          rail: normalized.rail,
          content: normalized.content,
          railWidth: normalized.railWidth,
          divider: true,
        });
      }
      return createRailListRecipe({
        rail: normalized.rail,
        list,
        railWidth: normalized.railWidth,
        divider: true,
      });
    }
    case "rail_content":
      return createRailContentRecipe({
        rail: normalized.rail,
        content: normalized.content,
        railWidth: normalized.railWidth,
        divider: true,
      });
    case "summary_list": {
      const list = pickFirstSection(
        normalized.content[0],
        normalized.summary[0],
        normalized.rail[0]
      );
      if (!list) {
        return createSummaryContentRecipe({
          summary: normalized.summary,
          content: normalized.content,
        });
      }
      return createSummaryListRecipe({
        summary: normalized.summary,
        list,
      });
    }
    case "summary_chart_list": {
      const chart = pickFirstSection(
        normalized.content[0],
        normalized.summary[0],
        normalized.rail[0]
      );
      const list = pickFirstSection(
        normalized.content[1],
        normalized.content[0],
        normalized.summary[0],
        normalized.rail[0]
      );
      if (!chart || !list) {
        return createSummaryContentRecipe({
          summary: normalized.summary,
          content: normalized.content,
        });
      }
      return createSummaryChartListRecipe({
        summary: normalized.summary,
        chart,
        list,
      });
    }
    case "summary_content":
      return createSummaryContentRecipe({
        summary: normalized.summary,
        content: normalized.content,
      });
    default:
      return createSummaryContentRecipe({
        summary: normalized.summary,
        content: normalized.content,
      });
  }
}

export function getTemplateRecipeBuckets(kind: TemplateRecipeKind): TemplateSectionBucket[] {
  switch (normalizeTemplateRecipeKind(kind)) {
    case "summary_only":
      return ["summary"];
    case "content_only":
      return ["content"];
    case "summary_content":
    case "summary_list":
    case "summary_chart_list":
      return ["summary", "content"];
    case "rail_content":
    case "rail_list":
      return ["rail", "content"];
    default:
      return ["content"];
  }
}

function containsNestedLayout(section: SectionConfig): boolean {
  switch (section.type) {
    case "grid":
    case "stack":
      return section.sections.some(containsAnyLayout);
    case "tabs":
      return section.tabs.some((tab) =>
        tab.sections.some((nestedSection) => {
          if (nestedSection.type === "split") return true;
          if (nestedSection.type === "grid" || nestedSection.type === "stack") {
            return nestedSection.sections.some(containsAnyLayout);
          }
          if (nestedSection.type === "tabs") {
            return containsNestedLayout(nestedSection);
          }
          return false;
        })
      );
    case "split":
      return true;
    default:
      return false;
  }
}

function containsAnyLayout(section: SectionConfig): boolean {
  switch (section.type) {
    case "grid":
    case "split":
    case "stack":
      return true;
    case "tabs":
      return true;
    default:
      return false;
  }
}

function isAllowedNestedLayout(section: SectionConfig): boolean {
  if (section.type !== "grid" && section.type !== "stack" && section.type !== "tabs") {
    return true;
  }

  return !containsNestedLayout(section);
}

export function isTemplateRecipeModelValid(model: TemplateRecipeModel): boolean {
  const normalized = normalizeTemplateRecipeModel(model);
  const allSections = [...normalized.summary, ...normalized.rail, ...normalized.content];

  return allSections.every((section) => {
    if (section.type === "split") return false;
    return isAllowedNestedLayout(section);
  });
}

export function synchronizeTemplateConfig<T extends WidgetTemplateConfig>(config: T): T {
  const compactRecipe = config.recipe
    ? normalizeTemplateRecipeModel(config.recipe)
    : inferTemplateRecipe(config.sections);
  const getExpandedRecipe = () => {
    if (config.expandedRecipe) return normalizeTemplateRecipeModel(config.expandedRecipe);
    if (config.expandedSections) return inferTemplateRecipe(config.expandedSections);
    return undefined;
  };
  const expandedRecipe = getExpandedRecipe();

  const nextSections = compactRecipe ? buildTemplateRecipe(compactRecipe) : config.sections;
  const nextExpandedSections = expandedRecipe
    ? buildTemplateRecipe(expandedRecipe)
    : config.expandedSections;

  return {
    ...config,
    version: TEMPLATE_CONFIG_VERSION,
    recipe: compactRecipe ?? config.recipe,
    sections: nextSections,
    expandedRecipe: expandedRecipe ?? config.expandedRecipe,
    ...(nextExpandedSections ? { expandedSections: nextExpandedSections } : {}),
  };
}

export function migrateTemplateConfig<T extends WidgetTemplateConfig>(config: T): T {
  return synchronizeTemplateConfig(config);
}

export function isTemplateConfig(value: unknown): value is WidgetTemplateConfig {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<WidgetTemplateConfig>;
  return Array.isArray(candidate.dataSources) && Array.isArray(candidate.sections);
}
