"use client";

/**
 * Vercel Projects — Compact grid view
 */

import {
  createFeedListRecipe,
  TemplateWidget,
  type WidgetTemplateConfig,
} from "@radarboard/widget-engine/templates";
import type { WidgetRenderProps } from "@radarboard/widget-sdk/widget-types";

const VERCEL_PROJECTS_TEMPLATE_CONFIG: WidgetTemplateConfig = {
  dataSources: [{ id: "vercel" }],
  sections: createFeedListRecipe({
    content: {
      type: "row-list",
      source: { sourceId: "vercel", field: "projects" },
      emptyMessage: "No Vercel projects",
      itemTemplate: {
        status: {
          source: { sourceId: "vercel", field: "stateColor" },
        },
        title: { sourceId: "vercel", field: "name" },
        badge: {
          label: { sourceId: "vercel", field: "frameworkLabel" },
          color: { sourceId: "vercel", field: "projectColor" },
        },
        timestamp: { sourceId: "vercel", field: "deployedAgo" },
      },
    },
  }),
};

export { VERCEL_PROJECTS_TEMPLATE_CONFIG };

function isTemplateConfig(config: unknown): config is WidgetTemplateConfig {
  if (!config || typeof config !== "object") return false;
  const candidate = config as Partial<WidgetTemplateConfig>;
  return Array.isArray(candidate.dataSources) && Array.isArray(candidate.sections);
}

export { isTemplateConfig };

export function VercelProjectsCompact({
  widgetId,
  projectSlug,
  config,
  onFetchedAt,
  onRefetch,
  onChromeStateChange,
  onConnectService,
}: WidgetRenderProps<WidgetTemplateConfig>) {
  const templateConfig = isTemplateConfig(config) ? config : VERCEL_PROJECTS_TEMPLATE_CONFIG;

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
