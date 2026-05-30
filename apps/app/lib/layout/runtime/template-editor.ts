import {
  buildTemplateRecipe,
  type DataSource,
  getTemplateRecipeBuckets,
  inferTemplateRecipe,
  normalizeTemplateRecipeKind,
  type SectionConfig,
  synchronizeTemplateConfig,
  type TemplateRecipeKind,
  type TemplateRecipeModel,
  type TemplateSectionBucket,
  type WidgetTemplateConfig,
} from "@radarboard/widget-engine/templates";

export type { TemplateRecipeKind, TemplateRecipeModel, TemplateSectionBucket };
export { buildTemplateRecipe, getTemplateRecipeBuckets, inferTemplateRecipe };

export type EditableSectionType =
  | "activity-chart"
  | "alert"
  | "grid"
  | "headline-stat"
  | "kpi-row"
  | "overview-panel"
  | "summary-quad"
  | "filter-bar"
  | "list"
  | "row-list"
  | "stream-list"
  | "dense-ranked-table"
  | "table"
  | "chart"
  | "tabs";

export interface TemplateSectionBinding {
  id: string;
  label: string;
  source: DataSource;
}

function createDataSource(sourceId = "source", field: string): DataSource {
  return { sourceId, field };
}

function optionalBinding(
  id: string,
  label: string,
  source: DataSource | undefined
): TemplateSectionBinding[] {
  return source ? [{ id, label, source }] : [];
}

function updateListBinding(
  section: Extract<SectionConfig, { type: "list" }>,
  bindingId: string,
  nextSource: DataSource
): Extract<SectionConfig, { type: "list" }> {
  if (bindingId === "source") return { ...section, source: nextSource };
  if (bindingId === "itemTemplate.title") {
    return { ...section, itemTemplate: { ...section.itemTemplate, title: nextSource } };
  }
  if (bindingId === "itemTemplate.subtitle") {
    return { ...section, itemTemplate: { ...section.itemTemplate, subtitle: nextSource } };
  }
  if (bindingId === "itemTemplate.value") {
    return { ...section, itemTemplate: { ...section.itemTemplate, value: nextSource } };
  }
  if (bindingId === "itemTemplate.timestamp") {
    return { ...section, itemTemplate: { ...section.itemTemplate, timestamp: nextSource } };
  }
  if (bindingId === "itemTemplate.status") {
    return { ...section, itemTemplate: { ...section.itemTemplate, status: nextSource } };
  }
  if (bindingId === "itemTemplate.badge.label") {
    return {
      ...section,
      itemTemplate: {
        ...section.itemTemplate,
        badge: { ...section.itemTemplate.badge, label: nextSource },
      },
    };
  }
  if (bindingId === "itemTemplate.badge.color") {
    const existingBadge = section.itemTemplate.badge;
    return {
      ...section,
      itemTemplate: {
        ...section.itemTemplate,
        badge: { label: existingBadge?.label ?? nextSource, ...existingBadge, color: nextSource },
      },
    };
  }
  if (bindingId === "hrefSource") return { ...section, hrefSource: nextSource };
  return section;
}

function updateRowListBinding(
  section: Extract<SectionConfig, { type: "row-list" }>,
  bindingId: string,
  nextSource: DataSource
): Extract<SectionConfig, { type: "row-list" }> {
  if (bindingId === "source") return { ...section, source: nextSource };
  if (bindingId === "itemTemplate.title") {
    return { ...section, itemTemplate: { ...section.itemTemplate, title: nextSource } };
  }
  if (bindingId === "itemTemplate.subtitle") {
    return { ...section, itemTemplate: { ...section.itemTemplate, subtitle: nextSource } };
  }
  if (bindingId === "itemTemplate.value") {
    return { ...section, itemTemplate: { ...section.itemTemplate, value: nextSource } };
  }
  if (bindingId === "itemTemplate.timestamp") {
    return { ...section, itemTemplate: { ...section.itemTemplate, timestamp: nextSource } };
  }
  if (bindingId === "itemTemplate.status.source") {
    return {
      ...section,
      itemTemplate: {
        ...section.itemTemplate,
        status: { ...section.itemTemplate.status, source: nextSource },
      },
    };
  }
  if (bindingId === "itemTemplate.badge.label") {
    return {
      ...section,
      itemTemplate: {
        ...section.itemTemplate,
        badge: { ...section.itemTemplate.badge, label: nextSource },
      },
    };
  }
  if (bindingId === "itemTemplate.badge.color") {
    const existingBadge = section.itemTemplate.badge;
    return {
      ...section,
      itemTemplate: {
        ...section.itemTemplate,
        badge: { label: existingBadge?.label ?? nextSource, ...existingBadge, color: nextSource },
      },
    };
  }
  if (bindingId === "hrefSource") return { ...section, hrefSource: nextSource };
  return section;
}

