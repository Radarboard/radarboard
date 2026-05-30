import type { PollingSourceId } from "@radarboard/types/polling";
import type {
  GridSlot,
  WidgetAuth,
  WidgetCapability,
  WidgetModalSize,
} from "@radarboard/widget-sdk/widget-types";
import type { TemplateRecipeModel } from "./recipe-model";

export type DataSourceFormat =
  | "currency"
  | "number"
  | "percent"
  | "date"
  | "relative-time"
  | "duration-seconds";

export interface DataSource {
  sourceId: string;
  field: string;
  format?: DataSourceFormat;
  precision?: number;
  compact?: boolean;
  normalize?: "none" | "compact-project";
}

export interface DataSourceDeclaration {
  id: string;
}

export type LayoutGap = "none" | "sm" | "md";

export interface AlertCondition {
  source: DataSource;
  operator: "lt" | "gt" | "eq" | "neq" | "lte" | "gte";
  value: number | string | boolean;
}

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

export interface SummaryQuadSectionConfig {
  type: "summary-quad";
  slots: [
    SummaryQuadSlotConfig,
    SummaryQuadSlotConfig,
    SummaryQuadSlotConfig,
    SummaryQuadSlotConfig,
  ];
}

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

export interface TabsSectionConfig {
  type: "tabs";
  tabs: TabConfig[];
  defaultTab?: string;
  variant?: "compact" | "expanded";
  queryParam?: string;
}

export interface StackLayoutConfig {
  type: "stack";
  sections: SectionConfig[];
  gap?: LayoutGap;
}

export interface GridLayoutConfig {
  type: "grid";
  sections: SectionConfig[];
  columns: 1 | 2 | 3 | 4;
  gap?: LayoutGap;
}

export interface SplitLayoutConfig {
  type: "split";
  left?: SectionConfig[];
  right: SectionConfig[];
  leftWidth?: number;
  gap?: LayoutGap;
  divider?: boolean;
}

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
