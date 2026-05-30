"use client";

/**
 * Vercel Build Performance — Compact grid view
 */

import {
  createSummaryContentRecipe,
  TemplateWidget,
  type WidgetTemplateConfig,
} from "@radarboard/widget-engine/templates";
import type { WidgetRenderProps } from "@radarboard/widget-sdk/widget-types";

const VERCEL_BUILD_PERF_TEMPLATE_CONFIG: WidgetTemplateConfig = {
  dataSources: [{ id: "vercel" }],
  sections: createSummaryContentRecipe({
    summary: [
      {
        type: "headline-stat",
        source: {
          sourceId: "vercel",
          field: "buildMetrics.averageBuildDuration",
          format: "number",
        },
        label: "avg build time (s)",
      },
      {
        type: "kpi-row",
        columns: 2,
        variant: "compact",
        metrics: [
          {
            label: "Fastest",
            source: {
              sourceId: "vercel",
              field: "buildMetrics.fastestBuildDuration",
              format: "number",
            },
          },
          {
            label: "Slowest",
            source: {
              sourceId: "vercel",
              field: "buildMetrics.slowestBuildDuration",
              format: "number",
            },
          },
        ],
      },
    ],
    content: {
      type: "chart",
      variant: "bar",
      source: { sourceId: "vercel", field: "buildDurationBars" },
      xKey: "name",
      yKey: "value",
      height: 96,
      color: "#5b8af5",
    },
  }),
};

export { VERCEL_BUILD_PERF_TEMPLATE_CONFIG };

function isTemplateConfig(config: unknown): config is WidgetTemplateConfig {
  if (!config || typeof config !== "object") return false;
  const candidate = config as Partial<WidgetTemplateConfig>;
  return Array.isArray(candidate.dataSources) && Array.isArray(candidate.sections);
}

export { isTemplateConfig };

export function VercelBuildPerfCompact({
  widgetId,
  projectSlug,
  config,
  onFetchedAt,
  onRefetch,
  onChromeStateChange,
  onConnectService,
}: WidgetRenderProps<WidgetTemplateConfig>) {
  const templateConfig = isTemplateConfig(config) ? config : VERCEL_BUILD_PERF_TEMPLATE_CONFIG;
  return (
    <TemplateWidget
      widgetId={widgetId}
      projectSlug={projectSlug}
      config={templateConfig}
      onFetchedAt={onFetchedAt}
      onRefetch={onRefetch}
      onChromeStateChange={onChromeStateChange}
      onConnectService={onConnectService}
    />
  );
}
