"use client";

import { PluginOverlay as PluginOverlayView } from "@radarboard/plugin-sdk/runtime/plugin-overlay";
import { useDisabledPlugins } from "@/hooks/plugins/use-disabled-plugins";

export function PluginOverlay(
  props: Omit<Parameters<typeof PluginOverlayView>[0], "disabledPlugins">
) {
  const disabledPlugins = useDisabledPlugins();
  return <PluginOverlayView {...props} disabledPlugins={disabledPlugins} />;
}
