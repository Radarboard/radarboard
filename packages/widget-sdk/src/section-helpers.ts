/**
 * @radarboard/widget-sdk — Section helper factories.
 *
 * These functions reduce boilerplate when defining widget template sections.
 * Instead of building verbose config objects by hand, use these one-liners.
 *
 * @example
 * ```ts
 * import { kpiRow, list, chart, headlineStat } from "@radarboard/widget-sdk/section-helpers";
 *
 * const sections = [
 *   kpiRow("my-widget", [
 *     { label: "Total", field: "totalCount" },
 *     { label: "Active", field: "activeCount" },
 *   ]),
 *   chart("my-widget", "chartData", { variant: "area", height: 200 }),
 *   list("my-widget", "items", {
 *     title: "name",
 *     subtitle: "status",
 *     emptyMessage: "No items found",
 *   }),
 * ];
 * ```
 */

import type {
  AlertSectionConfig,
  CardListSectionConfig,
  ChartSectionConfig,
  DataSource,
  DataSourceFormat,
  HeadlineStatSectionConfig,
  KPIMetricConfig,
  KPIRowSectionConfig,
  ListSectionConfig,
  RowListSectionConfig,
  SectionConfig,
  SummaryQuadSectionConfig,
  SummaryQuadSlotConfig,
  TabsSectionConfig,
} from "./types";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function src(sourceId: string, field: string, format?: DataSourceFormat): DataSource {
  return format ? { sourceId, field, format } : { sourceId, field };
}

// ---------------------------------------------------------------------------
// Section factories
// ---------------------------------------------------------------------------

/**
 * Create a KPI row with multiple metric cards.
 *
 * @example
 * ```ts
 * kpiRow("revenue", [
 *   { label: "MRR", field: "mrr", format: "currency" },
 *   { label: "Subscribers", field: "subscriberCount" },
 * ])
 * ```
 */
export function kpiRow(
  sourceId: string,
  metrics: Array<{
    label: string;
    field: string;
    format?: DataSourceFormat;
    changeField?: string;
    sparklineField?: string;
  }>,
  options?: { columns?: KPIRowSectionConfig["columns"]; variant?: KPIRowSectionConfig["variant"] }
): KPIRowSectionConfig {
  return {
    type: "kpi-row",
    columns: options?.columns ?? (metrics.length as KPIRowSectionConfig["columns"]),
    variant: options?.variant,
    metrics: metrics.map(
      (m): KPIMetricConfig => ({
        label: m.label,
        source: src(sourceId, m.field, m.format),
        ...(m.changeField ? { changeSource: src(sourceId, m.changeField) } : {}),
        ...(m.sparklineField ? { sparklineSource: src(sourceId, m.sparklineField) } : {}),
      })
    ),
  };
}

/**
 * Create a headline stat section — a large featured number.
 *
 * @example
 * ```ts
 * headlineStat("health", "uptimePercent", "Uptime", { format: "percent" })
 * ```
 */
export function headlineStat(
  sourceId: string,
  field: string,
  label: string,
  options?: { format?: DataSourceFormat; indicatorColor?: string }
): HeadlineStatSectionConfig {
  return {
    type: "headline-stat",
    source: src(sourceId, field, options?.format),
    label,
    indicatorColor: options?.indicatorColor,
  };
}

/**
 * Create a scrollable list section.
 *
 * @example
 * ```ts
 * list("github", "pullRequests", {
 *   title: "title",
 *   subtitle: "author",
 *   badge: "status",
 *   emptyMessage: "No open PRs",
 * })
 * ```
 */
export function list(
  sourceId: string,
  field: string,
  template: {
    title: string;
    subtitle?: string;
    value?: string;
    timestamp?: string;
    badge?: string;
    emptyMessage?: string;
    maxItems?: number;
  }
): ListSectionConfig {
  return {
    type: "list",
    source: src(sourceId, field),
    itemTemplate: {
      title: src(sourceId, template.title),
      ...(template.subtitle ? { subtitle: src(sourceId, template.subtitle) } : {}),
      ...(template.value ? { value: src(sourceId, template.value) } : {}),
      ...(template.timestamp ? { timestamp: src(sourceId, template.timestamp) } : {}),
      ...(template.badge ? { badge: { label: src(sourceId, template.badge) } } : {}),
    },
    emptyMessage: template.emptyMessage,
    maxItems: template.maxItems,
  };
}

/**
 * Create a row-list section (compact rows with status dots/icons).
 *
 * @example
 * ```ts
 * rowList("sentry", "issues", {
 *   title: "title",
 *   subtitle: "culprit",
 *   badge: "level",
 *   timestamp: "lastSeen",
 * })
 * ```
 */
export function rowList(
  sourceId: string,
  field: string,
  template: {
    title: string;
    subtitle?: string;
    badge?: string;
    value?: string;
    timestamp?: string;
    emptyMessage?: string;
    maxItems?: number;
  }
): RowListSectionConfig {
  return {
    type: "row-list",
    source: src(sourceId, field),
    itemTemplate: {
      title: src(sourceId, template.title),
      ...(template.subtitle ? { subtitle: src(sourceId, template.subtitle) } : {}),
      ...(template.value ? { value: src(sourceId, template.value) } : {}),
      ...(template.timestamp ? { timestamp: src(sourceId, template.timestamp) } : {}),
      ...(template.badge ? { badge: { label: src(sourceId, template.badge) } } : {}),
    },
    emptyMessage: template.emptyMessage,
    maxItems: template.maxItems,
  };
}

