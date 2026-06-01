"use client";

import { useDemoMode } from "@radarboard/hooks/use-demo-mode";
import { getPluginToken } from "@radarboard/plugin-sdk/host";
import { getAllPlugins } from "@radarboard/plugin-sdk/registry";
import { API_ROUTES, pluginDataRoute } from "@radarboard/types/api-routes";
import { useCallback, useMemo } from "react";
import { useSWRConfig } from "swr";
import useSWRImmutable from "swr/immutable";

const DISABLED_PLUGINS_KEY = "disabled-plugins";
const SYSTEM_PLUGIN_ID = "_system";
const DEMO_ENABLED_PLUGIN_IDS = new Set(["tasks", "notes", "bookmarks"]);
export const DISABLED_PLUGINS_CACHE_KEY = `plugin-data:${SYSTEM_PLUGIN_ID}:${DISABLED_PLUGINS_KEY}`;

/** Sentinel value: null means "no preference stored" (fresh install → all disabled). */
async function fetchDisabledPluginIds(): Promise<string[] | null> {
  try {
    const token = await getPluginToken(SYSTEM_PLUGIN_ID);
    const res = await fetch(pluginDataRoute(SYSTEM_PLUGIN_ID, DISABLED_PLUGINS_KEY), {
      headers: { "X-Plugin-Token": token },
    });
    if (!res.ok) return null;

    const data = (await res.json()) as { value?: string | null };
    if (!data.value) return null;

    return JSON.parse(data.value) as string[];
  } catch {
    return null;
  }
}

async function persistDisabledPluginIds(ids: string[]): Promise<void> {
  const token = await getPluginToken(SYSTEM_PLUGIN_ID);
  const res = await fetch(API_ROUTES.pluginData, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Plugin-Token": token,
    },
    body: JSON.stringify({
      pluginId: SYSTEM_PLUGIN_ID,
      key: DISABLED_PLUGINS_KEY,
      value: JSON.stringify(ids),
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to save disabled plugins: ${res.status}`);
  }
}

/**
 * Build the disabled set.
 * - `undefined` = still loading → treat all as disabled (avoid flash of enabled state)
 * - `null` = fresh install, no preference stored → all plugins disabled
 * - `string[]` = user's explicit disabled list
 */
function buildDisabledPluginSet(ids: string[] | null | undefined): Set<string> {
  if (ids === null || ids === undefined) {
    return new Set(getAllPlugins().map((p) => p.id));
  }
  return new Set(ids);
}

function buildDemoDisabledPluginSet(ids: string[] | null | undefined): Set<string> {
  const disabled = buildDisabledPluginSet(ids);
  for (const pluginId of DEMO_ENABLED_PLUGIN_IDS) {
    disabled.delete(pluginId);
  }
  return disabled;
}

/**
 * Fetches the set of disabled plugin IDs from the plugin data store.
 * On fresh install (no data stored), all plugins are disabled until
 * the user enables them via onboarding or settings.
 */
export function useDisabledPlugins(): Set<string> {
  const { isDemoMode } = useDemoMode();
  const { data } = useSWRImmutable<string[] | null>(
    DISABLED_PLUGINS_CACHE_KEY,
    fetchDisabledPluginIds
  );

  return useMemo(
    () => (isDemoMode ? buildDemoDisabledPluginSet(data) : buildDisabledPluginSet(data)),
    [data, isDemoMode]
  );
}

export function useDisabledPluginsState(): {
  disabledIds: Set<string>;
  isLoading: boolean;
  setPluginEnabled: (pluginId: string, enabled: boolean) => void;
} {
  const { isDemoMode } = useDemoMode();
  const { data, isLoading, mutate } = useSWRImmutable<string[] | null>(
    DISABLED_PLUGINS_CACHE_KEY,
    fetchDisabledPluginIds
  );

  const setPluginEnabled = useCallback(
    (pluginId: string, enabled: boolean) => {
      mutate(
        async (current) => {
          const next = buildDisabledPluginSet(current);
          if (enabled) {
            next.delete(pluginId);
          } else {
            next.add(pluginId);
          }

          const ids = Array.from(next).sort();
          await persistDisabledPluginIds(ids);
          return ids;
        },
        {
          optimisticData: (current) => {
            const next = buildDisabledPluginSet(current);
            if (enabled) {
              next.delete(pluginId);
            } else {
              next.add(pluginId);
            }
            return Array.from(next).sort();
          },
          rollbackOnError: true,
          revalidate: false,
        }
      );
    },
    [mutate]
  );

  return {
    disabledIds: useMemo(
      () => (isDemoMode ? buildDemoDisabledPluginSet(data) : buildDisabledPluginSet(data)),
      [data, isDemoMode]
    ),
    isLoading: data === undefined && isLoading,
    setPluginEnabled,
  };
}

export function useSyncDisabledPluginIdsCache(): (ids: string[]) => Promise<string[] | undefined> {
  const { mutate } = useSWRConfig();

  return useCallback(
    (ids: string[]) =>
      mutate(DISABLED_PLUGINS_CACHE_KEY, ids, {
        populateCache: true,
        revalidate: false,
      }),
    [mutate]
  );
}
