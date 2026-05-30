"use client";

import { getPluginToken } from "@radarboard/plugin-sdk/host";
import { getAllPlugins } from "@radarboard/plugin-sdk/registry";
import type { PluginUserConfig } from "@radarboard/plugin-sdk/types";
import { API_ROUTES, pluginDataRoute } from "@radarboard/types/api-routes";
import { useCallback, useMemo } from "react";
import useSWRImmutable from "swr/immutable";

const CONFIG_KEY = "_config";
const PLUGIN_CONFIGS_CACHE_KEY = "plugin-configs";

type PluginConfigRecord = Record<string, PluginUserConfig>;

async function fetchPluginConfig(pluginId: string): Promise<PluginUserConfig> {
  try {
    const token = await getPluginToken(pluginId);
    const res = await fetch(pluginDataRoute(pluginId, CONFIG_KEY), {
      headers: { "X-Plugin-Token": token },
    });
    if (!res.ok) return {};

    const data = (await res.json()) as { value?: string | null };
    return data.value ? (JSON.parse(data.value) as PluginUserConfig) : {};
  } catch {
    return {};
  }
}

async function fetchAllPluginConfigs(): Promise<PluginConfigRecord> {
  const plugins = getAllPlugins();
  if (plugins.length === 0) return {};

  const entries = await Promise.all(
    plugins.map(async (plugin) => [plugin.id, await fetchPluginConfig(plugin.id)] as const)
  );

  return Object.fromEntries(entries);
}

async function persistPluginConfig(pluginId: string, config: PluginUserConfig): Promise<void> {
  const token = await getPluginToken(pluginId);
  const res = await fetch(API_ROUTES.pluginData, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Plugin-Token": token,
    },
    body: JSON.stringify({
      pluginId,
      key: CONFIG_KEY,
      value: JSON.stringify(config),
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to save plugin config: ${res.status}`);
  }
}

/**
 * Fetches user config for all registered plugins.
 * Returns a Map<pluginId, PluginUserConfig>.
 */
export function usePluginConfigs(): Map<string, PluginUserConfig> {
  const { data } = useSWRImmutable<PluginConfigRecord>(
    PLUGIN_CONFIGS_CACHE_KEY,
    fetchAllPluginConfigs
  );

  return useMemo(() => new Map(Object.entries(data ?? {})), [data]);
}

export function usePluginConfigState(pluginId: string): {
  config: PluginUserConfig;
  isLoading: boolean;
  updateConfig: (updater: (prev: PluginUserConfig) => PluginUserConfig) => void;
} {
  const { data, isLoading, mutate } = useSWRImmutable<PluginConfigRecord>(
    PLUGIN_CONFIGS_CACHE_KEY,
    fetchAllPluginConfigs
  );

  const updateConfig = useCallback(
    (updater: (prev: PluginUserConfig) => PluginUserConfig) => {
      const applyUpdater = (current: PluginConfigRecord | undefined): PluginConfigRecord => {
        const nextConfig = updater(current?.[pluginId] ?? {});
        return {
          ...(current ?? {}),
          [pluginId]: nextConfig,
        };
      };

      mutate(
        async (current) => {
          const next = applyUpdater(current);
          await persistPluginConfig(pluginId, next[pluginId] ?? {});
          return next;
        },
        {
          optimisticData: (current) => applyUpdater(current),
          rollbackOnError: true,
          revalidate: false,
        }
      );
    },
    [mutate, pluginId]
  );

  return {
    config: data?.[pluginId] ?? {},
    isLoading: data === undefined && isLoading,
    updateConfig,
  };
}

export function useUpdatePluginConfig(): (
  pluginId: string,
  updater: (prev: PluginUserConfig) => PluginUserConfig
) => void {
  const { mutate } = useSWRImmutable<PluginConfigRecord>(
    PLUGIN_CONFIGS_CACHE_KEY,
    fetchAllPluginConfigs
  );

  return useCallback(
    (pluginId, updater) => {
      const applyUpdater = (current: PluginConfigRecord | undefined): PluginConfigRecord => {
        const nextConfig = updater(current?.[pluginId] ?? {});
        return {
          ...(current ?? {}),
          [pluginId]: nextConfig,
        };
      };

      mutate(
        async (current) => {
          const next = applyUpdater(current);
          await persistPluginConfig(pluginId, next[pluginId] ?? {});
          return next;
        },
        {
          optimisticData: (current) => applyUpdater(current),
          rollbackOnError: true,
          revalidate: false,
        }
      );
    },
    [mutate]
  );
}
