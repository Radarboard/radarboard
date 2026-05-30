import type {
  GridLayoutConfig,
  LayoutGap,
  SectionConfig,
  SplitLayoutConfig,
  StackLayoutConfig,
} from "./types";

function toSections(
  sectionOrSections: SectionConfig | SectionConfig[] | undefined
): SectionConfig[] {
  if (!sectionOrSections) return [];
  return Array.isArray(sectionOrSections) ? sectionOrSections : [sectionOrSections];
}

/** Create a vertical stack layout from sections. */
export function stackLayout(
  sections: SectionConfig[],
  options?: { gap?: LayoutGap }
): StackLayoutConfig {
  return {
    type: "stack",
    sections,
    gap: options?.gap,
  };
}

/** Create a multi-column grid layout from sections. */
export function gridLayout(
  sections: SectionConfig[],
  options: { columns: 1 | 2 | 3 | 4; gap?: LayoutGap }
): GridLayoutConfig {
  return {
    type: "grid",
    sections,
    columns: options.columns,
    gap: options.gap,
  };
}

/** Create a split layout with a left rail and right content area. */
export function splitLayout(options: {
  left?: SectionConfig[];
  right: SectionConfig[];
  leftWidth?: number;
  gap?: LayoutGap;
  divider?: boolean;
}): SplitLayoutConfig {
  return {
    type: "split",
    left: options.left,
    right: options.right,
    leftWidth: options.leftWidth,
    gap: options.gap,
    divider: options.divider,
  };
}

/** Recipe: KPI summary strip + rich content area below. */
export function createSummaryContentRecipe(config: {
  summary: SectionConfig[];
  content?: SectionConfig | SectionConfig[];
  gap?: LayoutGap;
}): SectionConfig[] {
  return [
    stackLayout([...config.summary, ...toSections(config.content)], {
      gap: config.gap,
    }),
  ];
}

/** Recipe: KPI metrics only — no content below. Good for status displays. */
export function createSummaryOnlyRecipe(config: {
  summary: SectionConfig[];
  gap?: LayoutGap;
}): SectionConfig[] {
  return createSummaryContentRecipe({
    summary: config.summary,
    gap: config.gap,
  });
}

/** Recipe: Content only — no KPI summary strip. Good for lists, tables, charts. */
export function createContentOnlyRecipe(config: {
  content: SectionConfig | SectionConfig[];
  gap?: LayoutGap;
}): SectionConfig[] {
  return [stackLayout(toSections(config.content), { gap: config.gap })];
}

/** Recipe: KPI strip + scrollable list. The most common widget pattern. */
export function createSummaryListRecipe(config: {
  summary: SectionConfig[];
  list: SectionConfig;
  gap?: LayoutGap;
}): SectionConfig[] {
  return createSummaryContentRecipe({
    summary: config.summary,
    content: config.list,
    gap: config.gap,
  });
}

/** Recipe: KPI strip + chart + scrollable list. Good for analytics dashboards. */
export function createSummaryChartListRecipe(config: {
  summary: SectionConfig[];
  chart: SectionConfig;
  list: SectionConfig;
  gap?: LayoutGap;
}): SectionConfig[] {
  return createSummaryContentRecipe({
    summary: config.summary,
    content: [config.chart, config.list],
    gap: config.gap,
  });
}

/** Recipe: Side rail + main content area. Good for detail views with navigation. */
export function createRailContentRecipe(config: {
  rail?: SectionConfig[];
  content: SectionConfig | SectionConfig[];
  railWidth?: number;
  gap?: LayoutGap;
  divider?: boolean;
}): SectionConfig[] {
  return [
    splitLayout({
      left: config.rail,
      right: toSections(config.content),
      leftWidth: config.railWidth,
      gap: config.gap,
      divider: config.divider,
    }),
  ];
}

/** Recipe: Side rail + scrollable list. Good for category browsing. */
export function createRailListRecipe(config: {
  rail?: SectionConfig[];
  list: SectionConfig;
  railWidth?: number;
  gap?: LayoutGap;
  divider?: boolean;
}): SectionConfig[] {
  return createRailContentRecipe({
    rail: config.rail,
    content: config.list,
    railWidth: config.railWidth,
    gap: config.gap,
    divider: config.divider,
  });
}

/** Recipe: Activity feed / timeline. Alias for content-only with feed semantics. */
export function createFeedListRecipe(config: {
  content: SectionConfig | SectionConfig[];
  gap?: LayoutGap;
}): SectionConfig[] {
  return createContentOnlyRecipe(config);
}
