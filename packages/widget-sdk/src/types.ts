import type { PollingSourceId } from "@radarboard/types/polling";
import type { TemplateRecipeModel } from "./recipe-model";
import type { GridSlot, WidgetAuth, WidgetCapability, WidgetModalSize } from "./widget-types";

/**
 * How a data value should be formatted when rendered.
 *
 * - `"currency"` — locale-aware currency (e.g. $1,234.56)
 * - `"number"` — locale-aware number (e.g. 1,234)
 * - `"percent"` — percentage with % suffix
 * - `"date"` — date string
 * - `"relative-time"` — "2 hours ago" style
 * - `"duration-seconds"` — seconds → human-readable duration
 */
export type DataSourceFormat =
  | "currency"
  | "number"
  | "percent"
  | "date"
  | "relative-time"
  | "duration-seconds";

/**
 * A pointer to a field in a resolved data source.
 *
 * This is the fundamental building block of the template system. Every section
 * config uses `DataSource` to bind UI elements to data from your integration.
 *
 * @example
 * ```ts
 * // Point to the "totalRevenue" field in the "revenue" data source
 * const source: DataSource = {
 *   sourceId: "revenue",
 *   field: "totalRevenue",
 *   format: "currency",
 * };
 * ```
 */
export interface DataSource {
  sourceId: string;
  field: string;
  format?: DataSourceFormat;
  precision?: number;
  compact?: boolean;
  normalize?: "none" | "compact-project";
}

/**
 * Declares a data source ID that this widget template depends on.
 *
 * Listed in `WidgetTemplateConfig.dataSources` to register which resolvers
 * need to run before the template can render.
 */
export interface DataSourceDeclaration {
  id: string;
}

/** Gap size between sections in a layout. */
export type LayoutGap = "none" | "sm" | "md";

export interface AlertCondition {
  source: DataSource;
  operator: "lt" | "gt" | "eq" | "neq" | "lte" | "gte";
  value: number | string | boolean;
}

/** Alert/banner section — displays a warning, error, or info message. */
export interface AlertSectionConfig {
  type: "alert";
  severity: "error" | "warning" | "info" | "success" | "setup";
  message: string;
  source?: DataSource;
  condition?: AlertCondition;
  dismissible?: boolean;
  action?: { label: string; href?: string };
}

export interface KPIMetricConfig {
  label: string;
  source: DataSource;
  changeSource?: DataSource;
  sparklineSource?: DataSource;
  breakdownSource?: DataSource;
  valueColorSource?: DataSource;
  /** Optional colored dot rendered next to the label (e.g. to match a chart series). */
  color?: string;
}

/**
 * A horizontal row of KPI metric cards.
 *
 * @example
 * ```ts
 * const kpis: KPIRowSectionConfig = {
 *   type: "kpi-row",
 *   columns: 3,
 *   metrics: [
 *     { label: "MRR", source: { sourceId: "rev", field: "mrr", format: "currency" } },
 *     { label: "Subscribers", source: { sourceId: "rev", field: "count" } },
 *     { label: "Churn", source: { sourceId: "rev", field: "churnRate", format: "percent" } },
 *   ],
 * };
 * ```
 */
export interface KPIRowSectionConfig {
  type: "kpi-row";
  columns: 1 | 2 | 3 | 4 | 5 | 6;
  variant?: "default" | "compact";
  metrics: KPIMetricConfig[];
}

export interface SummaryQuadMetricSlotConfig {
  kind: "metric";
  label: string;
  source: DataSource;
  subtitle?: DataSource;
  subtitleText?: string;
  footerStart?: DataSource;
  footerEnd?: DataSource;
  footerColor?: DataSource;
  changeSource?: DataSource;
  sparklineSource?: DataSource;
  breakdownSource?: DataSource;
  tooltip?: string;
}

export interface SummaryQuadSparklineSlotConfig {
  kind: "sparkline";
  label: string;
  source: DataSource;
  emptyMessage?: string;
  positive?: boolean;
}

export interface SummaryQuadEmptySlotConfig {
  kind: "empty";
}

export type SummaryQuadSlotConfig =
  | SummaryQuadMetricSlotConfig
  | SummaryQuadSparklineSlotConfig
  | SummaryQuadEmptySlotConfig;

