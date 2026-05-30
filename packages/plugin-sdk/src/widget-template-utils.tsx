"use client";

/**
 * Shared utilities for plugin widget template resolvers.
 *
 * These are used by each plugin's widget-contribution module to fetch
 * plugin data and report state to the template engine.
 */

import { pluginDataRoute } from "@radarboard/types/api-routes";
import type { PollingSourceId } from "@radarboard/types/polling";
import { usePollingInterval } from "@radarboard/widget-engine/hooks/use-polling-interval";
import {
  buildTemplateRecipe,
  type DataSourceResolverProps,
  type TemplateRecipeModel,
  type WidgetTemplateConfig,
} from "@radarboard/widget-engine/templates";
import useSWR from "swr";
import { getPluginToken } from "./host";

interface StoredValueResponse {
  value?: string | null;
  error?: string;
}

function buildPluginDataUrl(pluginId: string, key: string): string {
  return pluginDataRoute(pluginId, key);
}

async function fetchStoredValue<T>(pluginId: string, key: string): Promise<T | null> {
  const token = await getPluginToken(pluginId);
  const response = await fetch(buildPluginDataUrl(pluginId, key), {
    headers: { "X-Plugin-Token": token },
  });
  const data = (await response.json().catch(() => ({}))) as StoredValueResponse;
  if (!response.ok) {
    throw new Error(
      data.error ??
        `Failed to read plugin data for ${pluginId}/${key} (${response.status} ${response.statusText})`
    );
  }
  return data.value ? (JSON.parse(data.value) as T) : null;
}

export function useStoredValue<T>(pluginId: string, key: string, sourceId: PollingSourceId) {
  const refreshInterval = usePollingInterval(sourceId);
  return useSWR<T | null>(
    buildPluginDataUrl(pluginId, key),
    () => fetchStoredValue<T>(pluginId, key),
    {
      refreshInterval,
    }
  );
}

export function usePluginPollingInterval(sourceId: PollingSourceId): number {
  return usePollingInterval(sourceId);
}

export function reportState(
  onState: DataSourceResolverProps["onState"],
  state: {
    data: unknown;
    fetchedAt: number | null;
    refetch: (() => Promise<void>) | null;
    loading: boolean;
    error: string | null;
  }
) {
  onState(state);
}

export function relativeTimeLabel(value: string | number): string {
  const target = typeof value === "number" ? value : Date.parse(value);
  if (!Number.isFinite(target)) return "unknown";

  const diff = Date.now() - target;
  const minutes = Math.max(1, Math.floor(diff / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function createTemplateConfig(
  recipe: TemplateRecipeModel,
  dataSourceId: string
): WidgetTemplateConfig {
  return {
    dataSources: [{ id: dataSourceId }],
    recipe,
    sections: buildTemplateRecipe(recipe),
    expandedRecipe: recipe,
    expandedSections: buildTemplateRecipe(recipe),
  };
}

export type { DataSourceResolverProps, TemplateRecipeModel, WidgetTemplateConfig };
