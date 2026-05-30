"use client";

import type { PluginAPI } from "@radarboard/plugin-sdk/types";
import { pluginRoute } from "@radarboard/types/api-routes";
import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { CHANGELOG_DB_KEYS, CHANGELOG_SYNC_INTERVAL_MS } from "./model";
import type { ChangelogEntryMetaMap, ChangelogState, PackageWatch } from "./types";

const EMPTY_STATE: ChangelogState = {
  targets: [],
  watches: [],
  trackedPackages: [],
  entries: [],
  entryMeta: {},
  syncState: {
    lastRunAt: null,
    lastSuccessAt: null,
    activeWatchCount: 0,
  },
};

interface RouteResponse extends ChangelogState {
  ok?: boolean;
  error?: string;
}

async function readRoute(): Promise<ChangelogState> {
  const response = await fetch(pluginRoute("changelog", "state"));
  const data = (await response.json()) as RouteResponse;
  if (!response.ok || data.ok === false) {
    throw new Error(data.error ?? "Failed to load changelog state");
  }

  return {
    targets: data.targets ?? [],
    watches: data.watches ?? [],
    trackedPackages: data.trackedPackages ?? [],
    entries: data.entries ?? [],
    entryMeta: data.entryMeta ?? {},
    syncState: data.syncState ?? EMPTY_STATE.syncState,
  };
}

async function postRoute<T>(url: string, payload: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await response.json()) as T & { ok?: boolean; error?: string };
  if (!response.ok || data.ok === false) {
    throw new Error(data.error ?? `Request failed: ${url}`);
  }
  return data;
}

function makeWatchId(projectSlug: string, platformId: string, packageName: string): string {
  return `${projectSlug}:${platformId}:${packageName}`;
}

