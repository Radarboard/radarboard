"use client";

import { RssReaderBackgroundPoller as RssReaderBackgroundPollerView } from "@radarboard/plugin-rss-reader/runtime/background-poller";
import { useDisabledPlugins } from "@/hooks/plugins/use-disabled-plugins";

const PLUGIN_ID = "rss-reader";

export function RssReaderBackgroundPoller() {
  const disabledPlugins = useDisabledPlugins();
  return <RssReaderBackgroundPollerView isDisabled={disabledPlugins.has(PLUGIN_ID)} />;
}
