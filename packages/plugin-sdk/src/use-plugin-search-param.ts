"use client";

import { useStore } from "@tanstack/react-store";
import { pluginStore } from "./store";
import type { PluginAPI } from "./types";

/**
 * A custom hook to safely read a URL search parameter for plugins.
 * It uses a global pluginStore as the primary source of truth for instant
 * responsiveness on click, falling back to Next.js reactive `searchParams`.
 */
export function usePluginSearchParam(
  api: PluginAPI,
  paramName: string,
  pluginId: string
): string | null {
  const selection = useStore(pluginStore, (s) => s.selections[pluginId]);
  const urlValue = api.searchParams.get(paramName);

  return selection ?? urlValue;
}
