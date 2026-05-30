"use client";

import type { PluginAPI } from "@radarboard/plugin-sdk/types";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  mergeStatusPageSources,
  refreshStatusSources,
  replaceStandaloneEntriesInCache,
  STATUS_PAGE_CACHE_KEY,
  STATUS_PAGE_PREFERENCES_KEY,
  STATUS_PAGE_STANDALONE_SOURCES_KEY,
  STATUS_PAGE_UI_SYNC_INTERVAL_MS,
  type StatusSourcePreferenceMap,
} from "./statuspage";
import type { StatusSource } from "./types";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function now(): string {
  return new Date().toISOString();
}

export function useStatusPage(api: PluginAPI) {
  const [sources, setSources] = useState<StatusSource[]>([]);
  const [loaded, setLoaded] = useState(false);
  const isMountedRef = useRef(false);
  const standaloneSourcesRef = useRef<StatusSource[]>([]);
  const cachedSourcesRef = useRef<StatusSource[]>([]);
  const preferencesRef = useRef<StatusSourcePreferenceMap>({});

  const updateSourcesState = useCallback((updated: StatusSource[]) => {
    if (isMountedRef.current) {
      setSources(updated);
    }
  }, []);

  const loadStoredSources = useCallback(async () => {
    const [standaloneSources, cachedSources, preferences] = await Promise.all([
      api.db.get<StatusSource[]>(STATUS_PAGE_STANDALONE_SOURCES_KEY),
      api.db.get<StatusSource[]>(STATUS_PAGE_CACHE_KEY),
      api.db.get<StatusSourcePreferenceMap>(STATUS_PAGE_PREFERENCES_KEY),
    ]);
    standaloneSourcesRef.current = standaloneSources ?? [];
    cachedSourcesRef.current = cachedSources ?? [];
    preferencesRef.current = preferences ?? {};
    const mergedSources = mergeStatusPageSources(
      standaloneSourcesRef.current,
      cachedSourcesRef.current,
      preferencesRef.current
    );
    updateSourcesState(mergedSources);
    return mergedSources;
  }, [api, updateSourcesState]);

  useEffect(() => {
    isMountedRef.current = true;
    let intervalId: number | undefined;

    async function load() {
      try {
        await loadStoredSources();
        if (!isMountedRef.current) return;
        setLoaded(true);

        intervalId = window.setInterval(() => {
          loadStoredSources().catch(() => {
            /* fire-and-forget */
          });
        }, STATUS_PAGE_UI_SYNC_INTERVAL_MS);
      } catch {
        if (isMountedRef.current) {
          setLoaded(true);
        }
      }
    }

    load().catch(() => {
      /* fire-and-forget */
    });

    return () => {
      isMountedRef.current = false;
      if (intervalId !== undefined) {
        window.clearInterval(intervalId);
      }
    };
  }, [loadStoredSources]);

  const persistSources = useCallback(
    async (updated: StatusSource[]) => {
      standaloneSourcesRef.current = updated;
      await Promise.all([
        api.db.set(STATUS_PAGE_STANDALONE_SOURCES_KEY, updated),
        api.db.set(
          STATUS_PAGE_CACHE_KEY,
          replaceStandaloneEntriesInCache(cachedSourcesRef.current, updated)
        ),
      ]);
      cachedSourcesRef.current = replaceStandaloneEntriesInCache(cachedSourcesRef.current, updated);
      updateSourcesState(
        mergeStatusPageSources(updated, cachedSourcesRef.current, preferencesRef.current)
      );
    },
    [api, updateSourcesState]
  );

  const persistPreferences = useCallback(
    async (updated: StatusSourcePreferenceMap) => {
      preferencesRef.current = updated;
      await api.db.set(STATUS_PAGE_PREFERENCES_KEY, updated);
      updateSourcesState(
        mergeStatusPageSources(
          standaloneSourcesRef.current,
          cachedSourcesRef.current,
          preferencesRef.current
        )
      );
    },
    [api, updateSourcesState]
  );

  const addSource = useCallback(
    async (input: { name: string; url: string; statusPageUrl?: string }) => {
      const source: StatusSource = {
        id: generateId(),
        kind: "standalone",
        name: input.name,
        url: input.url,
        statusPageUrl: input.statusPageUrl,
        status: "unknown",
        lastCheckedAt: now(),
        addedAt: now(),
        alertsEnabled: true,
        remoteUpdatedAt: null,
        projectSlug: null,
        projectName: null,
        platformId: null,
        platformName: null,
        integrationKey: null,
      };
      const [refreshedSource] = await refreshStatusSources([source]);
      const updated = [...standaloneSourcesRef.current, refreshedSource ?? source];
      await persistSources(updated);
      return refreshedSource ?? source;
    },
    [persistSources]
  );

  const removeSource = useCallback(
    async (id: string) => {
      const updated = standaloneSourcesRef.current.filter((s) => s.id !== id);
      await persistSources(updated);
    },
    [persistSources]
  );

  const toggleSourceMuted = useCallback(
    async (id: string) => {
      const current = preferencesRef.current[id] ?? {};
      await persistPreferences({
        ...preferencesRef.current,
        [id]: {
          ...current,
          muted: !(current.muted ?? false),
        },
      });
    },
    [persistPreferences]
  );

  const toggleSourceDisabled = useCallback(
    async (id: string) => {
      const current = preferencesRef.current[id] ?? {};
      await persistPreferences({
        ...preferencesRef.current,
        [id]: {
          ...current,
          disabled: !(current.disabled ?? false),
        },
      });
    },
    [persistPreferences]
  );

  const activeSources = sources.filter((source) => !source.disabled);
  const operationalCount = activeSources.filter((s) => s.status === "operational").length;
  const totalCount = activeSources.length;

  return {
    sources,
    loaded,
    addSource,
    removeSource,
    toggleSourceMuted,
    toggleSourceDisabled,
    operationalCount,
    totalCount,
  };
}
