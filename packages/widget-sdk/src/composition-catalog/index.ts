import type { CanonicalTemplateRecipeKind, TemplateSectionBucket } from "../recipe-model";
import { TEMPLATE_CONFIG_VERSION } from "../recipe-model";
import type { CardListSectionConfig, SectionConfig, WidgetTemplateConfig } from "../types";

export type LayoutNodeKind = "stack" | "grid" | "tabs" | "split";

/** Capability tag describing what a layout node or section primitive can do. */
export type CompositionCapability =
  | "badge"
  | "breakdown"
  | "chart"
  | "compact-inline"
  | "dense-ranking"
  | "detail-dialog"
  | "filter-controls"
  | "grid-cards"
  | "hero-metric"
  | "image"
  | "live-stream"
  | "meta-rows"
  | "nested-layout"
  | "search"
  | "selection"
  | "sorting"
  | "status"
  | "tabs"
  | "timestamp";

/** Describes a layout node in the composition catalog with usage guidance. */
export interface LayoutNodeDescriptor {
  kind: LayoutNodeKind;
  useWhen: string[];
  avoidWhen?: string[];
  constraints?: string[];
}

/** Describes a recipe kind in the composition catalog with its buckets and usage guidance. */
export interface RecipeDescriptor {
  kind: CanonicalTemplateRecipeKind;
  label: string;
  buckets: TemplateSectionBucket[];
  useWhen: string[];
  avoidWhen?: string[];
  goodFits: string[];
  typicalSections: string[];
}

/** Describes a section primitive in the composition catalog with its capabilities. */
export interface PrimitiveDescriptor {
  kind: SectionConfig["type"];
  label: string;
  category: "summary" | "content" | "control" | "layout";
  useWhen: string[];
  avoidWhen?: string[];
  capabilities: CompositionCapability[];
}

/** Describes a composition pattern that should be avoided, with rationale. */
export interface CompositionAntiPattern {
  id: string;
  label: string;
  why: string;
}

/** Describes an example widget composition with its full config for reference. */
export interface CompositionExample {
  id: string;
  title: string;
  recipeKind: CanonicalTemplateRecipeKind;
  notes: string[];
  config: WidgetTemplateConfig;
}

const summaryListExample: WidgetTemplateConfig = {
  version: TEMPLATE_CONFIG_VERSION,
  dataSources: [{ id: "example.analytics" }],
  recipe: {
    kind: "summary_list",
    summary: [
      {
        type: "headline-stat",
        source: { sourceId: "example.analytics", field: "liveVisitors", format: "number" },
        label: "live visitors",
      },
      {
        type: "kpi-row",
        columns: 2,
        metrics: [
          {
            label: "Sessions",
            source: { sourceId: "example.analytics", field: "sessions", format: "number" },
          },
          {
            label: "Pages",
            source: { sourceId: "example.analytics", field: "pages", format: "number" },
          },
        ],
      },
    ],
    rail: [],
    content: [
      {
        type: "list",
        source: { sourceId: "example.analytics", field: "topPages" },
        layout: "inline",
        itemTemplate: {
          title: { sourceId: "example.analytics", field: "path" },
          value: { sourceId: "example.analytics", field: "sessions", format: "number" },
        },
      },
    ],
  },
  sections: [],
};

const summaryOnlyExample: WidgetTemplateConfig = {
  version: TEMPLATE_CONFIG_VERSION,
  dataSources: [{ id: "example.revenue" }],
  recipe: {
    kind: "summary_only",
    summary: [
      {
        type: "summary-quad",
        slots: [
          {
            kind: "metric",
            label: "Revenue",
            source: { sourceId: "example.revenue", field: "revenue", format: "currency" },
          },
          {
            kind: "metric",
            label: "MRR",
            source: { sourceId: "example.revenue", field: "mrr", format: "currency" },
          },
          {
            kind: "metric",
            label: "Customers",
            source: { sourceId: "example.revenue", field: "customers", format: "number" },
          },
          {
            kind: "metric",
            label: "Growth",
            source: { sourceId: "example.revenue", field: "growth", format: "percent" },
          },
        ],
      },
    ],
    rail: [],
    content: [],
  },
  sections: [],
};