function updateKpiBinding(
  section: Extract<SectionConfig, { type: "kpi-row" }>,
  bindingId: string,
  nextSource: DataSource
): Extract<SectionConfig, { type: "kpi-row" }> {
  return {
    ...section,
    metrics: section.metrics.map((metric, index) => {
      if (!bindingId.startsWith(`metrics.${index}.`)) return metric;
      if (bindingId.endsWith(".source")) return { ...metric, source: nextSource };
      if (bindingId.endsWith(".changeSource")) return { ...metric, changeSource: nextSource };
      if (bindingId.endsWith(".sparklineSource")) return { ...metric, sparklineSource: nextSource };
      if (bindingId.endsWith(".breakdownSource")) return { ...metric, breakdownSource: nextSource };
      return metric;
    }),
  };
}

function getSummaryQuadBindings(
  section: Extract<SectionConfig, { type: "summary-quad" }>
): TemplateSectionBinding[] {
  return section.slots.flatMap((slot, index) => {
    if (slot.kind === "empty") return [];

    if (slot.kind === "sparkline") {
      return [{ id: `slots.${index}.source`, label: `${slot.label} data`, source: slot.source }];
    }

    return [
      { id: `slots.${index}.source`, label: `${slot.label} value`, source: slot.source },
      ...optionalBinding(`slots.${index}.subtitle`, `${slot.label} subtitle`, slot.subtitle),
      ...optionalBinding(
        `slots.${index}.footerStart`,
        `${slot.label} footer start`,
        slot.footerStart
      ),
      ...optionalBinding(`slots.${index}.footerEnd`, `${slot.label} footer end`, slot.footerEnd),
      ...optionalBinding(
        `slots.${index}.footerColor`,
        `${slot.label} footer color`,
        slot.footerColor
      ),
      ...optionalBinding(`slots.${index}.changeSource`, `${slot.label} change`, slot.changeSource),
      ...optionalBinding(
        `slots.${index}.sparklineSource`,
        `${slot.label} sparkline`,
        slot.sparklineSource
      ),
      ...optionalBinding(
        `slots.${index}.breakdownSource`,
        `${slot.label} breakdown`,
        slot.breakdownSource
      ),
    ];
  });
}

function updateSummaryQuadSlotBinding(
  slot: Extract<SectionConfig, { type: "summary-quad" }>["slots"][number],
  bindingId: string,
  nextSource: DataSource
) {
  if (slot.kind === "empty") return slot;
  if (bindingId.endsWith(".source")) return { ...slot, source: nextSource };
  if (slot.kind === "sparkline") return slot;
  if (bindingId.endsWith(".subtitle")) return { ...slot, subtitle: nextSource };
  if (bindingId.endsWith(".footerStart")) return { ...slot, footerStart: nextSource };
  if (bindingId.endsWith(".footerEnd")) return { ...slot, footerEnd: nextSource };
  if (bindingId.endsWith(".footerColor")) return { ...slot, footerColor: nextSource };
  if (bindingId.endsWith(".changeSource")) return { ...slot, changeSource: nextSource };
  if (bindingId.endsWith(".sparklineSource")) return { ...slot, sparklineSource: nextSource };
  if (bindingId.endsWith(".breakdownSource")) return { ...slot, breakdownSource: nextSource };
  return slot;
}

function updateSummaryQuadBinding(
  section: Extract<SectionConfig, { type: "summary-quad" }>,
  bindingId: string,
  nextSource: DataSource
): Extract<SectionConfig, { type: "summary-quad" }> {
  return {
    ...section,
    slots: section.slots.map((slot, index) => {
      if (!bindingId.startsWith(`slots.${index}.`)) return slot;
      return updateSummaryQuadSlotBinding(slot, bindingId, nextSource);
    }) as typeof section.slots,
  };
}

