/**
 * @radarboard/widget-sdk — Testing utilities.
 *
 * Provides mock data generation and preview helpers for widget development.
 * Use these to test your widget with realistic data without needing a live
 * integration connection.
 *
 * @example
 * ```ts
 * import { createMockWidgetData, createWidgetPreviewStates } from "@radarboard/widget-sdk/testing";
 *
 * // Generate mock data that matches your template config
 * const data = createMockWidgetData(MY_TEMPLATE_CONFIG);
 *
 * // Generate all preview states for visual testing
 * const states = createWidgetPreviewStates(MY_TEMPLATE_CONFIG, {
 *   happy: myRealData,
 * });
 * // states.happy — your real data
 * // states.loading — { loading: true }
 * // states.error — { error: "Connection failed" }
 * // states.empty — all arrays empty, all numbers 0
 * // states.skeleton — null data (unconfigured)
 * ```
 */

import type { DataSource, SectionConfig, WidgetTemplateConfig } from "./types";

// ---------------------------------------------------------------------------
// Mock data generation
// ---------------------------------------------------------------------------

/**
 * Describes the shape of mock data generated for a data source.
 */
export interface MockDataShape {
  [field: string]: unknown;
}

/**
 * Extract all DataSource references from a section config tree.
 * Returns a map of sourceId → Set<field>.
 */
export function extractDataSources(sections: SectionConfig[]): Map<string, Set<string>> {
  const sources = new Map<string, Set<string>>();

  function addSource(ds: DataSource | undefined) {
    if (!ds) return;
    const fields = sources.get(ds.sourceId) ?? new Set();
    fields.add(ds.field);
    sources.set(ds.sourceId, fields);
  }

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: widget section traversal centralizes source extraction in one exhaustive walker
  function walkSection(section: SectionConfig) {
    switch (section.type) {
      case "kpi-row":
        for (const m of section.metrics) {
          addSource(m.source);
          addSource(m.changeSource);
          addSource(m.sparklineSource);
          addSource(m.breakdownSource);
          addSource(m.valueColorSource);
        }
        break;
      case "headline-stat":
        addSource(section.source);
        break;
      case "list":
        addSource(section.source);
        addSource(section.itemTemplate.title);
        addSource(section.itemTemplate.subtitle);
        addSource(section.itemTemplate.value);
        addSource(section.itemTemplate.timestamp);
        addSource(section.itemTemplate.badge?.label);
        break;
      case "row-list":
        addSource(section.source);
        addSource(section.itemTemplate.title);
        addSource(section.itemTemplate.subtitle);
        addSource(section.itemTemplate.badge?.label);
        addSource(section.itemTemplate.value);
        addSource(section.itemTemplate.timestamp);
        break;
      case "chart":
        addSource(section.source);
        break;
      case "card-list":
        addSource(section.source);
        addSource(section.titleSource);
        addSource(section.subtitleSource);
        addSource(section.descriptionSource);
        addSource(section.imageSource);
        addSource(section.badgeSource);
        break;
      case "table":
      case "dense-ranked-table":
        addSource(section.source);
        break;
      case "summary-quad":
        for (const slot of section.slots) {
          if (slot.kind === "metric") {
            addSource(slot.source);
            addSource(slot.changeSource);
            addSource(slot.sparklineSource);
          } else if (slot.kind === "sparkline") {
            addSource(slot.source);
          }
        }
        break;
      case "activity-chart":
        addSource(section.source);
        break;
      case "stream-list":
        break; // No static data source
      case "alert":
        addSource(section.source);
        break;
      case "overview-panel":
        addSource(section.titleSource);
        addSource(section.metricSource);
        addSource(section.badgeSource);
        addSource(section.descriptionSource);
        addSource(section.footerStart);
        addSource(section.footerEnd);
        for (const row of section.rows ?? []) {
          addSource(row.source);
        }
        break;
      case "filter-bar":
        for (const ctrl of section.controls) {
          if (ctrl.type === "select" && ctrl.optionsSource) {
            addSource(ctrl.optionsSource);
          }
        }
        break;
      case "tabs":
        for (const tab of section.tabs) {
          addSource(tab.countSource);
          for (const s of tab.sections) walkSection(s);
        }
        break;
      case "stack":
        for (const s of section.sections) walkSection(s);
        break;
      case "grid":
        for (const s of section.sections) walkSection(s);
        break;
      case "split":
        for (const s of section.left ?? []) walkSection(s);
        for (const s of section.right) walkSection(s);
        break;
      default:
        break;
    }
  }

  for (const section of sections) walkSection(section);
  return sources;
}

/**
 * Determine if a field is likely an array source (used as a list/table data source)
 * vs a scalar value.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: section tree traversal needs to inspect several nested container shapes
function isArrayField(sections: SectionConfig[], sourceId: string, field: string): boolean {
  for (const section of sections) {
    if (
      (section.type === "list" ||
        section.type === "row-list" ||
        section.type === "card-list" ||
        section.type === "table" ||
        section.type === "dense-ranked-table") &&
      section.source.sourceId === sourceId &&
      section.source.field === field
    ) {
      return true;
    }
    if (
      section.type === "chart" &&
      section.source.sourceId === sourceId &&
      section.source.field === field
    ) {
      return true;
    }
    if (section.type === "tabs") {
      for (const tab of section.tabs) {
        if (isArrayField(tab.sections, sourceId, field)) return true;
      }
    }
    if (section.type === "stack" || section.type === "grid") {
      if (isArrayField(section.sections, sourceId, field)) return true;
    }
    if (section.type === "split") {
      if (isArrayField(section.left ?? [], sourceId, field)) return true;
      if (isArrayField(section.right, sourceId, field)) return true;
    }
  }
  return false;
}

/**
 * Generate mock item data that satisfies the field references in list/table sections.
 */