const contentOnlyExample: WidgetTemplateConfig = {
  version: TEMPLATE_CONFIG_VERSION,
  dataSources: [{ id: "example.logs" }],
  recipe: {
    kind: "content_only",
    summary: [],
    rail: [],
    content: [
      {
        type: "stream-list",
        variant: "compact",
        defaultLevel: "info",
        maxItems: 50,
        autoScroll: true,
      },
    ],
  },
  sections: [],
};

const summaryChartListExample: WidgetTemplateConfig = {
  version: TEMPLATE_CONFIG_VERSION,
  dataSources: [{ id: "example.analytics" }],
  recipe: {
    kind: "summary_chart_list",
    summary: [
      {
        type: "headline-stat",
        source: { sourceId: "example.analytics", field: "liveVisitors", format: "number" },
        label: "live visitors",
      },
    ],
    rail: [],
    content: [
      {
        type: "chart",
        variant: "line",
        source: { sourceId: "example.analytics", field: "trend" },
        xKey: "date",
        yKey: "value",
      },
      {
        type: "list",
        source: { sourceId: "example.analytics", field: "topPages" },
        itemTemplate: {
          title: { sourceId: "example.analytics", field: "path" },
          value: { sourceId: "example.analytics", field: "sessions", format: "number" },
        },
      },
    ],
  },
  sections: [],
};

const railContentExample: WidgetTemplateConfig = {
  version: TEMPLATE_CONFIG_VERSION,
  dataSources: [{ id: "example.reviews" }],
  recipe: {
    kind: "rail_content",
    summary: [],
    railWidth: 208,
    rail: [
      {
        type: "overview-panel",
        eyebrow: "Review Pulse",
        titleSource: { sourceId: "example.reviews", field: "appName" },
        metricLabel: "Rating",
        metricSource: { sourceId: "example.reviews", field: "rating", format: "number" },
        badgeSource: { sourceId: "example.reviews", field: "risk" },
        descriptionSource: { sourceId: "example.reviews", field: "summary" },
      },
    ],
    content: [
      {
        type: "row-list",
        source: { sourceId: "example.reviews", field: "recentReviews" },
        itemTemplate: {
          title: { sourceId: "example.reviews", field: "title" },
          subtitle: { sourceId: "example.reviews", field: "reviewer" },
          value: { sourceId: "example.reviews", field: "ratingLabel" },
          timestamp: { sourceId: "example.reviews", field: "timestampLabel" },
        },
      },
    ],
  },
  sections: [],
};

const railListExample: WidgetTemplateConfig = {
  version: TEMPLATE_CONFIG_VERSION,
  dataSources: [{ id: "example.sentry" }],
  recipe: {
    kind: "rail_list",
    summary: [],
    railWidth: 192,
    rail: [
      {
        type: "headline-stat",
        source: { sourceId: "example.sentry", field: "issueCount", format: "number" },
        label: "issues",
      },
      {
        type: "chart",
        variant: "line",
        source: { sourceId: "example.sentry", field: "trend" },
        xKey: "date",
        yKey: "value",
      },
    ],
    content: [
      {
        type: "row-list",
        source: { sourceId: "example.sentry", field: "issues" },
        itemTemplate: {
          title: { sourceId: "example.sentry", field: "title" },
          subtitle: { sourceId: "example.sentry", field: "culprit" },
          value: { sourceId: "example.sentry", field: "count", format: "number" },
        },
      },
    ],
  },
  sections: [],
};

