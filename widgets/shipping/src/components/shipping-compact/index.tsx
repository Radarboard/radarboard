"use client";

/**
 * Shipping Log — Compact grid view
 */

import {
  createFeedListRecipe,
  TemplateWidget,
  type WidgetTemplateConfig,
} from "@radarboard/widget-engine/templates";
import type { WidgetRenderProps } from "@radarboard/widget-sdk/widget-types";

const SHIPPING_TEMPLATE_CONFIG: WidgetTemplateConfig = {
  dataSources: [{ id: "shipping" }],
  sections: createFeedListRecipe({
    content: {
      type: "row-list",
      source: { sourceId: "shipping", field: "items" },
      emptyMessage: "No recent activity",
      selection: {
        selectionId: "shipping",
        keyField: "id",
        detailRendererId: "shipping.item",
      },
      itemTemplate: {
        status: { source: { sourceId: "shipping", field: "sourceColor" } },
        title: { sourceId: "shipping", field: "title" },
        badge: {
          label: { sourceId: "shipping", field: "projectName" },
          color: { sourceId: "shipping", field: "projectColor" },
          normalize: "compact-project",
        },
        timestamp: { sourceId: "shipping", field: "timeAgo" },
      },
    },
  }),
};

export { SHIPPING_TEMPLATE_CONFIG };

function isTemplateConfig(config: unknown): config is WidgetTemplateConfig {
  if (!config || typeof config !== "object") return false;
  const candidate = config as Partial<WidgetTemplateConfig>;
  return Array.isArray(candidate.dataSources) && Array.isArray(candidate.sections);
}

export { isTemplateConfig };

export function ShippingCompact({
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
  const templateConfig = isTemplateConfig(config) ? config : SHIPPING_TEMPLATE_CONFIG;
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
