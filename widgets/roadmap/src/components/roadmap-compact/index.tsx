"use client";

/**
 * Roadmap — Compact grid view
 *
 * Shows a WIP summary (in-progress + blocked counts) and
 * the next upcoming release with a progress bar.
 */

import {
  createSummaryContentRecipe,
  TemplateWidget,
  type WidgetTemplateConfig,
} from "@radarboard/widget-engine/templates";
import type { WidgetRenderProps } from "@radarboard/widget-sdk/widget-types";

const ROADMAP_TEMPLATE_CONFIG: WidgetTemplateConfig = {
  dataSources: [{ id: "roadmap" }],
  sections: createSummaryContentRecipe({
    summary: [
      {
        type: "kpi-row",
        columns: 2,
        variant: "compact",
        metrics: [
          {
            label: "In Progress",
            source: { sourceId: "roadmap", field: "wipCount" },
          },
          {
            label: "Blocked",
            source: { sourceId: "roadmap", field: "blockedCount" },
          },
        ],
      },
    ],
    content: {
      type: "row-list",
      source: { sourceId: "roadmap", field: "nextReleaseItems" },
      emptyMessage: "No active releases",
      itemTemplate: {
        title: { sourceId: "roadmap", field: "name" },
        badge: {
          label: { sourceId: "roadmap", field: "progressLabel" },
          color: { sourceId: "roadmap", field: "healthColor" },
        },
        timestamp: { sourceId: "roadmap", field: "targetDateLabel" },
      },
    },
  }),
};

export { ROADMAP_TEMPLATE_CONFIG };

function isTemplateConfig(config: unknown): config is WidgetTemplateConfig {
  if (!config || typeof config !== "object") return false;
  const candidate = config as Partial<WidgetTemplateConfig>;
  return Array.isArray(candidate.dataSources) && Array.isArray(candidate.sections);
}

export { isTemplateConfig };

export function RoadmapCompact({
  widgetId,
  projectSlug,
  config,
  selectedDetailId,
  onSelectedDetailIdChange,
  onFetchedAt,
  onRefetch,
  onChromeStateChange,
  onConnectService,
}: WidgetRenderProps<WidgetTemplateConfig>) {
  const templateConfig = isTemplateConfig(config) ? config : ROADMAP_TEMPLATE_CONFIG;
  return (
    <TemplateWidget
      widgetId={widgetId}
      projectSlug={projectSlug}
      config={templateConfig}
      selectedDetailId={selectedDetailId}
      onSelectedDetailIdChange={onSelectedDetailIdChange}
      onFetchedAt={onFetchedAt}
      onRefetch={onRefetch}
      onChromeStateChange={onChromeStateChange}
      onConnectService={onConnectService}
    />
  );
}
