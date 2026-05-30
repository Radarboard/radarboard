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
import type { RelayStats } from "./types";

function WebhookRelayResolver({ onState }: DataSourceResolverProps) {
  const { data, error, isLoading, mutate } = useStoredValue<RelayStats>(
    "webhook-relay",
    "relay-stats",
    "plugin-webhook-relay"
  );
  const refetch = useCallback(async () => {
    await mutate();
  }, [mutate]);
  const normalized = useMemo(
    () => ({
      totalEvents: data?.totalEvents ?? 0,
      criticalCount: data?.bySeverity.critical ?? 0,
      warningCount: data?.bySeverity.warning ?? 0,
      statusLabel: data?.pollStatus ?? "unconfigured",
      statusTone: (() => {
        if (data?.pollStatus === "connected") return "#4ade80";
        if (data?.pollStatus === "error") return "#e05555";
        return "#666";
      })(),
      integrations: Object.entries(data?.byIntegration ?? {}).map(([name, count]) => ({
        titleText: name,
        valueText: String(count),
        pluginUrl: `?plugin=webhook-relay`,
      })),
    }),
    [data]
  );

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

registerTemplateDataSource("plugin.webhook-relay.summary", WebhookRelayResolver);

export const webhookRelayWidgetContribution: PluginWidgetContribution = {
  widgetId: "activity",
  name: "Webhook Activity",
  description: "Webhook event volume and severity summary",
  defaultSlot: "slot8",
  templateConfig: createTemplateConfig(
    {
      kind: "summary_content",
      summary: [
        {
          type: "headline-stat",
          source: {
            sourceId: "plugin.webhook-relay.summary",
            field: "totalEvents",
            format: "number",
          },
          label: "events",
        },
        {
          type: "kpi-row",
          columns: 2,
          variant: "compact",
          metrics: [
            {
              label: "Critical",
              source: {
                sourceId: "plugin.webhook-relay.summary",
                field: "criticalCount",
                format: "number",
              },
            },
            {
              label: "Warnings",
              source: {
                sourceId: "plugin.webhook-relay.summary",
                field: "warningCount",
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
          source: { sourceId: "plugin.webhook-relay.summary", field: "integrations" },
          emptyMessage: "No webhook events yet",
          hrefSource: { sourceId: "plugin.webhook-relay.summary", field: "pluginUrl" },
          itemTemplate: {
            title: { sourceId: "plugin.webhook-relay.summary", field: "titleText" },
            value: { sourceId: "plugin.webhook-relay.summary", field: "valueText" },
          },
        },
      ],
    },
    "plugin.webhook-relay.summary"
  ),
  pollingSourceIds: ["plugin-webhook-relay"],
  defaultPollInterval: 15_000,
};