export function createTemplateSection(
  type: EditableSectionType,
  sourceId = "source"
): SectionConfig {
  switch (type) {
    case "alert":
      return {
        type: "alert",
        severity: "info",
        message: "Add alert message",
      };
    case "activity-chart":
      return {
        type: "activity-chart",
        source: createDataSource(sourceId, "buckets"),
        segments: [
          { key: "ok", color: "#3fb950" },
          { key: "warning", color: "#f5c542" },
          { key: "error", color: "#e63946" },
        ],
      };
    case "headline-stat":
      return {
        type: "headline-stat",
        source: createDataSource(sourceId, "value"),
        label: "Metric",
      };
    case "overview-panel":
      return {
        type: "overview-panel",
        eyebrow: "Overview",
        title: "Title",
        metricLabel: "Primary Metric",
        metricSource: { ...createDataSource(sourceId, "value"), format: "number" },
        badgeSource: createDataSource(sourceId, "status"),
        descriptionSource: createDataSource(sourceId, "description"),
        rows: [{ label: "Meta", source: createDataSource(sourceId, "meta") }],
      };
    case "kpi-row":
      return {
        type: "kpi-row",
        columns: 1,
        metrics: [
          {
            label: "Metric",
            source: { ...createDataSource(sourceId, "value"), format: "number" },
          },
        ],
      };
    case "summary-quad":
      return {
        type: "summary-quad",
        slots: [
          {
            kind: "metric",
            label: "Metric 1",
            source: { ...createDataSource(sourceId, "value"), format: "number" },
          },
          {
            kind: "metric",
            label: "Metric 2",
            source: { ...createDataSource(sourceId, "value"), format: "number" },
          },
          {
            kind: "metric",
            label: "Metric 3",
            source: { ...createDataSource(sourceId, "value"), format: "number" },
          },
          {
            kind: "metric",
            label: "Metric 4",
            source: { ...createDataSource(sourceId, "value"), format: "number" },
          },
        ],
      };
    case "list":
      return {
        type: "list",
        source: createDataSource(sourceId, "items"),
        itemTemplate: {
          title: createDataSource(sourceId, "label"),
          subtitle: createDataSource(sourceId, "meta"),
        },
      };
    case "filter-bar":
      return {
        type: "filter-bar",
        stateId: "filters",
        controls: [],
      };
    case "row-list":
      return {
        type: "row-list",
        source: createDataSource(sourceId, "items"),
        itemTemplate: {
          title: createDataSource(sourceId, "label"),
          subtitle: createDataSource(sourceId, "meta"),
        },
      };
    case "stream-list":
      return {
        type: "stream-list",
        variant: "compact",
        defaultLevel: "debug",
        maxItems: 100,
        autoScroll: true,
      };
    case "dense-ranked-table":
      return {
        type: "dense-ranked-table",
        source: createDataSource(sourceId, "items"),
        variant: "compact",
        columns: [],
      };
    case "table":
      return {
        type: "table",
        source: createDataSource(sourceId, "rows"),
        columns: [{ key: "label", header: "Label" }],
      };
    case "chart":
      return {
        type: "chart",
        variant: "line",
        source: createDataSource(sourceId, "series"),
        xKey: "label",
        yKey: "value",
        height: 180,
      };
    case "grid":
      return {
        type: "grid",
        columns: 2,
        sections: [createTemplateSection("list", sourceId)],
      };
    case "tabs":
      return {
        type: "tabs",
        tabs: [
          {
            id: "tab-1",
            label: "Tab 1",
            sections: [createTemplateSection("list", sourceId)],
          },
        ],
      };
    default:
      throw new Error(`Unexpected section type: ${type satisfies never}`);
  }
}

