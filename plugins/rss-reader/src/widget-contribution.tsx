"use client";

import type { PluginWidgetContribution } from "@radarboard/plugin-sdk/types";
import {
  createTemplateConfig,
  type DataSourceResolverProps,
  relativeTimeLabel,
  reportState,
  useStoredValue,
} from "@radarboard/plugin-sdk/widget-template-utils";
import { detectBrowserTimeZone, isDateInTimeRange } from "@radarboard/utils/timezone";
import { registerTemplateDataSource } from "@radarboard/widget-engine/templates";
import { useCallback, useEffect, useMemo } from "react";
import type { RssFeed, RssItem } from "./types";

function RssResolver({ timeRange = "30d", config, onState }: DataSourceResolverProps) {
  const showReadItems = (config as Record<string, unknown> | undefined)?.showReadItems === true;
  const {
    data: feedsData,
    error: feedsError,
    isLoading: feedsLoading,
    mutate: mutateFeeds,
  } = useStoredValue<RssFeed[]>("rss-reader", "rss:feeds", "plugin-rss-reader");
  const {
    data: itemsData,
    error: itemsError,
    isLoading: itemsLoading,
    mutate: mutateItems,
  } = useStoredValue<RssItem[]>("rss-reader", "rss:items", "plugin-rss-reader");
  const refetch = useCallback(async () => {
    await Promise.all([mutateFeeds(), mutateItems()]);
  }, [mutateFeeds, mutateItems]);
  const effectiveTimezone = detectBrowserTimeZone();

  const normalized = useMemo(() => {
    const filteredItems = (itemsData ?? [])
      .filter(
        (item) =>
          (showReadItems || !item.read) &&
          isDateInTimeRange(item.publishedAt, timeRange, effectiveTimezone)
      )
      .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt));

    const feedsByIdMap = new Map((feedsData ?? []).map((f) => [f.id, f]));

    return {
      unreadCount: filteredItems.length,
      feedCount: feedsData?.length ?? 0,
      unreadItems: filteredItems.map((item) => {
        let faviconUrl: string | null = null;
        let domain: string | null = null;
        try {
          domain = new URL(item.link).hostname.replace(/^www\./, "");
          faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
        } catch {
          // invalid URL — skip favicon
        }
        const feedName = feedsByIdMap.get(item.feedId)?.name;
        const subtitleText = item.author ?? feedName ?? domain ?? "Unknown source";
        return {
          ...item,
          titleText: item.title,
          subtitleText,
          timestampLabel: relativeTimeLabel(item.publishedAt),
          pluginUrl: `?plugin=rss-reader&rssItem=${item.id}`,
          faviconUrl,
        };
      }),
    };
  }, [effectiveTimezone, feedsData, itemsData, showReadItems, timeRange]);

  useEffect(() => {
    reportState(onState, {
      data: normalized,
      fetchedAt: null,
      refetch,
      loading: feedsLoading || itemsLoading,
      error: feedsError?.message ?? itemsError?.message ?? null,
    });
  }, [normalized, refetch, feedsLoading, itemsLoading, feedsError, itemsError, onState]);

  return null;
}

registerTemplateDataSource("plugin.rss.feed", RssResolver);

export const rssWidgetContribution: PluginWidgetContribution = {
  widgetId: "feed",
  name: "RSS Feed",
  description: "Unread items across your RSS feeds",
  defaultSlot: "slot8",
  templateConfig: createTemplateConfig(
    {
      kind: "summary_list",
      summary: [
        {
          type: "kpi-row",
          columns: 2,
          variant: "compact",
          metrics: [
            {
              label: "Unread",
              source: { sourceId: "plugin.rss.feed", field: "unreadCount", format: "number" },
            },
            {
              label: "Feeds",
              source: { sourceId: "plugin.rss.feed", field: "feedCount", format: "number" },
            },
          ],
        },
      ],
      rail: [],
      content: [
        {
          type: "row-list",
          source: { sourceId: "plugin.rss.feed", field: "unreadItems" },
          emptyMessage: "All caught up",
          hrefSource: { sourceId: "plugin.rss.feed", field: "pluginUrl" },
          itemTemplate: {
            title: { sourceId: "plugin.rss.feed", field: "titleText" },
            subtitle: { sourceId: "plugin.rss.feed", field: "subtitleText" },
            timestamp: { sourceId: "plugin.rss.feed", field: "timestampLabel" },
            status: {
              source: { sourceId: "plugin.rss.feed", field: "faviconUrl" },
              display: "favicon",
            },
          },
        },
      ],
    },
    "plugin.rss.feed"
  ),
  pollingSourceIds: ["plugin-rss-reader"],
  defaultPollInterval: 30_000,
};
