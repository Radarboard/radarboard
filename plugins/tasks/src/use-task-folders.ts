"use client";

import type { PluginAPI } from "@radarboard/plugin-sdk/types";
import { useCallback, useEffect, useState } from "react";
import {
  generateFolderId,
  normalizeFolder,
  now,
  syncFoldersWithProjects,
} from "./folder-operations";
import type { TaskFolder } from "./types";

const DB_KEY = "tasks:folders";

export function useTaskFolders(api: PluginAPI) {
  const [folders, setFolders] = useState<TaskFolder[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Load folders and sync with app projects
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [raw, projects] = await Promise.all([
        api.db.get<Array<Record<string, unknown> & { id: string }>>(DB_KEY),
        api.projects.list(),
      ]);
      if (cancelled) return;

      const existing = (raw ?? []).map(normalizeFolder);
      const { folders: synced, changed } = syncFoldersWithProjects(existing, projects);

      setFolders(synced);
      setLoaded(true);

      if (changed) {
        await api.db.set(DB_KEY, synced);
      }
    }
    load().catch(() => {
      /* fire-and-forget */
    });
    return () => {
      cancelled = true;
    };
  }, [api]);

  const persist = useCallback(
    async (updated: TaskFolder[]) => {
      setFolders(updated);
      await api.db.set(DB_KEY, updated);
    },
    [api]
  );

  const addFolder = useCallback(
    async (name: string) => {
      const maxOrder = folders.reduce((max, f) => Math.max(max, f.order), 0);
      const folder: TaskFolder = {
        id: generateFolderId(),
        name,
        type: "custom",
        archived: false,
        order: maxOrder + 1,
        createdAt: now(),
      };
      await persist([...folders, folder]);
      return folder;
    },
    [folders, persist]
  );

  const renameFolder = useCallback(
    async (id: string, name: string) => {
      const updated = folders.map((f) => (f.id === id ? { ...f, name } : f));
      await persist(updated);
    },
    [folders, persist]
  );

  const archiveFolder = useCallback(
    async (id: string) => {
      const updated = folders.map((f) => (f.id === id ? { ...f, archived: true } : f));
      await persist(updated);
    },
    [folders, persist]
  );

  const deleteFolder = useCallback(
    async (id: string) => {
      const updated = folders.filter((f) => f.id !== id);
      await persist(updated);
    },
    [folders, persist]
  );

  const reorderFolders = useCallback(
    async (orderedIds: string[]) => {
      const updated = folders.map((f) => {
        const idx = orderedIds.indexOf(f.id);
        return idx >= 0 ? { ...f, order: idx } : f;
      });
      await persist(updated);
    },
    [folders, persist]
  );

  return {
    folders,
    loaded,
    addFolder,
    renameFolder,
    archiveFolder,
    deleteFolder,
    reorderFolders,
  };
}
