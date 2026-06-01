"use client";

import { PluginSidebar as PluginSidebarView } from "@radarboard/plugin-sdk/runtime/plugin-dock";
import { useDisabledPlugins } from "@/hooks/plugins/use-disabled-plugins";

export function PluginSidebar(
  props: Omit<Parameters<typeof PluginSidebarView>[0], "disabledPlugins" | "statusPageIssueState">
) {
  const disabledPlugins = useDisabledPlugins();

  return (
    <PluginSidebarView {...props} disabledPlugins={disabledPlugins} statusPageIssueState={null} />
  );
}