/** A 2x2 grid of metric slots (metric, sparkline, or empty). */
export interface SummaryQuadSectionConfig {
  type: "summary-quad";
  slots: [
    SummaryQuadSlotConfig,
    SummaryQuadSlotConfig,
    SummaryQuadSlotConfig,
    SummaryQuadSlotConfig,
  ];
}

/** A large featured number with a label — great for hero metrics. */
export interface HeadlineStatSectionConfig {
  type: "headline-stat";
  source: DataSource;
  label: string;
  indicatorColor?: string;
}

export interface OverviewPanelRowConfig {
  label: string;
  source: DataSource;
  toneSource?: DataSource;
}

/** Overview panel with eyebrow, title, metric, badge, description, and detail rows. */
export interface OverviewPanelSectionConfig {
  type: "overview-panel";
  eyebrow?: string;
  title?: string;
  titleSource?: DataSource;
  metricLabel?: string;
  metricSource?: DataSource;
  metricToneSource?: DataSource;
  badgeSource?: DataSource;
  badgeToneSource?: DataSource;
  descriptionSource?: DataSource;
  rows?: OverviewPanelRowConfig[];
  footerStart?: DataSource;
  footerEnd?: DataSource;
}

export interface ListItemTemplate {
  title: DataSource;
  subtitle?: DataSource;
  value?: DataSource;
  valueColor?: DataSource;
  timestamp?: DataSource;
  timestampColor?: DataSource;
  status?: DataSource;
  badge?: RowListBadgeConfig;
}

export interface TemplateSelectionDialogConfig {
  title?: string;
  size?: WidgetModalSize;
  resizable?: boolean;
}

export interface TemplateSelectionConfig {
  selectionId: string;
  keyField: string;
  detailRendererId: string;
  source?: DataSource;
  dialog?: TemplateSelectionDialogConfig;
}

export interface InlineListHeaderColumnConfig {
  slot: "title" | "subtitle" | "value" | "timestamp";
  label: string;
  align?: "left" | "right" | "center";
}

export interface InlineListHeaderConfig {
  title?: string;
  subtitle?: string;
  value?: string;
  timestamp?: string;
  gridTemplateColumns?: string;
  columns?: InlineListHeaderColumnConfig[];
}

/**
 * A scrollable list of items with title, subtitle, badge, and optional selection.
 *
 * @example
 * ```ts
 * const issues: ListSectionConfig = {
 *   type: "list",
 *   source: { sourceId: "github", field: "issues" },
 *   itemTemplate: {
 *     title: { sourceId: "github", field: "title" },
 *     subtitle: { sourceId: "github", field: "author" },
 *     badge: { label: { sourceId: "github", field: "state" } },
 *   },
 *   emptyMessage: "No open issues",
 * };
 * ```
 */
export interface ListSectionConfig {
  type: "list";
  source: DataSource;
  itemTemplate: ListItemTemplate;
  layout?: "stacked" | "inline";
  inlineHeader?: InlineListHeaderConfig;
  maxItems?: number;
  emptyMessage?: string;
  hrefSource?: DataSource;
  hrefTarget?: "_blank" | "_self" | "_parent" | "_top";
  selection?: TemplateSelectionConfig;
}

export interface RowListBadgeConfig {
  label: DataSource;
  color?: DataSource;
  normalize?: "none" | "compact-project";
}

export interface RowListStatusConfig {
  source: DataSource;
  display?: "dot" | "severity-icon" | "named-icon" | "favicon";
}

export interface RowListItemTemplate {
  title: DataSource;
  subtitle?: DataSource;
  badge?: RowListBadgeConfig;
  value?: DataSource;
  timestamp?: DataSource;
  timestampColor?: DataSource;
  status?: RowListStatusConfig;
}

/** Compact row list with status dots/icons, badges, and timestamps. */
export interface RowListSectionConfig {
  type: "row-list";
  source: DataSource;
  itemTemplate: RowListItemTemplate;
  maxItems?: number;
  emptyMessage?: string;
  hrefSource?: DataSource;
  hrefTarget?: "_blank" | "_self" | "_parent" | "_top";
  selection?: TemplateSelectionConfig;
}

