"use client";

import { getPluginToken } from "@radarboard/plugin-sdk/host";
import { getPlugin } from "@radarboard/plugin-sdk/registry";
import type { PluginUserConfig } from "@radarboard/plugin-sdk/types";
import { isPluginNotificationIntegrationEnabled } from "@radarboard/plugin-sdk/types";
import {
  buildStatusPageTransitionNotifications,
  DEFAULT_STATUS_PAGE_REFRESH_INTERVAL_MS,
  mergeStatusPageSources,
  refreshStatusSources,
  resolveStatusPageRefreshIntervalMs,
  STATUS_PAGE_CACHE_KEY,
  STATUS_PAGE_CONFIG_KEY,
  STATUS_PAGE_PREFERENCES_KEY,
  STATUS_PAGE_STANDALONE_SOURCES_KEY,
  type StatusSource,
  type StatusSourcePreferenceMap,
} from "@radarboard/plugin-status-page/statuspage";
import { API_ROUTES, pluginDataRoute } from "@radarboard/types/api-routes";
import { useEffect } from "react";

const PLUGIN_ID = "status-page";

interface StatusPageBackgroundPollerProps {
  isDisabled?: boolean;
  isLoading: boolean;
  projectIntegrations: Record<string, Record<string, unknown>>;
  fetchIntegrationStatusPageOverrides: () => Promise<Record<string, string | null>>;
  deriveProjectHealthSources: (
    projectIntegrations: Record<string, Record<string, unknown>>,
    previousSources: StatusSource[]
  ) => StatusSource[];
  deriveLinkedStatusSources: (
    projectIntegrations: Record<string, Record<string, unknown>>,
    globalStatusPageOverrides: Record<string, string | null>,
    previousSources: StatusSource[]
  ) => StatusSource[];
}

async function readPluginValue<T>(key: string, signal?: AbortSignal): Promise<T | null> {
  const token = await getPluginToken(PLUGIN_ID);
  const response = await fetch(pluginDataRoute(PLUGIN_ID, key), {
    headers: { "X-Plugin-Token": token },
    signal,
  });
  if (!response.ok) return null;

  const data = (await response.json()) as { value?: string | null };
  return data.value ? (JSON.parse(data.value) as T) : null;
}

async function writePluginValue<T>(key: string, value: T, signal?: AbortSignal): Promise<void> {
  const token = await getPluginToken(PLUGIN_ID);
  await fetch(API_ROUTES.pluginData, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Plugin-Token": token,
    },
    signal,
    body: JSON.stringify({
      pluginId: PLUGIN_ID,
      key,
      value: JSON.stringify(value),
    }),
  });
}

async function emitTransitionNotifications(previous: StatusSource[], next: StatusSource[]) {
  const notifications = buildStatusPageTransitionNotifications(previous, next);
  if (notifications.length === 0) return;

  await Promise.allSettled(
    notifications.map((notification) =>
      fetch(API_ROUTES.notificationEmit, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(notification),
      })
    )
  );
}

function resolveNotificationsEnabled(config?: PluginUserConfig | null): boolean {
  if (typeof config?.notificationIntegrationEnabled === "boolean") {
    return config.notificationIntegrationEnabled;
  }

  const descriptor = getPlugin(PLUGIN_ID);
  return descriptor
    ? isPluginNotificationIntegrationEnabled(descriptor, config ?? undefined)
    : true;
}

async function loadPollInputs(
  projectIntegrations: Record<string, Record<string, unknown>>,
  {
    fetchIntegrationStatusPageOverrides,
    deriveProjectHealthSources,
    deriveLinkedStatusSources,
  }: Pick<
    StatusPageBackgroundPollerProps,
    | "fetchIntegrationStatusPageOverrides"
    | "deriveProjectHealthSources"
    | "deriveLinkedStatusSources"
  >
) {
  const [standaloneSources, cachedSources, config, preferences] = await Promise.all([
    readPluginValue<StatusSource[]>(STATUS_PAGE_STANDALONE_SOURCES_KEY),
    readPluginValue<StatusSource[]>(STATUS_PAGE_CACHE_KEY),
    readPluginValue<PluginUserConfig>(STATUS_PAGE_CONFIG_KEY),
    readPluginValue<StatusSourcePreferenceMap>(STATUS_PAGE_PREFERENCES_KEY),
  ]);
  const globalStatusPageOverrides = await fetchIntegrationStatusPageOverrides();

  const previousSources = cachedSources ?? [];
  const projectHealthSources = deriveProjectHealthSources(projectIntegrations, previousSources);
  const linkedSources = deriveLinkedStatusSources(
    projectIntegrations,
    globalStatusPageOverrides,
    previousSources
  );
  const currentSources = mergeStatusPageSources(
    standaloneSources ?? [],
    [
      ...projectHealthSources,
      ...previousSources.filter((source) => source.kind === "standalone"),
      ...linkedSources,
    ],
    preferences ?? {}
  );

  return {
    currentSources,
    previousSources,
    config,
  };
}

async function runPollCycle(
  projectIntegrations: Record<string, Record<string, unknown>>,
  dependencies: Pick<
    StatusPageBackgroundPollerProps,
    | "fetchIntegrationStatusPageOverrides"
    | "deriveProjectHealthSources"
    | "deriveLinkedStatusSources"
  >
) {
  const { currentSources, previousSources, config } = await loadPollInputs(
    projectIntegrations,
    dependencies
  );
  const refreshedSources =
    currentSources.length > 0 ? await refreshStatusSources(currentSources) : [];

  return {
    nextDelay: resolveStatusPageRefreshIntervalMs(config),
    previousSources,
    refreshedSources,
    notificationsEnabled: resolveNotificationsEnabled(config),
  };
}

export function StatusPageBackgroundPoller({
  isDisabled = false,
  isLoading,
  projectIntegrations,
  fetchIntegrationStatusPageOverrides,
  deriveProjectHealthSources,
  deriveLinkedStatusSources,
}: StatusPageBackgroundPollerProps) {
  useEffect(() => {
    if (isDisabled || isLoading) return;

    const controller = new AbortController();
    const { signal } = controller;
    let timeoutId: number | undefined;

    async function run() {
      let nextDelay = DEFAULT_STATUS_PAGE_REFRESH_INTERVAL_MS;

      try {
        const {
          previousSources,
          refreshedSources,
          notificationsEnabled,
          nextDelay: resolvedDelay,
        } = await runPollCycle(projectIntegrations, {
          fetchIntegrationStatusPageOverrides,
          deriveProjectHealthSources,
          deriveLinkedStatusSources,
        });
        nextDelay = resolvedDelay;

        if (!signal.aborted) {
          await writePluginValue(STATUS_PAGE_CACHE_KEY, refreshedSources, signal);
          if (notificationsEnabled) {
            await emitTransitionNotifications(previousSources, refreshedSources);
          }
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        // Keep polling on the next cycle for non-abort errors.
      }

      if (!signal.aborted) {
        timeoutId = window.setTimeout(() => {
          run().catch(() => {
            /* fire-and-forget */
          });
        }, nextDelay);
      }
    }

    run().catch(() => {
      /* fire-and-forget */
    });

    return () => {
      controller.abort();
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [
    deriveLinkedStatusSources,
    deriveProjectHealthSources,
    fetchIntegrationStatusPageOverrides,
    isDisabled,
    isLoading,
    projectIntegrations,
  ]);

  return null;
}
