"use client";

import type { PluginWidgetContribution } from "@radarboard/plugin-sdk/types";
import {
  createTemplateConfig,
  type DataSourceResolverProps,
  reportState,
  usePluginPollingInterval,
  useStoredValue,
} from "@radarboard/plugin-sdk/widget-template-utils";
import { pluginRoute } from "@radarboard/types/api-routes";
import { registerTemplateDataSource } from "@radarboard/widget-engine/templates";
import { useCallback, useEffect, useMemo } from "react";
import useSWR from "swr";
import type { ChangelogEntry, ChangelogEntryMetaMap } from "./types";

function ChangelogResolver({ onState }: DataSourceResolverProps) {
  const refreshInterval = usePluginPollingInterval("plugin-changelog");
  const { data, error, isLoading, mutate } = useSWR<ChangelogEntry[]>(
    pluginRoute("changelog", "state"),
    async () => {
      const response = await fetch(pluginRoute("changelog", "state"));
      const payload = (await response.json()) as { entries?: ChangelogEntry[]; error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load changelog state");
      }
      return payload.entries ?? [];
    },
    {
      refreshInterval,
    }
  );
  const { data: entryMeta } = useStoredValue<ChangelogEntryMetaMap>(
    "changelog",
    "changelog:entry-meta",
    "plugin-changelog"
  );
  const refetch = useCallback(async () => {
    await fetch(pluginRoute("changelog", "sync"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ force: false }),
    }).catch(() => undefined);
    await mutate();
  }, [mutate]);
  const normalized = useMemo(
    () => ({
      entries: [...(data ?? [])]
        .filter((entry) => {
          const meta = entryMeta?.[entry.id];
          return !meta?.readAt && !meta?.archivedAt;
        })
        .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt))
        .map((entry) => ({
          ...entry,
          titleText: entry.packageName,
          subtitleText: `v${entry.version} · ${entry.date}`,
          badgeLabel: entry.notesQuality === "full" ? "full" : "minimal",
          badgeColor: entry.notesQuality === "full" ? "#5b8af5" : "#7c7c84",
          pluginUrl: `?plugin=changelog&entryId=${encodeURIComponent(entry.id)}`,
        })),
      entriesCount: data?.length ?? 0,
    }),
    [data, entryMeta]
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

registerTemplateDataSource("plugin.changelog.timeline", ChangelogResolver);

export const changelogWidgetContribution: PluginWidgetContribution = {
  widgetId: "timeline",
  name: "Changelogs",
  description: "Unread changelog entries",
  defaultSlot: "slot8",
  templateConfig: createTemplateConfig(
    {
      kind: "content_only",
      summary: [],
      rail: [],
      content: [
        {
          type: "row-list",
          source: { sourceId: "plugin.changelog.timeline", field: "entries" },
          emptyMessage: "No changelog entries",
          hrefSource: { sourceId: "plugin.changelog.timeline", field: "pluginUrl" },
          itemTemplate: {
            title: { sourceId: "plugin.changelog.timeline", field: "titleText" },
            subtitle: { sourceId: "plugin.changelog.timeline", field: "subtitleText" },
            badge: {
              label: { sourceId: "plugin.changelog.timeline", field: "badgeLabel" },
              color: { sourceId: "plugin.changelog.timeline", field: "badgeColor" },
            },
          },
        },
      ],
    },
    "plugin.changelog.timeline"
  ),
  pollingSourceIds: ["plugin-changelog"],
  defaultPollInterval: 30_000,
};
