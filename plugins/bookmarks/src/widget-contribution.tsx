"use client";

import type { PluginWidgetContribution } from "@radarboard/plugin-sdk/types";
import {
  createTemplateConfig,
  type DataSourceResolverProps,
  relativeTimeLabel,
  reportState,
  useStoredValue,
} from "@radarboard/plugin-sdk/widget-template-utils";
import { registerTemplateDataSource } from "@radarboard/widget-engine/templates";
import { useCallback, useEffect, useMemo } from "react";
import type { Bookmark } from "./types";

function BookmarksResolver({ onState }: DataSourceResolverProps) {
  const { data, error, isLoading, mutate } = useStoredValue<Bookmark[]>(
    "bookmarks",
    "bookmarks:list",
    "plugin-bookmarks"
  );
  const refetch = useCallback(async () => {
    await mutate();
  }, [mutate]);
  const normalized = useMemo(
    () => ({
      bookmarks: (data ?? []).map((bookmark) => ({
        ...bookmark,
        titleText: bookmark.title,
        subtitleText: bookmark.url,
        timestampLabel: relativeTimeLabel(bookmark.createdAt),
      })),
      bookmarksCount: data?.length ?? 0,
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

registerTemplateDataSource("plugin.bookmarks.quick-access", BookmarksResolver);

export const bookmarksWidgetContribution: PluginWidgetContribution = {
  widgetId: "quick-access",
  name: "Quick Access",
  description: "Recent bookmarks and quick links",
  defaultSlot: "slot8",
  templateConfig: createTemplateConfig(
    {
      kind: "content_only",
      summary: [],
      rail: [],
      content: [
        {
          type: "row-list",
          source: { sourceId: "plugin.bookmarks.quick-access", field: "bookmarks" },
          emptyMessage: "No bookmarks yet",
          hrefSource: { sourceId: "plugin.bookmarks.quick-access", field: "url" },
          itemTemplate: {
            title: { sourceId: "plugin.bookmarks.quick-access", field: "titleText" },
            subtitle: { sourceId: "plugin.bookmarks.quick-access", field: "subtitleText" },
            timestamp: { sourceId: "plugin.bookmarks.quick-access", field: "timestampLabel" },
          },
        },
      ],
    },
    "plugin.bookmarks.quick-access"
  ),
  pollingSourceIds: ["plugin-bookmarks"],
  defaultPollInterval: 30_000,
};