function generateMockItem(
  sections: SectionConfig[],
  sourceId: string,
  listField: string,
  index: number
): Record<string, unknown> {
  const item: Record<string, unknown> = {};

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: mock field discovery mirrors the template section tree shape
  function findFieldsForList(sects: SectionConfig[]) {
    for (const section of sects) {
      if (
        (section.type === "list" || section.type === "row-list") &&
        section.source.sourceId === sourceId &&
        section.source.field === listField
      ) {
        const tpl = section.itemTemplate;
        if (tpl.title) item[tpl.title.field] = `Item ${index + 1}`;
        if (tpl.subtitle && "field" in tpl.subtitle)
          item[tpl.subtitle.field] = `Description ${index + 1}`;
        if (tpl.value && "field" in tpl.value) item[tpl.value.field] = (index + 1) * 100;
        if (tpl.timestamp && "field" in tpl.timestamp)
          item[tpl.timestamp.field] = new Date(Date.now() - index * 3600_000).toISOString();
        if (tpl.badge && "label" in tpl.badge)
          item[tpl.badge.label.field] = index % 2 === 0 ? "active" : "inactive";
      }
      if (
        section.type === "card-list" &&
        section.source.sourceId === sourceId &&
        section.source.field === listField
      ) {
        item[section.titleSource.field] = `Card ${index + 1}`;
        if (section.subtitleSource) item[section.subtitleSource.field] = `Subtitle ${index + 1}`;
        if (section.descriptionSource)
          item[section.descriptionSource.field] = `Lorem ipsum dolor sit amet.`;
      }
      if (section.type === "tabs") for (const tab of section.tabs) findFieldsForList(tab.sections);
      if (section.type === "stack" || section.type === "grid") findFieldsForList(section.sections);
      if (section.type === "split") {
        findFieldsForList(section.left ?? []);
        findFieldsForList(section.right);
      }
    }
  }

  findFieldsForList(sections);
  return item;
}

/**
 * Generate mock data that matches a WidgetTemplateConfig's data source shape.
 *
 * Analyzes the section configs to determine which fields are arrays vs scalars,
 * then generates appropriate mock data for each field.
 *
 * @param config - The widget template config to generate data for.
 * @param itemCount - Number of mock items to generate for list/table fields (default: 5).
 *
 * @example
 * ```ts
 * const mockData = createMockWidgetData(MY_TEMPLATE_CONFIG);
 * // { totalCount: 42, activeCount: 28, items: [{ title: "Item 1", ... }, ...] }
 * ```
 */
export function createMockWidgetData(
  config: WidgetTemplateConfig,
  itemCount = 5
): Record<string, MockDataShape> {
  const allSections = [...(config.sections ?? []), ...(config.expandedSections ?? [])];
  const sourceMap = extractDataSources(allSections);
  const result: Record<string, MockDataShape> = {};

  for (const [sourceId, fields] of sourceMap) {
    const data: MockDataShape = {};

    for (const field of fields) {
      if (isArrayField(allSections, sourceId, field)) {
        data[field] = Array.from({ length: itemCount }, (_, i) =>
          generateMockItem(allSections, sourceId, field, i)
        );
      } else {
        // Scalar field — generate a reasonable default
        data[field] = Math.floor(Math.random() * 1000);
      }
    }

    result[sourceId] = data;
  }

  return result;
}

/**
 * Generate empty data that matches a WidgetTemplateConfig's shape.
 * Arrays become `[]`, numbers become `0`, strings become `""`.
 */
export function createEmptyWidgetData(config: WidgetTemplateConfig): Record<string, MockDataShape> {
  const allSections = [...(config.sections ?? []), ...(config.expandedSections ?? [])];
  const sourceMap = extractDataSources(allSections);
  const result: Record<string, MockDataShape> = {};

  for (const [sourceId, fields] of sourceMap) {
    const data: MockDataShape = {};
    for (const field of fields) {
      data[field] = isArrayField(allSections, sourceId, field) ? [] : 0;
    }
    result[sourceId] = data;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Preview states
// ---------------------------------------------------------------------------

/**
 * Standard widget preview states for visual testing.
 */
export interface WidgetPreviewStates<T = Record<string, MockDataShape>> {
  /** Happy path — real or mock data. */
  happy: T;
  /** Empty state — all arrays empty, numbers 0. */
  empty: T;
  /** Loading state indicator. */
  loading: { loading: true };
  /** Error state indicator. */
  error: { error: string };
  /** Unconfigured state — null data. */
  unconfigured: { data: null };
}

/**
 * Generate all standard preview states for a widget.
 *
 * Use these to visually test your widget in every possible state —
 * happy path, empty, loading, error, and unconfigured.
 *
 * @param config - The widget template config.
 * @param overrides - Optional overrides for specific states. Pass `happy` to use real data.
 *
 * @example
 * ```ts
 * const states = createWidgetPreviewStates(MY_CONFIG, {
 *   happy: myFetchedData,
 * });
 * // Iterate over states to render previews
 * for (const [name, data] of Object.entries(states)) {
 *   console.log(`${name}:`, data);
 * }
 * ```
 */
export function createWidgetPreviewStates<T = Record<string, MockDataShape>>(
  config: WidgetTemplateConfig,
  overrides?: { happy?: T }
): WidgetPreviewStates<T> {
  return {
    happy: (overrides?.happy ?? createMockWidgetData(config)) as T,
    empty: createEmptyWidgetData(config) as T,
    loading: { loading: true },
    error: { error: "Connection failed — check your credentials" },
    unconfigured: { data: null },
  };
}
