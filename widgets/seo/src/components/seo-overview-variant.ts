/**
 * SEO Performance — "Overview" variant template config.
 *
 * Renders 4 KPI cards with change deltas, followed by a normalized
 * multi-line trend chart covering all four metrics.
 */

import type { WidgetTemplateConfig } from "@radarboard/widget-engine/templates";

const SRC = "google-search-console";

export const SEO_OVERVIEW_CONFIG: WidgetTemplateConfig = {
  dataSources: [{ id: SRC }],
  sections: [
    {
      type: "kpi-row",
      columns: 4,
      metrics: [
        {
          label: "Clicks",
          color: "var(--color-chart-1)",
          source: { sourceId: SRC, field: "totalClicks", format: "number" },
          changeSource: { sourceId: SRC, field: "clicksChange", format: "percent", precision: 1 },
        },
        {
          label: "Impressions",
          color: "var(--color-chart-3)",
          source: { sourceId: SRC, field: "totalImpressions", format: "number", compact: true },
          changeSource: {
            sourceId: SRC,
            field: "impressionsChange",
            format: "percent",
            precision: 1,
          },
        },
        {
          label: "CTR",
          color: "var(--color-chart-4)",
          source: { sourceId: SRC, field: "avgCtr", format: "percent", precision: 1 },
          changeSource: { sourceId: SRC, field: "ctrChange", format: "percent", precision: 1 },
        },
        {
          label: "Position",
          color: "var(--color-chart-2)",
          source: { sourceId: SRC, field: "avgPosition", format: "number", precision: 1 },
          changeSource: { sourceId: SRC, field: "positionChange", format: "percent", precision: 1 },
        },
      ],
    },
    {
      type: "chart",
      variant: "line",
      source: { sourceId: SRC, field: "overviewTrend" },
      fillHeight: true,
      normalize: true,
      series: [
        { dataKey: "clicks", name: "Clicks", color: "var(--color-chart-1)", format: "number" },
        {
          dataKey: "impressions",
          name: "Impressions",
          color: "var(--color-chart-3)",
          format: "compact",
        },
        { dataKey: "ctr", name: "Avg. CTR", color: "var(--color-chart-4)", format: "percent" },
        {
          dataKey: "position",
          name: "Avg. Position",
          color: "var(--color-chart-2)",
          format: "decimal",
        },
      ],
    },
  ],
};
