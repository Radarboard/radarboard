"use client";

import type { PluginWidgetContribution } from "@radarboard/plugin-sdk/types";
import {
  createTemplateConfig,
  type DataSourceResolverProps,
  reportState,
  useStoredValue,
} from "@radarboard/plugin-sdk/widget-template-utils";
import { registerTemplateDataSource } from "@radarboard/widget-engine/templates";
import { useCallback, useEffect, useMemo } from "react";
import { STATUS_PAGE_CACHE_KEY, STATUS_PAGE_UI_SYNC_INTERVAL_MS } from "./statuspage";
import type { StatusSource } from "./types";

function StatusPageResolver({ onState }: DataSourceResolverProps) {
  const { data, error, isLoading, mutate } = useStoredValue<StatusSource[]>(
    "status-page",
    STATUS_PAGE_CACHE_KEY,
    "plugin-status-page"
  );
  const refetch = useCallback(async () => {
    await mutate();
  }, [mutate]);
  const normalized = useMemo(() => {
    const sources = data ?? [];
    const operationalCount = sources.filter((source) => source.status === "operational").length;
    return {
      operationalCount,
      totalCount: sources.length,
      sources: sources.map((source) => ({
        ...source,
        titleText: source.name,
        subtitleText: source.projectName ?? source.url,
        statusTone: (() => {
          if (source.status === "outage") return "#e05555";
          if (source.status === "degraded") return "#f5c542";
          if (source.status === "operational") return "#4ade80";
          return "#666";
        })(),
        pluginUrl: `?plugin=status-page`,
      })),
    };
  }, [data]);

  useEffect(() => {
    reportState(onState, {
      data: normalized,
      fetchedAt: null,
      refetch,
      loading: isLoading,
      error: error?.message ?? null,
    });
  }, [normalized, refetch, isLoading, error, onState]);

  return null;
}

registerTemplateDataSource("plugin.status-page.summary", StatusPageResolver);

export const statusPageWidgetContribution: PluginWidgetContribution = {
  widgetId: "summary",
  name: "Service Status",
  description: "Operational status summary for monitored services",
  defaultSlot: "slot8",
  templateConfig: createTemplateConfig(
    {
      kind: "summary_list",
      summary: [
        {
          type: "headline-stat",
          source: {
            sourceId: "plugin.status-page.summary",
            field: "operationalCount",
            format: "number",
          },
          label: "operational",
        },
        {
          type: "kpi-row",
          columns: 1,
          metrics: [
            {
              label: "Total",
              source: {
                sourceId: "plugin.status-page.summary",
                field: "totalCount",
                format: "number",
              },
            },
          ],
        },
      ],
      rail: [],
      content: [
        {
          type: "row-list",
          source: { sourceId: "plugin.status-page.summary", field: "sources" },
          emptyMessage: "No services monitored",
          hrefSource: { sourceId: "plugin.status-page.summary", field: "pluginUrl" },
          itemTemplate: {
            status: { source: { sourceId: "plugin.status-page.summary", field: "statusTone" } },
            title: { sourceId: "plugin.status-page.summary", field: "titleText" },
            subtitle: { sourceId: "plugin.status-page.summary", field: "subtitleText" },
          },
        },
      ],
    },
    "plugin.status-page.summary"
  ),
  pollingSourceIds: ["plugin-status-page"],
  defaultPollInterval: STATUS_PAGE_UI_SYNC_INTERVAL_MS,
};