export function getTemplateSectionLabel(section: SectionConfig): string {
  switch (section.type) {
    case "headline-stat":
      return `Headline: ${section.label}`;
    case "overview-panel":
      return section.title ? `Overview: ${section.title}` : "Overview Panel";
    case "kpi-row":
      return `KPI Row (${section.metrics.length})`;
    case "summary-quad":
      return "Summary Quad";
    case "filter-bar":
      return `Filter Bar (${section.controls.length})`;
    case "list":
      return section.layout === "inline" ? "Inline List" : "List";
    case "row-list":
      return "Row List";
    case "stream-list":
      return "Stream List";
    case "dense-ranked-table":
      return `Dense Ranked Table (${section.columns.length})`;
    case "table":
      return `Table (${section.columns.length} cols)`;
    case "card-list":
      return `Card List (${section.meta?.length ?? 0} meta)`;
    case "chart":
      return `${section.variant} Chart`;
    case "activity-chart":
      return `Activity Chart (${section.segments.length})`;
    case "alert":
      return `${section.severity} Alert`;
    case "tabs":
      return `Tabs (${section.tabs.length})`;
    case "stack":
      return "Stack Layout";
    case "grid":
      return "Grid Layout";
    case "split":
      return "Split Layout";
    default:
      return (section as { type: string }).type;
  }
}

/** Build a stable key for a source reference, tolerating missing/malformed sources. */
function sourceKey(source: { sourceId?: string; field?: string } | undefined): string {
  return `${source?.sourceId ?? "?"}:${source?.field ?? "?"}`;
}

export function getTemplateSectionKey(section: SectionConfig): string {
  switch (section.type) {
    case "headline-stat":
      return `${section.type}:${section.label}:${sourceKey(section.source)}`;
    case "overview-panel":
      return `${section.type}:${section.title ?? "overview"}:${section.metricLabel ?? "metric"}`;
    case "kpi-row":
      return `${section.type}:${section.metrics.map((metric) => metric.label).join(",")}`;
    case "summary-quad":
      return `${section.type}:${section.slots.map((slot) => slot.kind).join(",")}`;
    case "filter-bar":
      return `${section.type}:${section.stateId}:${section.controls.length}`;
    case "list":
    case "row-list":
      return `${section.type}:${sourceKey(section.source)}`;
    case "dense-ranked-table":
      return `${section.type}:${sourceKey(section.source)}:${section.columns.map((column) => column.key).join(",")}`;
    case "stream-list":
      return `${section.type}:${section.variant ?? "compact"}:${section.defaultLevel ?? "debug"}:${section.maxItems ?? 100}`;
    case "table":
      return `${section.type}:${sourceKey(section.source)}:${section.columns.map((column) => column.key).join(",")}`;
    case "card-list":
      return `${section.type}:${sourceKey(section.source)}`;
    case "chart":
      return `${section.type}:${section.variant}:${sourceKey(section.source)}`;
    case "alert":
      return `${section.type}:${section.severity}:${section.message}`;
    case "tabs":
      return `${section.type}:${section.tabs.map((tab) => tab.id).join(",")}`;
    case "stack":
      return `${section.type}:${section.sections.length}`;
    case "grid":
      return `${section.type}:${section.columns}:${section.sections.length}`;
    case "split":
      return `${section.type}:${section.left?.length ?? 0}:${section.right.length}`;
    case "activity-chart":
      return `${section.type}:${sourceKey(section.source)}`;
    default:
      return (section as { type: string }).type;
  }
}

