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

export function createSummaryOnlyRecipe(config: {
  summary: SectionConfig[];
  gap?: LayoutGap;
}): SectionConfig[] {
  return createSummaryContentRecipe({
    summary: config.summary,
    gap: config.gap,
  });
}

export function createContentOnlyRecipe(config: {
  content: SectionConfig | SectionConfig[];
  gap?: LayoutGap;
}): SectionConfig[] {
  return [stackLayout(toSections(config.content), { gap: config.gap })];
}

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

export function createFeedListRecipe(config: {
  content: SectionConfig | SectionConfig[];
  gap?: LayoutGap;
}): SectionConfig[] {
  return createContentOnlyRecipe(config);
}
