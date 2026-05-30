import type { SectionConfig, WidgetTemplateConfig } from "./types";

const MAX_ITEMS_SECTION_TYPES = new Set([
  "list",
  "row-list",
  "stream-list",
  "dense-ranked-table",
  "card-list",
]);

function getNestedSectionGroups(section: SectionConfig): SectionConfig[][] {
  switch (section.type) {
    case "tabs":
      return section.tabs.map((tab) => tab.sections);
    case "stack":
    case "grid":
      return [section.sections];
    case "split":
      return [section.left ?? [], section.right];
    default:
      return [];
  }
}

function walkSections(sections: SectionConfig[], visitor: (s: SectionConfig) => boolean): boolean {
  for (const section of sections) {
    if (visitor(section)) return true;
    for (const group of getNestedSectionGroups(section)) {
      if (walkSections(group, visitor)) return true;
    }
  }
  return false;
}

export function hasMaxItemsSections(config: WidgetTemplateConfig): boolean {
  const check = (s: SectionConfig) => MAX_ITEMS_SECTION_TYPES.has(s.type);
  return (
    walkSections(config.sections, check) ||
    (config.expandedSections ? walkSections(config.expandedSections, check) : false)
  );
}

/** Find the highest `maxItems` default across all list-type sections. */
export function getDefaultMaxItems(config: WidgetTemplateConfig): number | undefined {
  let max: number | undefined;
  const collect = (s: SectionConfig) => {
    if (MAX_ITEMS_SECTION_TYPES.has(s.type) && "maxItems" in s && typeof s.maxItems === "number") {
      max = max === undefined ? s.maxItems : Math.max(max, s.maxItems);
    }
    return false;
  };
  walkSections(config.sections, collect);
  if (config.expandedSections) walkSections(config.expandedSections, collect);
  return max;
}

export function applyMaxItemsOverride(
  sections: SectionConfig[],
  maxItems: number
): SectionConfig[] {
  return sections.map((section): SectionConfig => {
    if (MAX_ITEMS_SECTION_TYPES.has(section.type)) {
      return { ...section, maxItems } as SectionConfig;
    }
    switch (section.type) {
      case "tabs":
        return {
          ...section,
          tabs: section.tabs.map((tab) => ({
            ...tab,
            sections: applyMaxItemsOverride(tab.sections, maxItems),
          })),
        };
      case "stack":
      case "grid":
        return { ...section, sections: applyMaxItemsOverride(section.sections, maxItems) };
      case "split":
        return {
          ...section,
          left: section.left ? applyMaxItemsOverride(section.left, maxItems) : undefined,
          right: applyMaxItemsOverride(section.right, maxItems),
        };
      default:
        return section;
    }
  });
}
