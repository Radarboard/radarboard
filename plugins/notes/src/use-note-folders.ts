"use client";

import type { PluginAPI } from "@radarboard/plugin-sdk/types";
import { useCallback, useEffect, useState } from "react";
import { generateId, normalizeFolder, now } from "./note-operations";
import { DB_KEYS, type NoteFolder } from "./types";

export function useNoteFolders(api: PluginAPI) {
  const [folders, setFolders] = useState<NoteFolder[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const raw = await api.db.get<Array<Record<string, unknown> & { id: string }>>(
        DB_KEYS.folders
      );
      if (cancelled) return;

      const normalized = (raw ?? []).map(normalizeFolder);
      setFolders(normalized);
      setLoaded(true);
    }
    load().catch(() => {
      /* fire-and-forget */
    });
    return () => {
      cancelled = true;
    };
  }, [api]);

  const persist = useCallback(
    async (updated: NoteFolder[]) => {
      setFolders(updated);
      await api.db.set(DB_KEYS.folders, updated);
    },
    [api]
  );

  const addFolder = useCallback(
    async (name: string) => {
      const maxOrder = folders.reduce((max, f) => Math.max(max, f.order), 0);
      const folder: NoteFolder = {
        id: generateId(),
        name,
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

  const updateFolderColor = useCallback(
    async (id: string, color: string | undefined) => {
      const updated = folders.map((f) => (f.id === id ? { ...f, color } : f));
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
    updateFolderColor,
    archiveFolder,
    deleteFolder,
    reorderFolders,
  };
}