/** Real-time event stream with log levels, search, and auto-scroll. */
export interface StreamListSectionConfig {
  type: "stream-list";
  variant?: "compact" | "expanded";
  defaultLevel?: "all" | "debug" | "info" | "warn" | "error";
  maxItems?: number;
  autoScroll?: boolean;
  defaultLive?: boolean;
  showSearch?: boolean;
  showLiveToggle?: boolean;
  emptyMessage?: string;
}

export interface FilterBarSelectControlConfig {
  type: "select";
  id: string;
  label: string;
  allLabel?: string;
  options?: Array<{ value: string; label: string }>;
  optionsSource?: DataSource;
}

export interface FilterBarRangeControlConfig {
  type: "range";
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  accentColor: string;
  format?: "number" | "rank";
}

export interface FilterBarToggleControlConfig {
  type: "toggle";
  id: string;
  label: string;
  accentColor: string;
}

export type FilterBarControlConfig =
  | FilterBarSelectControlConfig
  | FilterBarRangeControlConfig
  | FilterBarToggleControlConfig;

/** Filter bar with select, range, and toggle controls. */
export interface FilterBarSectionConfig {
  type: "filter-bar";
  stateId: string;
  persistKey?: string;
  controls: FilterBarControlConfig[];
}

export interface DenseRankedTableFilterRule {
  controlId: string;
  field: string;
  kind: "select" | "range" | "toggle";
  operator?: "neq" | "eq";
  value?: string | number | boolean;
}

export interface DenseRankedTableColumnConfig {
  key: string;
  header: string;
  variant: "rank" | "text" | "bar" | "delta" | "number" | "flag";
  field?: string;
  color?: string;
  align?: "left" | "right" | "center";
  sortable?: boolean;
  width?: number;
}

/** Dense ranked table with sorting, filtering, and compact/expanded variants. */
export interface DenseRankedTableSectionConfig {
  type: "dense-ranked-table";
  source: DataSource;
  variant?: "compact" | "expanded";
  columns: DenseRankedTableColumnConfig[];
  maxItems?: number;
  emptyMessage?: string;
  stateKey?: string;
  defaultSort?: { key: string; direction: "asc" | "desc" };
  filterStateId?: string;
  filterPersistKey?: string;
  filterRules?: DenseRankedTableFilterRule[];
  gridTemplateColumns?: string;
  selection?: TemplateSelectionConfig;
  filterPlaceholder?: string;
}

export interface TableColumnConfig {
  key: string;
  header: string;
  sortable?: boolean;
  format?: DataSource["format"];
  width?: number;
}

/** A data table with sortable columns and optional search. */
export interface TableSectionConfig {
  type: "table";
  source: DataSource;
  columns: TableColumnConfig[];
  searchable?: boolean;
  defaultSort?: { key: string; direction: "asc" | "desc" };
  emptyMessage?: string;
  selection?: TemplateSelectionConfig;
}

export interface CardListMetaConfig {
  label: string;
  source: DataSource;
}

/** A grid of cards with title, image, badge, and optional search. */
export interface CardListSectionConfig {
  type: "card-list";
  source: DataSource;
  titleSource: DataSource;
  subtitleSource?: DataSource;
  descriptionSource?: DataSource;
  imageSource?: DataSource;
  badgeSource?: DataSource;
  meta?: CardListMetaConfig[];
  columns?: 1 | 2 | 3 | 4;
  minCardWidth?: number;
  searchable?: boolean;
  filterPlaceholder?: string;
  emptyMessage?: string;
  maxItems?: number;
  selection?: TemplateSelectionConfig;
  hrefSource?: DataSource;
  hrefTarget?: "_blank" | "_self" | "_parent" | "_top";
}

export interface ChartSeriesConfig {
  dataKey: string;
  name: string;
  color?: string;
  format?: "number" | "compact" | "percent" | "decimal";
}

/**
 * A chart section — area, line, bar, or sparkline.
 *
 * @example
 * ```ts
 * const visitors: ChartSectionConfig = {
 *   type: "chart",
 *   variant: "area",
 *   source: { sourceId: "analytics", field: "dailyVisitors" },
 *   height: 200,
 *   color: "var(--chart-1)",
 * };
 * ```
 */
