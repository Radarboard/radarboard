"use client";

import type { PluginAPI } from "@radarboard/plugin-sdk/types";
import { useCallback, useEffect, useState } from "react";
import { generateId, now, pruneSnapshots } from "../note-operations";
import { DB_KEYS, type NoteSnapshot } from "../types";

export function useNoteSnapshots(api: PluginAPI) {
  const [snapshots, setSnapshots] = useState<NoteSnapshot[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const raw = await api.db.get<NoteSnapshot[]>(DB_KEYS.snapshots);
      if (cancelled) return;
      setSnapshots(raw ?? []);
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
    async (updated: NoteSnapshot[]) => {
      setSnapshots(updated);
      await api.db.set(DB_KEYS.snapshots, updated);
    },
    [api]
  );

  const createSnapshot = useCallback(
    async (noteId: string, title: string, content: string) => {
      const snapshot: NoteSnapshot = {
        id: generateId(),
        noteId,
        title,
        content,
        createdAt: now(),
      };
      const updated = pruneSnapshots([...snapshots, snapshot], noteId);
      await persist(updated);
      return snapshot;
    },
    [snapshots, persist]
  );

  const getSnapshotsForNote = useCallback(
    (noteId: string) =>
      snapshots
        .filter((s) => s.noteId === noteId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [snapshots]
  );

  const deleteSnapshot = useCallback(
    async (snapshotId: string) => {
      const updated = snapshots.filter((s) => s.id !== snapshotId);
      await persist(updated);
    },
    [snapshots, persist]
  );

  return {
    snapshots,
    loaded,
    createSnapshot,
    getSnapshotsForNote,
    deleteSnapshot,
  };
}