/**
 * Create a chart section (area, line, bar, or sparkline).
 *
 * @example
 * ```ts
 * chart("analytics", "dailyVisitors", { variant: "area", height: 200, color: "var(--accent)" })
 * ```
 */
export function chart(
  sourceId: string,
  field: string,
  options?: {
    variant?: ChartSectionConfig["variant"];
    height?: number;
    xKey?: string;
    yKey?: string;
    color?: string;
    series?: ChartSectionConfig["series"];
    fillHeight?: boolean;
  }
): ChartSectionConfig {
  return {
    type: "chart",
    variant: options?.variant ?? "area",
    source: src(sourceId, field),
    height: options?.height,
    xKey: options?.xKey,
    yKey: options?.yKey,
    color: options?.color,
    series: options?.series,
    fillHeight: options?.fillHeight,
  };
}

/**
 * Create a card grid section for rich card layouts.
 *
 * @example
 * ```ts
 * cardList("store", "apps", {
 *   title: "name",
 *   subtitle: "developer",
 *   description: "summary",
 *   image: "iconUrl",
 *   columns: 2,
 * })
 * ```
 */
export function cardList(
  sourceId: string,
  field: string,
  template: {
    title: string;
    subtitle?: string;
    description?: string;
    image?: string;
    badge?: string;
    columns?: CardListSectionConfig["columns"];
    emptyMessage?: string;
    maxItems?: number;
    searchable?: boolean;
  }
): CardListSectionConfig {
  return {
    type: "card-list",
    source: src(sourceId, field),
    titleSource: src(sourceId, template.title),
    ...(template.subtitle ? { subtitleSource: src(sourceId, template.subtitle) } : {}),
    ...(template.description ? { descriptionSource: src(sourceId, template.description) } : {}),
    ...(template.image ? { imageSource: src(sourceId, template.image) } : {}),
    ...(template.badge ? { badgeSource: src(sourceId, template.badge) } : {}),
    columns: template.columns,
    emptyMessage: template.emptyMessage,
    maxItems: template.maxItems,
    searchable: template.searchable,
  };
}

/**
 * Create a 2x2 summary quad section.
 *
 * @example
 * ```ts
 * summaryQuad("revenue", [
 *   { label: "MRR", field: "mrr" },
 *   { label: "ARR", field: "arr" },
 *   { label: "Churn", field: "churnRate" },
 *   { label: "LTV", field: "ltv" },
 * ])
 * ```
 */
export function summaryQuad(
  sourceId: string,
  slots: Array<
    | {
        label: string;
        field: string;
        format?: DataSourceFormat;
        changeField?: string;
        sparklineField?: string;
      }
    | { kind: "empty" }
  >
): SummaryQuadSectionConfig {
  const quadSlots = slots.map((slot): SummaryQuadSlotConfig => {
    if ("kind" in slot) return { kind: "empty" };
    const metricSlot = slot;
    return {
      kind: "metric",
      label: metricSlot.label,
      source: src(sourceId, metricSlot.field, metricSlot.format),
      ...(metricSlot.changeField ? { changeSource: src(sourceId, metricSlot.changeField) } : {}),
      ...(metricSlot.sparklineField
        ? { sparklineSource: src(sourceId, metricSlot.sparklineField) }
        : {}),
    };
  });

  // Pad to exactly 4 slots
  while (quadSlots.length < 4) quadSlots.push({ kind: "empty" });

  return {
    type: "summary-quad",
    slots: quadSlots.slice(0, 4) as [
      SummaryQuadSlotConfig,
      SummaryQuadSlotConfig,
      SummaryQuadSlotConfig,
      SummaryQuadSlotConfig,
    ],
  };
}

/**
 * Create an alert/banner section.
 *
 * @example
 * ```ts
 * alert("warning", "API rate limit approaching 80%", { dismissible: true })
 * ```
 */
export function alert(
  severity: AlertSectionConfig["severity"],
  message: string,
  options?: {
    source?: DataSource;
    dismissible?: boolean;
    action?: { label: string; href?: string };
  }
): AlertSectionConfig {
  return {
    type: "alert",
    severity,
    message,
    source: options?.source,
    dismissible: options?.dismissible,
    action: options?.action,
  };
}

/**
 * Create a tabbed content section.
 *
 * @example
 * ```ts
 * tabs([
 *   { id: "issues", label: "Issues", sections: [list("github", "issues", { title: "title" })] },
 *   { id: "prs", label: "Pull Requests", sections: [list("github", "prs", { title: "title" })] },
 * ])
 * ```
 */
export function tabs(
  tabConfigs: Array<{
    id: string;
    label: string;
    sections: SectionConfig[];
    countSource?: DataSource;
  }>,
  options?: { defaultTab?: string; variant?: "compact" | "expanded" }
): TabsSectionConfig {
  return {
    type: "tabs",
    tabs: tabConfigs,
    defaultTab: options?.defaultTab,
    variant: options?.variant,
  };
}