const summaryContentWithTabsExample: WidgetTemplateConfig = {
  version: TEMPLATE_CONFIG_VERSION,
  dataSources: [{ id: "example.health" }],
  recipe: {
    kind: "summary_content",
    summary: [
      {
        type: "kpi-row",
        columns: 2,
        metrics: [
          {
            label: "Up",
            source: { sourceId: "example.health", field: "upCount", format: "number" },
          },
          {
            label: "Incidents",
            source: { sourceId: "example.health", field: "incidentCount", format: "number" },
          },
        ],
      },
    ],
    rail: [],
    content: [
      {
        type: "tabs",
        defaultTab: "checks",
        tabs: [
          {
            id: "checks",
            label: "Checks",
            sections: [
              {
                type: "table",
                source: { sourceId: "example.health", field: "checks" },
                columns: [
                  { key: "name", header: "Check" },
                  { key: "status", header: "Status" },
                ],
              },
            ],
          },
          {
            id: "incidents",
            label: "Incidents",
            sections: [
              {
                type: "row-list",
                source: { sourceId: "example.health", field: "incidents" },
                itemTemplate: {
                  title: { sourceId: "example.health", field: "name" },
                  subtitle: { sourceId: "example.health", field: "cause" },
                },
              },
            ],
          },
        ],
      },
    ],
  },
  sections: [],
};

const cardListExample: CardListSectionConfig = {
  type: "card-list",
  source: { sourceId: "example.bookmarks", field: "items" },
  titleSource: { sourceId: "example.bookmarks", field: "title" },
  subtitleSource: { sourceId: "example.bookmarks", field: "domain" },
  descriptionSource: { sourceId: "example.bookmarks", field: "excerpt" },
  imageSource: { sourceId: "example.bookmarks", field: "image" },
  badgeSource: { sourceId: "example.bookmarks", field: "collection" },
  columns: 3,
  searchable: true,
};

/** Catalog of all available layout nodes (stack, grid, tabs, split). */
export const LAYOUT_NODE_CATALOG: readonly LayoutNodeDescriptor[] = [
  {
    kind: "stack",
    useWhen: [
      "Sections should read vertically in one flow.",
      "Ordering matters more than side-by-side comparison.",
    ],
  },
  {
    kind: "grid",
    useWhen: [
      "A bucket needs 2-4 parallel surfaces with comparable importance.",
      "You need nested content composition without creating a new recipe.",
    ],
    avoidWhen: ["You are trying to invent a new top-level recipe name for a domain widget."],
    constraints: ["Use inside a recipe bucket, not as a new top-level recipe."],
  },
  {
    kind: "tabs",
    useWhen: [
      "Only one content mode should be visible at a time.",
      "Modes are mutually exclusive and users switch between them.",
    ],
    constraints: ["Use inside a recipe bucket unless the recipe itself is content-only."],
  },
  {
    kind: "split",
    useWhen: ["The layout is explicitly a rail plus main content pane."],
    constraints: [
      "Allowed as the top-level structure for rail recipes.",
      "Nested split layouts are intentionally disallowed in v1.",
    ],
  },
] as const;