export function getTemplateSectionBindings(section: SectionConfig): TemplateSectionBinding[] {
  switch (section.type) {
    case "headline-stat":
      return [{ id: "source", label: "Value", source: section.source }];
    case "overview-panel":
      return [
        ...optionalBinding("titleSource", "Title", section.titleSource),
        ...optionalBinding("metricSource", "Metric", section.metricSource),
        ...optionalBinding("badgeSource", "Badge", section.badgeSource),
        ...optionalBinding("descriptionSource", "Description", section.descriptionSource),
        ...optionalBinding("footerStart", "Footer Start", section.footerStart),
        ...optionalBinding("footerEnd", "Footer End", section.footerEnd),
        ...(section.rows ?? []).flatMap((row, index) => [
          {
            id: `rows.${index}.source`,
            label: `${row.label} value`,
            source: row.source,
          },
        ]),
      ];
    case "kpi-row":
      return section.metrics.flatMap((metric, index) => [
        {
          id: `metrics.${index}.source`,
          label: `${metric.label} value`,
          source: metric.source,
        },
        ...optionalBinding(
          `metrics.${index}.changeSource`,
          `${metric.label} change`,
          metric.changeSource
        ),
        ...optionalBinding(
          `metrics.${index}.sparklineSource`,
          `${metric.label} sparkline`,
          metric.sparklineSource
        ),
        ...optionalBinding(
          `metrics.${index}.breakdownSource`,
          `${metric.label} breakdown`,
          metric.breakdownSource
        ),
      ]);
    case "summary-quad":
      return getSummaryQuadBindings(section);
    case "filter-bar":
      return [];
    case "list":
      return [
        { id: "source", label: "Items", source: section.source },
        { id: "itemTemplate.title", label: "Title", source: section.itemTemplate.title },
        ...optionalBinding("itemTemplate.subtitle", "Subtitle", section.itemTemplate.subtitle),
        ...optionalBinding("itemTemplate.value", "Value", section.itemTemplate.value),
        ...optionalBinding("itemTemplate.timestamp", "Timestamp", section.itemTemplate.timestamp),
        ...optionalBinding("itemTemplate.status", "Status", section.itemTemplate.status),
        ...optionalBinding(
          "itemTemplate.badge.label",
          "Badge Label",
          section.itemTemplate.badge?.label
        ),
        ...optionalBinding(
          "itemTemplate.badge.color",
          "Badge Color",
          section.itemTemplate.badge?.color
        ),
        ...optionalBinding("hrefSource", "Link", section.hrefSource),
      ];
    case "row-list":
      return [
        { id: "source", label: "Items", source: section.source },
        { id: "itemTemplate.title", label: "Title", source: section.itemTemplate.title },
        ...optionalBinding("itemTemplate.subtitle", "Subtitle", section.itemTemplate.subtitle),
        ...optionalBinding("itemTemplate.value", "Value", section.itemTemplate.value),
        ...optionalBinding("itemTemplate.timestamp", "Timestamp", section.itemTemplate.timestamp),
        ...optionalBinding(
          "itemTemplate.status.source",
          "Status",
          section.itemTemplate.status?.source
        ),
        ...optionalBinding(
          "itemTemplate.badge.label",
          "Badge Label",
          section.itemTemplate.badge?.label
        ),
        ...optionalBinding(
          "itemTemplate.badge.color",
          "Badge Color",
          section.itemTemplate.badge?.color
        ),
        ...optionalBinding("hrefSource", "Link", section.hrefSource),
      ];
    case "stream-list":
      return [];
    case "dense-ranked-table":
      return [{ id: "source", label: "Items", source: section.source }];
    case "table":
      return [{ id: "source", label: "Rows", source: section.source }];
    case "card-list":
      return [
        { id: "source", label: "Items", source: section.source },
        { id: "titleSource", label: "Title", source: section.titleSource },
        ...optionalBinding("subtitleSource", "Subtitle", section.subtitleSource),
        ...optionalBinding("descriptionSource", "Description", section.descriptionSource),
        ...optionalBinding("imageSource", "Image", section.imageSource),
        ...optionalBinding("badgeSource", "Badge", section.badgeSource),
        ...optionalBinding("selection.source", "Selection Source", section.selection?.source),
        ...(section.meta ?? []).map((meta, index) => ({
          id: `meta.${index}.source`,
          label: `${meta.label} Meta`,
          source: meta.source,
        })),
        ...optionalBinding("hrefSource", "Link", section.hrefSource),
      ];
    case "chart":
      return [{ id: "source", label: "Series", source: section.source }];
    case "activity-chart":
      return [{ id: "source", label: "Buckets", source: section.source }];
    case "alert":
      return [
        ...(section.source
          ? [{ id: "source", label: "Message Source", source: section.source }]
          : []),
        ...(section.condition
          ? [
              {
                id: "condition.source",
                label: "Condition Source",
                source: section.condition.source,
              },
            ]
          : []),
      ];
    case "tabs":
    case "stack":
    case "grid":
    case "split":
      return [];
    default:
      return [];
  }
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: centralized binding updates keep section-edit semantics in one place across all supported template primitives
export function updateTemplateSectionBinding(
  section: SectionConfig,
  bindingId: string,
  nextSource: DataSource
): SectionConfig {
  const updateSingleSourceSection = <
    TSection extends Extract<
      SectionConfig,
      | { type: "headline-stat" }
      | { type: "dense-ranked-table" }
      | { type: "table" }
      | { type: "chart" }
      | { type: "activity-chart" }
    >,
  >(
    target: TSection
  ) => (bindingId === "source" ? { ...target, source: nextSource } : target);

  switch (section.type) {
    case "headline-stat":
      return updateSingleSourceSection(section);
    case "kpi-row":
      return updateKpiBinding(section, bindingId, nextSource);
    case "summary-quad":
      return updateSummaryQuadBinding(section, bindingId, nextSource);
    case "overview-panel":
      if (bindingId === "titleSource") return { ...section, titleSource: nextSource };
      if (bindingId === "metricSource") return { ...section, metricSource: nextSource };
      if (bindingId === "badgeSource") return { ...section, badgeSource: nextSource };
      if (bindingId === "descriptionSource") return { ...section, descriptionSource: nextSource };
      if (bindingId === "footerStart") return { ...section, footerStart: nextSource };
      if (bindingId === "footerEnd") return { ...section, footerEnd: nextSource };
      if (bindingId.startsWith("rows.")) {
        const [, indexToken, field] = bindingId.split(".");
        const rowIndex = Number(indexToken);
        if (Number.isNaN(rowIndex) || field !== "source") return section;
        return {
          ...section,
          rows: (section.rows ?? []).map((row, index) =>
            index === rowIndex ? { ...row, source: nextSource } : row
          ),
        };
      }
      return section;
    case "filter-bar":
      return section;
    case "list":
      return updateListBinding(section, bindingId, nextSource);
    case "row-list":
      return updateRowListBinding(section, bindingId, nextSource);
    case "stream-list":
      return section;
    case "dense-ranked-table":
      return updateSingleSourceSection(section);
    case "table":
      return updateSingleSourceSection(section);
    case "card-list":
      if (bindingId === "source") return { ...section, source: nextSource };
      if (bindingId === "titleSource") return { ...section, titleSource: nextSource };
      if (bindingId === "subtitleSource") return { ...section, subtitleSource: nextSource };
      if (bindingId === "descriptionSource") return { ...section, descriptionSource: nextSource };
      if (bindingId === "imageSource") return { ...section, imageSource: nextSource };
      if (bindingId === "badgeSource") return { ...section, badgeSource: nextSource };
      if (bindingId === "hrefSource") return { ...section, hrefSource: nextSource };
      if (bindingId === "selection.source" && section.selection) {
        return {
          ...section,
          selection: { ...section.selection, source: nextSource },
        };
      }
      if (bindingId.startsWith("meta.")) {
        const [, indexToken, field] = bindingId.split(".");
        const metaIndex = Number(indexToken);
        if (Number.isNaN(metaIndex) || field !== "source") return section;
        return {
          ...section,
          meta: (section.meta ?? []).map((meta, index) =>
            index === metaIndex ? { ...meta, source: nextSource } : meta
          ),
        };
      }
      return section;
    case "chart":
      return updateSingleSourceSection(section);
    case "activity-chart":
      return updateSingleSourceSection(section);
    case "alert":
      if (bindingId === "source") return { ...section, source: nextSource };
      if (bindingId === "condition.source" && section.condition) {
        return {
          ...section,
          condition: { ...section.condition, source: nextSource },
        };
      }
      return section;
    case "tabs":
    case "stack":
    case "grid":
    case "split":
      return section;
    default:
      return section;
  }
}

export function resolveTemplateConfig(config: WidgetTemplateConfig): WidgetTemplateConfig {
  return synchronizeTemplateConfig(config);
}

export function resolveTemplateRecipeModel(
  config: WidgetTemplateConfig,
  scope: "compact" | "expanded"
): TemplateRecipeModel | null {
  const normalized = synchronizeTemplateConfig(config);
  const recipe =
    scope === "expanded"
      ? (normalized.expandedRecipe ??
        inferTemplateRecipe(normalized.expandedSections ?? normalized.sections))
      : (normalized.recipe ?? inferTemplateRecipe(normalized.sections));

  return recipe ? { ...recipe, kind: normalizeTemplateRecipeKind(recipe.kind) } : null;
}

export function resolveTemplateSections(
  config: WidgetTemplateConfig,
  scope: "compact" | "expanded"
): SectionConfig[] {
  const normalized = synchronizeTemplateConfig(config);
  return scope === "expanded"
    ? (normalized.expandedSections ?? normalized.sections)
    : normalized.sections;
}
