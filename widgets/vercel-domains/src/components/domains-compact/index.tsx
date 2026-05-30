"use client";

/**
 * Vercel Domains — Compact grid view
 */

import {
  createSummaryListRecipe,
  TemplateWidget,
  type WidgetTemplateConfig,
} from "@radarboard/widget-engine/templates";
import type { WidgetRenderProps } from "@radarboard/widget-sdk/widget-types";

const VERCEL_DOMAINS_TEMPLATE_CONFIG: WidgetTemplateConfig = {
  dataSources: [{ id: "vercel" }],
  sections: createSummaryListRecipe({
    summary: [
      {
        type: "kpi-row",
        columns: 3,
        variant: "compact",
        metrics: [
          {
            label: "Total Domains",
            source: { sourceId: "vercel", field: "domainMetrics.total", format: "number" },
          },
          {
            label: "Verified",
            source: { sourceId: "vercel", field: "domainMetrics.verified", format: "number" },
          },
          {
            label: "Unverified",
            source: { sourceId: "vercel", field: "domainMetrics.unverified", format: "number" },
          },
        ],
      },
    ],
    list: {
      type: "list",
      source: { sourceId: "vercel", field: "domains" },
      layout: "inline",
      inlineHeader: {
        title: "Domain",
        subtitle: "Project",
        value: "Status",
        gridTemplateColumns: "minmax(0,1fr) 118px 86px",
      },
      emptyMessage: "No domains",
      itemTemplate: {
        title: { sourceId: "vercel", field: "name" },
        subtitle: { sourceId: "vercel", field: "projectName", normalize: "compact-project" },
        value: { sourceId: "vercel", field: "statusLabel" },
      },
    },
  }),
};

export { VERCEL_DOMAINS_TEMPLATE_CONFIG };

function isTemplateConfig(config: unknown): config is WidgetTemplateConfig {
  if (!config || typeof config !== "object") return false;
  const candidate = config as Partial<WidgetTemplateConfig>;
  return Array.isArray(candidate.dataSources) && Array.isArray(candidate.sections);
}

export { isTemplateConfig };

export function VercelDomainsCompact({
  widgetId,
  projectSlug,
  config,
  onFetchedAt,
  onRefetch,
  onChromeStateChange,
  onConnectService,
}: WidgetRenderProps<WidgetTemplateConfig>) {
  const templateConfig = isTemplateConfig(config) ? config : VERCEL_DOMAINS_TEMPLATE_CONFIG;
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