/** Catalog of all available recipe kinds with usage guidance and typical sections. */
export const RECIPE_CATALOG: readonly RecipeDescriptor[] = [
  {
    kind: "summary_only",
    label: "Summary Only",
    buckets: ["summary"],
    useWhen: [
      "The widget is primarily a compact metric surface.",
      "There is no primary list, table, or chart body.",
    ],
    goodFits: ["compact revenue summary", "compact sponsorship summary", "status strip widgets"],
    typicalSections: ["headline-stat", "kpi-row", "summary-quad", "overview-panel"],
  },
  {
    kind: "content_only",
    label: "Content Only",
    buckets: ["content"],
    useWhen: ["The widget is one main content surface.", "There is no meaningful summary bucket."],
    goodFits: ["logs", "bookmark lists", "simple feeds", "single-surface content widgets"],
    typicalSections: ["list", "row-list", "stream-list", "table", "tabs", "grid"],
  },
  {
    kind: "summary_content",
    label: "Summary + Content",
    buckets: ["summary", "content"],
    useWhen: [
      "There is a real summary bucket and a composed body.",
      "The content bucket needs multiple sections or nested layouts.",
    ],
    goodFits: ["stars", "health tabs", "tasks"],
    typicalSections: [
      "headline-stat",
      "kpi-row",
      "summary-quad",
      "overview-panel",
      "chart",
      "tabs",
      "table",
    ],
  },
  {
    kind: "summary_list",
    label: "Summary + List",
    buckets: ["summary", "content"],
    useWhen: ["There is a summary bucket and one primary list-like body."],
    goodFits: ["analytics compact", "SEO compact", "downloads", "notes", "RSS", "status page"],
    typicalSections: ["headline-stat", "kpi-row", "list", "row-list", "table"],
  },
  {
    kind: "summary_chart_list",
    label: "Summary + Chart + List",
    buckets: ["summary", "content"],
    useWhen: ["Both chart and list are first-class body surfaces."],
    goodFits: ["compact analytical dashboards"],
    typicalSections: ["headline-stat", "kpi-row", "chart", "list", "table"],
  },
  {
    kind: "rail_content",
    label: "Rail + Content",
    buckets: ["rail", "content"],
    useWhen: ["A narrow context rail sits beside a more complex main surface."],
    goodFits: ["review pulse", "entity profile + activity widgets"],
    typicalSections: [
      "overview-panel",
      "headline-stat",
      "summary-quad",
      "row-list",
      "table",
      "tabs",
      "grid",
    ],
  },
  {
    kind: "rail_list",
    label: "Rail + List",
    buckets: ["rail", "content"],
    useWhen: ["A compact context rail sits beside one primary list/feed/table."],
    goodFits: ["sentry issue list"],
    typicalSections: ["headline-stat", "chart", "overview-panel", "row-list", "list", "table"],
  },
] as const;

/** Catalog of all section primitives with their categories and capabilities. */
export const SECTION_PRIMITIVE_CATALOG: readonly PrimitiveDescriptor[] = [
  {
    kind: "headline-stat",
    label: "Headline Stat",
    category: "summary",
    useWhen: ["One strong metric with a label is the point of the section."],
    capabilities: ["hero-metric", "status"],
  },
  {
    kind: "overview-panel",
    label: "Overview Panel",
    category: "summary",
    useWhen: [
      "You need a metadata-rich summary block with title, metric, badge, copy, and footer.",
    ],
    capabilities: ["badge", "hero-metric", "meta-rows", "status"],
  },
  {
    kind: "kpi-row",
    label: "KPI Row",
    category: "summary",
    useWhen: ["You need 1-6 comparable compact metrics in one row."],
    capabilities: ["breakdown", "hero-metric"],
  },
  {
    kind: "summary-quad",
    label: "Summary Quad",
    category: "summary",
    useWhen: ["You need a richer 2x2 summary shell with change, sparkline, or breakdown support."],
    capabilities: ["breakdown", "chart", "hero-metric", "meta-rows"],
  },
  {
    kind: "list",
    label: "List",
    category: "content",
    useWhen: ["You need a lighter-weight stacked or inline list."],
    capabilities: ["badge", "compact-inline", "detail-dialog", "selection", "status", "timestamp"],
  },
  {
    kind: "row-list",
    label: "Row List",
    category: "content",
    useWhen: ["Each item is a two-line row with metadata, badge, value, or timestamp."],
    capabilities: ["badge", "detail-dialog", "selection", "status", "timestamp"],
  },
  {
    kind: "stream-list",
    label: "Stream List",
    category: "content",
    useWhen: ["The content is a live or chronological event stream."],
    capabilities: ["live-stream", "search", "status", "timestamp"],
  },
  {
    kind: "dense-ranked-table",
    label: "Dense Ranked Table",
    category: "content",
    useWhen: ["You need a compact analytical ranking table with richer column types."],
    capabilities: ["dense-ranking", "detail-dialog", "filter-controls", "selection", "sorting"],
  },
  {
    kind: "table",
    label: "Table",
    category: "content",
    useWhen: ["You need a generic expanded tabular view."],
    capabilities: ["detail-dialog", "search", "selection", "sorting"],
  },
  {
    kind: "card-list",
    label: "Card List",
    category: "content",
    useWhen: ["You need a grid of cards with images, metadata, and optional search."],
    capabilities: ["detail-dialog", "grid-cards", "image", "search", "selection"],
  },
  {
    kind: "chart",
    label: "Chart",
    category: "content",
    useWhen: ["You need a single straightforward line, area, bar, or sparkline chart."],
    capabilities: ["chart"],
  },
  {
    kind: "activity-chart",
    label: "Activity Chart",
    category: "content",
    useWhen: ["You need segmented activity/status buckets over time."],
    capabilities: ["chart", "status"],
  },
  {
    kind: "filter-bar",
    label: "Filter Bar",
    category: "control",
    useWhen: ["The widget needs explicit persisted controls above a dense content surface."],
    capabilities: ["filter-controls"],
  },
  {
    kind: "alert",
    label: "Alert",
    category: "control",
    useWhen: ["You need a setup, warning, info, or error callout inside the widget."],
    capabilities: ["status"],
  },
  {
    kind: "tabs",
    label: "Tabs",
    category: "layout",
    useWhen: ["You need the rendered tab control itself as part of the content surface."],
    capabilities: ["nested-layout", "tabs"],
  },
] as const;

