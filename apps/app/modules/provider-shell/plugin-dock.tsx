"use client";

import { usePollingInterval } from "@radarboard/hooks/use-polling-interval";
import { getPluginToken } from "@radarboard/plugin-sdk/host";
import { PluginSidebar as PluginSidebarView } from "@radarboard/plugin-sdk/runtime/plugin-dock";
import {
  getStatusPageAlertSources,
  STATUS_PAGE_CACHE_KEY,
} from "@radarboard/plugin-status-page/statuspage";
import { pluginDataRoute } from "@radarboard/types/api-routes";
import useSWR from "swr";
import { useDisabledPlugins } from "@/hooks/plugins/use-disabled-plugins";

type DockIssueState = "outage" | "degraded" | null;

const STATUS_PAGE_PLUGIN_ID = "status-page";

async function loadStatusPageDockIssueState(): Promise<DockIssueState> {
  const token = await getPluginToken(STATUS_PAGE_PLUGIN_ID);
  const response = await fetch(pluginDataRoute(STATUS_PAGE_PLUGIN_ID, STATUS_PAGE_CACHE_KEY), {
    headers: { "X-Plugin-Token": token },
  });
  if (!response.ok) return null;

  const data = (await response.json()) as { value?: string | null };
  if (!data.value) return null;

  const sources = JSON.parse(data.value) as Parameters<typeof getStatusPageAlertSources>[0];
  const alerts = getStatusPageAlertSources(sources);
  if (alerts.some((source) => source.status === "outage")) return "outage";
  if (alerts.some((source) => source.status === "degraded")) return "degraded";
  return null;
}

export function PluginSidebar(
  props: Omit<Parameters<typeof PluginSidebarView>[0], "disabledPlugins" | "statusPageIssueState">
) {
  const disabledPlugins = useDisabledPlugins();
  const refreshInterval = usePollingInterval("plugin-dock-status-page");
  const { data: statusPageIssueState = null } = useSWR<DockIssueState>(
    "plugin-dock:status-page-issue-state",
    async () => {
      try {
        return await loadStatusPageDockIssueState();
      } catch {
        return null;
      }
    },
    {
      fallbackData: null,
      refreshInterval,
      revalidateOnFocus: false,
    }
  );

  return (
    <PluginSidebarView
      {...props}
      disabledPlugins={disabledPlugins}
      statusPageIssueState={statusPageIssueState}
    />
  );
}
