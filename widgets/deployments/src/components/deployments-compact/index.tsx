"use client";

import {
  createSummaryContentRecipe,
  TemplateWidget,
  type WidgetTemplateConfig,
} from "@radarboard/widget-engine/templates";
import type { WidgetRenderProps } from "@radarboard/widget-sdk/widget-types";

// --- Template config ---

export const VERCEL_DEPLOYMENTS_TEMPLATE_CONFIG: WidgetTemplateConfig = {
  dataSources: [{ id: "vercel" }],
  sections: createSummaryContentRecipe({
    summary: [
      {
        type: "activity-chart",
        source: { sourceId: "vercel", field: "deploymentBuckets7d" },
        segments: [
          { key: "ready", color: "#3fb950" },
          { key: "error", color: "#e63946" },
          { key: "building", color: "#f5c542" },
        ],
        heightClassName: "h-12",
      },
      {
        type: "kpi-row",
        columns: 3,
        variant: "compact",
        metrics: [
          {
            label: "Deploys",
            source: { sourceId: "vercel", field: "deploymentMetrics.total", format: "number" },
          },
          {
            label: "Success",
            source: {
              sourceId: "vercel",
              field: "deploymentMetrics.successRate",
              format: "percent",
            },
          },
          {
            label: "Failed",
            source: { sourceId: "vercel", field: "deploymentMetrics.failed", format: "number" },
          },
        ],
      },
    ],
    content: {
      type: "row-list",
      source: { sourceId: "vercel", field: "deployments" },
      maxItems: 5,
      emptyMessage: "No deployments",
      hrefSource: { sourceId: "vercel", field: "deploymentUrl" },
      hrefTarget: "_blank",
      itemTemplate: {
        status: { source: { sourceId: "vercel", field: "stateColor" } },
        title: { sourceId: "vercel", field: "commitMessage" },
        badge: {
          label: { sourceId: "vercel", field: "projectName" },
          color: { sourceId: "vercel", field: "projectColor" },
          normalize: "compact-project",
        },
        timestamp: { sourceId: "vercel", field: "timeAgo" },
      },
    },
  }),
};

export function isTemplateConfig(config: unknown): config is WidgetTemplateConfig {
  if (!config || typeof config !== "object") return false;
  const candidate = config as Partial<WidgetTemplateConfig>;
  return Array.isArray(candidate.dataSources) && Array.isArray(candidate.sections);
}

// --- Compact view ---

export function VercelDeploymentsCompact({
  widgetId,
  projectSlug,
  config,
  onFetchedAt,
  onRefetch,
  onChromeStateChange,
  onConnectService,
}: WidgetRenderProps<WidgetTemplateConfig>) {
  const templateConfig = isTemplateConfig(config) ? config : VERCEL_DEPLOYMENTS_TEMPLATE_CONFIG;
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