/** List of composition anti-patterns to avoid when building widgets. */
export const COMPOSITION_ANTI_PATTERNS: readonly CompositionAntiPattern[] = [
  {
    id: "no-domain-recipes",
    label: "Do not create domain-specific recipes",
    why: "Top-level recipes should describe spatial grammar, not one widget family.",
  },
  {
    id: "no-nested-split",
    label: "Do not nest split layouts",
    why: "Nested split adds too much layout complexity for the current editor/runtime contract.",
  },
  {
    id: "no-bespoke-editors",
    label: "Do not introduce bespoke widget editors",
    why: "Editor/runtime parity depends on using the shared template editor path.",
  },
  {
    id: "no-top-level-grid-recipe",
    label: "Do not treat grid as a recipe",
    why: "Grid is a layout node used inside recipe buckets, not a top-level spatial grammar.",
  },
];

/** Example widget compositions demonstrating each recipe kind. */
export const COMPOSITION_EXAMPLES: readonly CompositionExample[] = [
  {
    id: "summary-only-kpis",
    title: "Summary-only KPI surface",
    recipeKind: "summary_only",
    notes: ["Use when the entire widget is a compact summary surface."],
    config: summaryOnlyExample,
  },
  {
    id: "summary-list-analytics",
    title: "Summary + List analytics widget",
    recipeKind: "summary_list",
    notes: ["Use when one list body sits under a small metric summary."],
    config: summaryListExample,
  },
  {
    id: "content-only-logs",
    title: "Content-only live stream",
    recipeKind: "content_only",
    notes: ["Use when there is no meaningful summary bucket."],
    config: contentOnlyExample,
  },
  {
    id: "summary-chart-list-analytics",
    title: "Summary + Chart + List analytical view",
    recipeKind: "summary_chart_list",
    notes: ["Use when both chart and list are first-class body surfaces."],
    config: summaryChartListExample,
  },
  {
    id: "rail-content-review-pulse",
    title: "Rail + content review surface",
    recipeKind: "rail_content",
    notes: ["Use when a metadata-rich rail supports a scanning content body."],
    config: railContentExample,
  },
  {
    id: "rail-list-issues",
    title: "Rail + list issue monitor",
    recipeKind: "rail_list",
    notes: ["Use when a compact context rail supports one main list."],
    config: railListExample,
  },
  {
    id: "summary-content-tabs",
    title: "Summary + tabbed content",
    recipeKind: "summary_content",
    notes: ["Use when the content body has multiple equal modes."],
    config: summaryContentWithTabsExample,
  },
];

/** Example primitive usages keyed by section type, for reference. */
export const PRIMITIVE_EXAMPLES = {
  "card-list": cardListExample,
} as const;