export function useChangelog(api: PluginAPI) {
  const [state, setState] = useState<ChangelogState>(EMPTY_STATE);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const autoSyncRef = useRef(false);

  const reload = useCallback(async () => {
    const next = await readRoute();
    startTransition(() => {
      setState(next);
      setLoaded(true);
      setError(null);
    });
    return next;
  }, []);

  useEffect(() => {
    let cancelled = false;

    readRoute()
      .then((next) => {
        if (cancelled) return;
        startTransition(() => {
          setState(next);
          setLoaded(true);
        });
      })
      .catch((nextError) => {
        if (cancelled) return;
        setError(nextError instanceof Error ? nextError.message : "Failed to load changelog");
        setLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const persistWatches = useCallback(
    async (nextWatches: PackageWatch[]) => {
      await api.db.set(CHANGELOG_DB_KEYS.watches, nextWatches);
      await reload();
    },
    [api.db, reload]
  );

  const sync = useCallback(
    async (force = false) => {
      setIsSyncing(true);
      try {
        const next = await postRoute<RouteResponse>(pluginRoute("changelog", "sync"), { force });
        startTransition(() => {
          setState((prev) => ({
            targets: next.targets ?? [],
            watches: next.watches ?? [],
            trackedPackages: next.trackedPackages ?? [],
            entries: next.entries ?? [],
            entryMeta: next.entryMeta ?? prev.entryMeta,
            syncState: next.syncState ?? EMPTY_STATE.syncState,
          }));
          setError(null);
        });
        return next;
      } catch (nextError) {
        const message =
          nextError instanceof Error ? nextError.message : "Failed to sync changelog releases";
        setError(message);
        api.notify(message, "error");
        throw nextError;
      } finally {
        setIsSyncing(false);
      }
    },
    [api]
  );

  useEffect(() => {
    if (!loaded || autoSyncRef.current) return;
    if (state.watches.every((watch) => watch.status === "disabled")) return;

    const lastSuccessAt = state.syncState.lastSuccessAt;
    const shouldSync =
      !lastSuccessAt || Date.now() - Date.parse(lastSuccessAt) >= CHANGELOG_SYNC_INTERVAL_MS;
    if (!shouldSync) return;

    autoSyncRef.current = true;

    // Defer sync so the initial render isn't disrupted by a state update.
    const run = () => {
      sync(false).catch(() => undefined);
    };
    if (typeof globalThis.requestIdleCallback === "function") {
      const id = globalThis.requestIdleCallback(run);
      return () => globalThis.cancelIdleCallback(id);
    }
    const timer = setTimeout(run, 3_000);
    return () => clearTimeout(timer);
  }, [loaded, state.syncState.lastSuccessAt, state.watches, sync]);

  const importDependencies = useCallback(
    async (projectSlug: string, platformId: string) => {
      setIsSyncing(true);
      try {
        const next = await postRoute<RouteResponse>(pluginRoute("changelog", "import"), {
          projectSlug,
          platformId,
        });
        startTransition(() => {
          setState((prev) => ({
            targets: next.targets ?? [],
            watches: next.watches ?? [],
            trackedPackages: next.trackedPackages ?? [],
            entries: next.entries ?? [],
            entryMeta: next.entryMeta ?? prev.entryMeta,
            syncState: next.syncState ?? EMPTY_STATE.syncState,
          }));
          setError(null);
        });
        api.notify("Dependencies imported", "success");
      } catch (nextError) {
        const message =
          nextError instanceof Error ? nextError.message : "Failed to import dependencies";
        setError(message);
        api.notify(message, "error");
        throw nextError;
      } finally {
        setIsSyncing(false);
      }
    },
    [api]
  );

  const addManualWatch = useCallback(
    async (input: { projectSlug: string; platformId: string; packageName: string }) => {
      const target = state.targets.find(
        (candidate) =>
          candidate.projectSlug === input.projectSlug && candidate.platformId === input.platformId
      );
      if (!target) {
        throw new Error("Select a valid project/platform target");
      }

      const packageName = input.packageName.trim();
      if (!packageName) {
        throw new Error("Package name is required");
      }

      const nextWatches = [...state.watches];
      const id = makeWatchId(input.projectSlug, input.platformId, packageName);
      const existingIndex = nextWatches.findIndex((watch) => watch.id === id);
      const existingWatch: PackageWatch | null =
        existingIndex >= 0 ? (nextWatches[existingIndex] ?? null) : null;

      const nextWatch: PackageWatch = existingWatch
        ? {
            ...existingWatch,
            packageName,
            status: "active",
            updatedAt: new Date().toISOString(),
          }
        : {
            id,
            projectSlug: target.projectSlug,
            projectName: target.projectName,
            platformId: target.platformId,
            platformName: target.platformName,
            packageName,
            source: "manual",
            status: "active",
            includePrereleases: false,
            createdAt: new Date().toISOString(),
            lastImportedAt: null,
            updatedAt: new Date().toISOString(),
          };

      if (existingIndex >= 0) {
        nextWatches.splice(existingIndex, 1, nextWatch);
      } else {
        nextWatches.push(nextWatch);
      }

      await persistWatches(nextWatches);
      await sync(true);
      api.notify("Manual package added", "success");
    },
    [api, persistWatches, state.targets, state.watches, sync]
  );

  const updateWatch = useCallback(
    async (watchId: string, updater: (watch: PackageWatch) => PackageWatch | null) => {
      const nextWatches = state.watches.flatMap((watch) => {
        if (watch.id !== watchId) return [watch];
        const next = updater(watch);
        return next ? [next] : [];
      });
      await persistWatches(nextWatches);
    },
    [persistWatches, state.watches]
  );

  const setWatchStatus = useCallback(
    async (watchId: string, status: PackageWatch["status"]) => {
      await updateWatch(watchId, (watch) => ({
        ...watch,
        status,
        updatedAt: new Date().toISOString(),
      }));
    },
    [updateWatch]
  );

  const togglePrereleases = useCallback(
    async (watchId: string) => {
      let nextIncludePrereleases = false;

      await updateWatch(watchId, (watch) => {
        nextIncludePrereleases = !watch.includePrereleases;
        return {
          ...watch,
          includePrereleases: nextIncludePrereleases,
          updatedAt: new Date().toISOString(),
        };
      });

      if (nextIncludePrereleases) {
        await sync(true);
      } else {
        await reload();
      }
    },
    [reload, sync, updateWatch]
  );

  const removeWatch = useCallback(
    async (watchId: string) => {
      await updateWatch(watchId, () => null);
      api.notify("Package removed", "success");
    },
    [api, updateWatch]
  );

  const persistEntryMeta = useCallback(
    async (nextMeta: ChangelogEntryMetaMap) => {
      const entryIdSet = new Set(state.entries.map((entry) => entry.id));
      const pruned = Object.fromEntries(
        Object.entries(nextMeta).filter(([id]) => entryIdSet.has(id))
      );
      await api.db.set(CHANGELOG_DB_KEYS.entryMeta, pruned);
      setState((prev) => ({ ...prev, entryMeta: pruned }));
    },
    [api.db, state.entries]
  );

  const markRead = useCallback(
    async (entryId: string) => {
      if (state.entryMeta[entryId]?.readAt) return;
      const next = { ...state.entryMeta };
      next[entryId] = {
        readAt: new Date().toISOString(),
        archivedAt: next[entryId]?.archivedAt ?? null,
      };
      await persistEntryMeta(next);
    },
    [state.entryMeta, persistEntryMeta]
  );

  const markUnread = useCallback(
    async (entryId: string) => {
      const existing = state.entryMeta[entryId];
      if (!existing?.readAt) return;
      const next = { ...state.entryMeta };
      next[entryId] = { ...existing, readAt: null };
      await persistEntryMeta(next);
    },
    [state.entryMeta, persistEntryMeta]
  );

  const archiveEntry = useCallback(
    async (entryId: string) => {
      const next = { ...state.entryMeta };
      next[entryId] = {
        readAt: next[entryId]?.readAt ?? new Date().toISOString(),
        archivedAt: new Date().toISOString(),
      };
      await persistEntryMeta(next);
    },
    [state.entryMeta, persistEntryMeta]
  );

  const unarchiveEntry = useCallback(
    async (entryId: string) => {
      const existing = state.entryMeta[entryId];
      if (!existing?.archivedAt) return;
      const next = { ...state.entryMeta };
      next[entryId] = { ...existing, archivedAt: null };
      await persistEntryMeta(next);
    },
    [state.entryMeta, persistEntryMeta]
  );

  const markAllRead = useCallback(
    async (entryIds: string[]) => {
      const next = { ...state.entryMeta };
      const now = new Date().toISOString();
      for (const id of entryIds) {
        if (!next[id]?.readAt) {
          next[id] = {
            readAt: now,
            archivedAt: next[id]?.archivedAt ?? null,
          };
        }
      }
      await persistEntryMeta(next);
    },
    [state.entryMeta, persistEntryMeta]
  );

  return {
    ...state,
    loaded,
    error,
    isSyncing,
    reload,
    sync,
    importDependencies,
    addManualWatch,
    setWatchStatus,
    togglePrereleases,
    removeWatch,
    markRead,
    markUnread,
    archiveEntry,
    unarchiveEntry,
    markAllRead,
  };
}
