"use client";

import { useDemoMode } from "@radarboard/hooks/use-demo-mode";
import type { PluginAPI } from "@radarboard/plugin-sdk/types";
import { useCallback, useEffect, useState } from "react";
import { countWords, generateId, normalizeNote, now } from "./note-operations";
import { DB_KEYS, type Note } from "./types";

const CURRENT_SCHEMA_VERSION = 2;

const DEMO_NOTES: Note[] = [
  {
    id: "demo-1",
    title: "Sprint 14 retrospective",
    content:
      "## What went well\n- Shipped revenue widget ahead of schedule\n- Zero regressions in SEO module\n\n## What to improve\n- PR review turnaround still slow",
    contentFormat: "markdown",
    tags: ["sprint", "retro"],
    status: "active",
    pinned: true,
    wordCount: 25,
    folderId: undefined,
    trashedAt: null,
    archivedAt: null,
    createdAt: "2026-03-25T15:00:00Z",
    updatedAt: "2026-03-25T15:00:00Z",
  },
  {
    id: "demo-2",
    title: "API design decisions",
    content: "### Webhook payload format\nUsing CloudEvents spec for all webhook payloads.",
    contentFormat: "markdown",
    tags: ["api", "design"],
    status: "active",
    pinned: false,
    wordCount: 12,
    folderId: undefined,
    trashedAt: null,
    archivedAt: null,
    createdAt: "2026-03-24T10:00:00Z",
    updatedAt: "2026-03-24T10:00:00Z",
  },
  {
    id: "demo-3",
    title: "Onboarding flow ideas",
    content: "- Show demo data first\n- Badge in header\n- One-click transition to real setup",
    contentFormat: "markdown",
    tags: ["product"],
    status: "active",
    pinned: false,
    wordCount: 16,
    folderId: undefined,
    trashedAt: null,
    archivedAt: null,
    createdAt: "2026-03-23T08:00:00Z",
    updatedAt: "2026-03-23T08:00:00Z",
  },
];

export function useNotes(api: PluginAPI) {
  const { isDemoMode } = useDemoMode();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Load & migrate --------------------------------------------------------
  useEffect(() => {
    if (isDemoMode) {
      setNotes(DEMO_NOTES);
      setLoaded(true);
      return;
    }
    let cancelled = false;
    async function load() {
      const [raw, version] = await Promise.all([
        api.db.get<Array<Record<string, unknown> & { id: string }>>(DB_KEYS.notes),
        api.db.get<number>(DB_KEYS.schemaVersion),
      ]);
      if (cancelled) return;

      if (!raw) {
        setLoaded(true);
        return;
      }

      const migrated = raw.map(normalizeNote);
      setNotes(migrated);
      setLoaded(true);

      // Persist migration if schema version changed
      if ((version ?? 1) < CURRENT_SCHEMA_VERSION) {
        await api.db.set(DB_KEYS.notes, migrated);
        await api.db.set(DB_KEYS.schemaVersion, CURRENT_SCHEMA_VERSION);
      }
    }
    load().catch(() => {
      /* fire-and-forget */
    });
    return () => {
      cancelled = true;
    };
  }, [api, isDemoMode]);

  // Persist helper --------------------------------------------------------
  const persistNotes = useCallback(
    async (updated: Note[]) => {
      if (isDemoMode) return;
      setNotes(updated);
      await api.db.set(DB_KEYS.notes, updated);
    },
    [api, isDemoMode]
  );

  // CRUD ------------------------------------------------------------------
  const addNote = useCallback(
    async (input: {
      title: string;
      content?: string;
      tags?: string[];
      folderId?: string;
      pinned?: boolean;
    }) => {
      const content = input.content ?? "";
      const note: Note = {
        id: generateId(),
        title: input.title,
        content,
        contentFormat: "markdown",
        tags: input.tags ?? [],
        folderId: input.folderId,
        status: "active",
        pinned: input.pinned ?? false,
        wordCount: countWords(content),
        trashedAt: null,
        archivedAt: null,
        createdAt: now(),
        updatedAt: now(),
      };
      const updated = [...notes, note];
      await persistNotes(updated);
      return note;
    },
    [notes, persistNotes]
  );

  const updateNote = useCallback(
    async (
      id: string,
      changes: Partial<
        Pick<
          Note,
          | "title"
          | "content"
          | "tags"
          | "folderId"
          | "pinned"
          | "status"
          | "trashedAt"
          | "archivedAt"
        >
      >
    ) => {
      const updated = notes.map((n) => {
        if (n.id !== id) return n;
        const merged = { ...n, ...changes, updatedAt: now() };
        // Recompute word count if content changed
        if (changes.content !== undefined) {
          merged.wordCount = countWords(changes.content);
        }
        return merged;
      });
      await persistNotes(updated);
    },
    [notes, persistNotes]
  );

  const deleteNote = useCallback(
    async (id: string) => {
      const updated = notes.filter((n) => n.id !== id);
      await persistNotes(updated);
    },
    [notes, persistNotes]
  );

  // Status operations -----------------------------------------------------
  const pinNote = useCallback(
    async (id: string) => {
      const note = notes.find((n) => n.id === id);
      if (!note) return;
      await updateNote(id, { pinned: !note.pinned });
    },
    [notes, updateNote]
  );

  const archiveNote = useCallback(
    async (id: string) => {
      await updateNote(id, { status: "archived", archivedAt: now() });
    },
    [updateNote]
  );

  const trashNote = useCallback(
    async (id: string) => {
      await updateNote(id, { status: "trashed", trashedAt: now() });
    },
    [updateNote]
  );

  const restoreNote = useCallback(
    async (id: string) => {
      await updateNote(id, { status: "active", trashedAt: null, archivedAt: null });
    },
    [updateNote]
  );

  const moveToFolder = useCallback(
    async (id: string, folderId: string | undefined) => {
      await updateNote(id, { folderId });
    },
    [updateNote]
  );

  return {
    notes,
    loaded,
    addNote,
    updateNote,
    deleteNote,
    pinNote,
    archiveNote,
    trashNote,
    restoreNote,
    moveToFolder,
  };
}
