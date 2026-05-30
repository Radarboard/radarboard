"use client";

/**
 * npm Downloads — Compact grid view
 */

import {
  createSummaryListRecipe,
  TemplateWidget,
  type WidgetTemplateConfig,
} from "@radarboard/widget-engine/templates";
import { useTemplateFilterState } from "@radarboard/widget-engine/templates/filter-state";
import type { WidgetRenderProps } from "@radarboard/widget-sdk/widget-types";
import { domAnimation, LazyMotion, m } from "motion/react";
import type { NpmDownloadsConfig, NpmDownloadsRange } from "../../types";

const NPM_DOWNLOADS_TEMPLATE_CONFIG: WidgetTemplateConfig = {
  dataSources: [{ id: "npm-downloads" }],
  sections: createSummaryListRecipe({
    summary: [
      {
        type: "kpi-row",
        columns: 1,
        variant: "compact",
        metrics: [
          {
            label: "Weekly Downloads",
            source: { sourceId: "npm-downloads", field: "totalWeekly", format: "number" },
          },
        ],
      },
    ],
    list: {
      type: "list",
      source: { sourceId: "npm-downloads", field: "packages" },
      layout: "inline",
      inlineHeader: {
        title: "Package",
        subtitle: "Version",
        value: "Weekly",
        gridTemplateColumns: "minmax(0,1fr) 72px 92px",
      },
      emptyMessage: "No packages",
      hrefSource: { sourceId: "npm-downloads", field: "packageUrl" },
      hrefTarget: "_blank",
      itemTemplate: {
        title: { sourceId: "npm-downloads", field: "name" },
        subtitle: { sourceId: "npm-downloads", field: "versionLabel" },
        value: { sourceId: "npm-downloads", field: "weeklyDownloadsLabel" },
      },
    },
  }),
};

export { NPM_DOWNLOADS_TEMPLATE_CONFIG };

function isTemplateConfig(config: unknown): config is WidgetTemplateConfig {
  if (!config || typeof config !== "object") return false;
  const candidate = config as Partial<WidgetTemplateConfig>;
  return Array.isArray(candidate.dataSources) && Array.isArray(candidate.sections);
}

export { isTemplateConfig };

const NPM_RANGE_PERSIST_KEY = "radarboard:widget:downloads:expanded";
const NPM_RANGE_STATE_ID = "downloads-expanded";

export function NpmDownloadsCompact({
  widgetId,
  projectSlug,
  config,
  onFetchedAt,
  onRefetch,
  onChromeStateChange,
  onConnectService,
}: WidgetRenderProps<NpmDownloadsConfig>) {
  const { state } = useTemplateFilterState(
    NPM_RANGE_STATE_ID,
    { range: "30d" },
    NPM_RANGE_PERSIST_KEY
  );
  const range = (typeof state.range === "string" ? state.range : "30d") as NpmDownloadsRange;
  const templateConfig = isTemplateConfig(config) ? config : NPM_DOWNLOADS_TEMPLATE_CONFIG;
  const widgetConfig = {
    ...templateConfig,
    ...(config ?? {}),
    npmRange: range,
  } as NpmDownloadsConfig;

  return (
    <LazyMotion features={domAnimation}>
      <m.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="flex h-full flex-col"
      >
        <TemplateWidget
          widgetId={widgetId}
          projectSlug={projectSlug}
          config={widgetConfig}
          onFetchedAt={onFetchedAt}
          onRefetch={onRefetch}
          onChromeStateChange={onChromeStateChange}
          onConnectService={onConnectService}
        />
      </m.div>
    </LazyMotion>
  );
}
