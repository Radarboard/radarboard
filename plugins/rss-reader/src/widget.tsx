"use client";

import { getPluginToken } from "@radarboard/plugin-sdk/host";
import { usePluginPollingInterval } from "@radarboard/plugin-sdk/widget-template-utils";
import { pluginDataRoute } from "@radarboard/types/api-routes";
import { detectBrowserTimeZone, isDateInTimeRange } from "@radarboard/utils/timezone";
import type { WidgetRenderProps } from "@radarboard/widget-engine/widgets/registry";
import { Rss } from "lucide-react";
import { useMemo, useState } from "react";
import useSWR from "swr";
import type { RssFeed, RssItem } from "./types";

function getFaviconUrl(articleUrl: string): string | null {
  try {
    const domain = new URL(articleUrl).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch {
    return null;
  }
}

function Favicon({ url }: { url: string }) {
  const faviconUrl = getFaviconUrl(url);

  if (!faviconUrl) {
    return <span className="h-3.5 w-3.5 shrink-0 rounded-full bg-accent" />;
  }

  return (
    <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface p-px">
      <span
        aria-hidden="true"
        className="h-full w-full rounded-full bg-center bg-cover bg-no-repeat"
        style={{ backgroundImage: `url("${faviconUrl}")` }}
      />
    </span>
  );
}

async function fetchWidgetData(): Promise<{ feeds: RssFeed[]; items: RssItem[] }> {
  const token = await getPluginToken("rss-reader");
  const headers = { "X-Plugin-Token": token };
  const [feedsRes, itemsRes] = await Promise.all([
    fetch(pluginDataRoute("rss-reader", "rss:feeds"), { headers }),
    fetch(pluginDataRoute("rss-reader", "rss:items"), { headers }),
  ]);
  const [feedsData, itemsData] = await Promise.all([feedsRes.json(), itemsRes.json()]);

  return {
    feeds: feedsData.value ? (JSON.parse(feedsData.value) as RssFeed[]) : [],
    items: itemsData.value ? (JSON.parse(itemsData.value) as RssItem[]) : [],
  };
}

/**
 * rss-reader__feed widget — shows unread count and latest unread items.
 *
 * This widget reads data directly from the plugin DB via fetch
 * (since it renders outside the PluginHost context, in the widget grid).
 */
export function RssReaderWidget({ timeRange = "30d", config }: WidgetRenderProps<unknown>) {
  const showReadItems = (config as Record<string, unknown> | undefined)?.showReadItems === true;
  const [effectiveTimezone] = useState(() => detectBrowserTimeZone());
  const refreshInterval = usePluginPollingInterval("plugin-rss-reader");
  const { data } = useSWR("rss-reader:widget", fetchWidgetData, {
    refreshInterval,
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });
  const feeds = data?.feeds ?? [];
  const items = data?.items ?? [];

  const filteredItems = useMemo(
    () =>
      items
        .filter(
          (item) =>
            (showReadItems || !item.read) &&
            isDateInTimeRange(item.publishedAt, timeRange, effectiveTimezone)
        )
        .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt)),
    [effectiveTimezone, items, showReadItems, timeRange]
  );

  const itemCount = filteredItems.length;
  const itemLabel = showReadItems ? "articles" : "unread";

  if (feeds.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-dim text-xs">
        No feeds configured
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 p-3">
      {/* Stats row */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Rss className="icon-xs text-dim" />
          <span className="font-mono text-foreground-secondary text-sm">{itemCount}</span>
          <span className="text-dim text-w-sm">{itemLabel}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-foreground-secondary text-sm">{feeds.length}</span>
          <span className="text-dim text-w-sm">feeds</span>
        </div>
      </div>

      {/* Latest items */}
      <div className="flex-1 overflow-hidden">
        {itemCount === 0 ? (
          <div className="py-2 text-center text-dim text-xs">All caught up</div>
        ) : (
          <div className="space-y-1">
            {filteredItems.slice(0, 3).map((item) => (
              <div key={item.id} className="flex items-center gap-2 text-xs">
                <Favicon url={item.link} />
                <span className="truncate text-muted-foreground">{item.title}</span>
              </div>
            ))}
            {itemCount > 3 && <div className="text-dim text-w-sm">+{itemCount - 3} more</div>}
          </div>
        )}
      </div>
    </div>
  );
}