export interface ChartSectionConfig {
  type: "chart";
  variant: "area" | "line" | "bar" | "sparkline";
  source: DataSource;
  height?: number;
  xKey?: string;
  yKey?: string;
  color?: string;
  /** Multi-series mode: each entry maps to a Line in the chart. */
  series?: ChartSeriesConfig[];
  /** When true, normalize each series to 0-100 for geometry; tooltips show raw values. */
  normalize?: boolean;
  /** When true, the chart section grows to fill remaining parent height via flex-1. */
  fillHeight?: boolean;
}

export interface ActivityChartSegmentConfig {
  key: string;
  color: string;
}

/** GitHub-style contribution heatmap with colored segments. */
export interface ActivityChartSectionConfig {
  type: "activity-chart";
  source: DataSource;
  segments: ActivityChartSegmentConfig[];
  heightClassName?: string;
  minBarPercent?: number;
}

export interface TabConfig {
  id: string;
  label: string;
  icon?: "pull-request" | "issue";
  accentColor?: string;
  countSource?: DataSource;
  sections: SectionConfig[];
}

/** Tabbed content — switches between different section sets. */
export interface TabsSectionConfig {
  type: "tabs";
  tabs: TabConfig[];
  defaultTab?: string;
  variant?: "compact" | "expanded";
  queryParam?: string;
}

/** Vertical stack layout — sections arranged top to bottom. */
export interface StackLayoutConfig {
  type: "stack";
  sections: SectionConfig[];
  gap?: LayoutGap;
}

/** Grid layout — sections arranged in columns. */
export interface GridLayoutConfig {
  type: "grid";
  sections: SectionConfig[];
  columns: 1 | 2 | 3 | 4;
  gap?: LayoutGap;
}

/** Split layout — left rail + right content area. */
export interface SplitLayoutConfig {
  type: "split";
  left?: SectionConfig[];
  right: SectionConfig[];
  leftWidth?: number;
  gap?: LayoutGap;
  divider?: boolean;
}

/**
 * Union of all possible section types in a widget template.
 *
 * Sections are the building blocks of widget layouts. Combine them in
 * `WidgetTemplateConfig.sections` or use recipe helpers like
 * `createSummaryListRecipe()` to compose common patterns.
 */
export type SectionConfig =
  | AlertSectionConfig
  | HeadlineStatSectionConfig
  | OverviewPanelSectionConfig
  | KPIRowSectionConfig
  | SummaryQuadSectionConfig
  | ListSectionConfig
  | RowListSectionConfig
  | StreamListSectionConfig
  | FilterBarSectionConfig
  | DenseRankedTableSectionConfig
  | TableSectionConfig
  | CardListSectionConfig
  | ChartSectionConfig
  | ActivityChartSectionConfig
  | TabsSectionConfig
  | StackLayoutConfig
  | GridLayoutConfig
  | SplitLayoutConfig;

/**
 * Top-level configuration for a template-driven widget.
 *
 * This is the primary config type that widget authors define. It declares
 * which data sources to resolve and which sections to render in the compact
 * and expanded views.
 *
 * @example
 * ```ts
 * const config: WidgetTemplateConfig = {
 *   version: 1,
 *   dataSources: [{ id: "my-widget" }],
 *   sections: [
 *     kpiRow("my-widget", [{ label: "Total", field: "count" }]),
 *     list("my-widget", "items", { title: "name", subtitle: "status" }),
 *   ],
 *   expandedSections: [
 *     // Full table in expanded view
 *   ],
 * };
 * ```
 */
export interface WidgetTemplateConfig {
  version?: number;
  dataSources: DataSourceDeclaration[];
  sections: SectionConfig[];
  expandedSections?: SectionConfig[];
  recipe?: TemplateRecipeModel;
  expandedRecipe?: TemplateRecipeModel;
}

export interface CreateTemplateDescriptorOptions {
  catalogCategory?: string;
  capabilities?: WidgetCapability[];
  requiredIntegrations?: string[];
  defaultSlot?: GridSlot;
  auth?: WidgetAuth | WidgetAuth[];
  expandedSize?: WidgetModalSize;
  defaultPollInterval?: number;
  pollingSourceIds?: PollingSourceId[];
  variants?: Array<{
    id: string;
    name: string;
    config: WidgetTemplateConfig;
    isDefault?: boolean;
  }>;
}
