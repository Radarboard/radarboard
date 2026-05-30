"use client";

import { PluginLauncher as PluginLauncherView } from "@radarboard/plugin-sdk/runtime/plugin-launcher";
import { useResolvedAppShortcuts } from "@/hooks/app/use-app-shortcuts";
import { useDisabledPlugins } from "@/hooks/plugins/use-disabled-plugins";
import { usePluginConfigs } from "@/hooks/plugins/use-plugin-configs";
import { isFeatureEnabled } from "@/lib/features";

export function PluginLauncher(
  props: Omit<
    Parameters<typeof PluginLauncherView>[0],
    | "assistantEnabled"
    | "disabledPlugins"
    | "pluginConfigs"
    | "searchShortcut"
    | "settingsShortcut"
    | "assistantShortcut"
  >
) {
  const assistantEnabled = isFeatureEnabled("assistant");
  const appShortcuts = useResolvedAppShortcuts();
  const disabledPlugins = useDisabledPlugins();
  const pluginConfigs = usePluginConfigs();

  return (
    <PluginLauncherView
      {...props}
      assistantEnabled={assistantEnabled}
      disabledPlugins={disabledPlugins}
      pluginConfigs={pluginConfigs}
      searchShortcut={appShortcuts.get("search")?.shortcut ?? "Mod+K"}
      settingsShortcut={appShortcuts.get("open-settings")?.shortcut ?? "Mod+,"}
      assistantShortcut={appShortcuts.get("assistant")?.shortcut ?? "Mod+Shift+L"}
    />
  );
}
