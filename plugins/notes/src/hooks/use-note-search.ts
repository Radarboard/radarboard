"use client";

import { useMemo } from "react";
import type { FolderSelection, Note } from "../types";

export interface NoteSearchResult {
  note: Note;
  /** Relevance score (higher = better match). 0 = no query, shown by default. */
  score: number;
}

/**
 * Filter and rank notes by folder selection + optional search query.
 *
 * Pinned notes always sort to the top within their group.
 */
function matchesFolder(note: Note, folder: FolderSelection): boolean {
  switch (folder) {
    case "all":
      return note.status === "active";
    case "inbox":
      return note.status === "active" && !note.folderId;
    case "favorites":
      return note.status === "active" && note.pinned;
    case "archive":
      return note.status === "archived";
    case "trash":
      return note.status === "trashed";
    default:
      return note.status === "active" && note.folderId === folder;
  }
}

function scoreNote(note: Note, trimmedQuery: string): number {
  let score = 0;
  const titleLower = note.title.toLowerCase();
  const contentLower = note.content.toLowerCase();

  if (titleLower.includes(trimmedQuery)) {
    score += 3;
    if (titleLower === trimmedQuery) score += 2;
  }

  if (contentLower.includes(trimmedQuery)) {
    score += Math.min(contentLower.split(trimmedQuery).length - 1, 5);
  }

  for (const tag of note.tags) {
    if (tag.toLowerCase().includes(trimmedQuery)) score += 2;
  }

  return score;
}

function compareNoteResults(
  a: NoteSearchResult,
  b: NoteSearchResult,
  folder: FolderSelection,
  trimmed: string,
  sortOrder: "updated" | "created" | "alpha"
): number {
  if (folder !== "trash" && folder !== "archive") {
    if (a.note.pinned && !b.note.pinned) return -1;
    if (!a.note.pinned && b.note.pinned) return 1;
  }

  if (trimmed) return b.score - a.score;

  switch (sortOrder) {
    case "created":
      return new Date(b.note.createdAt).getTime() - new Date(a.note.createdAt).getTime();
    case "alpha":
      return a.note.title.localeCompare(b.note.title);
    default:
      return new Date(b.note.updatedAt).getTime() - new Date(a.note.updatedAt).getTime();
  }
}

export function useNoteSearch(
  notes: Note[],
  selectedFolder: FolderSelection,
  query: string,
  sortOrder: "updated" | "created" | "alpha" = "updated"
): NoteSearchResult[] {
  return useMemo(() => {
    const folderFiltered = notes.filter((n) => matchesFolder(n, selectedFolder));
    const trimmed = query.trim().toLowerCase();
    const results: NoteSearchResult[] = [];

    for (const note of folderFiltered) {
      if (!trimmed) {
        results.push({ note, score: 0 });
        continue;
      }
      const score = scoreNote(note, trimmed);
      if (score > 0) results.push({ note, score });
    }

    results.sort((a, b) => compareNoteResults(a, b, selectedFolder, trimmed, sortOrder));
    return results;
  }, [notes, selectedFolder, query, sortOrder]);
}

/**
 * Highlight search matches in a string by wrapping them in <mark> tags.
 * Returns an array of React-safe segments.
 */
export function highlightMatches(
  text: string,
  query: string
): Array<{ text: string; highlighted: boolean }> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return [{ text, highlighted: false }];

  const lowerText = text.toLowerCase();
  const lowerQuery = trimmedQuery.toLowerCase();
  const segments = buildHighlightSegments(text, lowerText, lowerQuery);

  return segments.length > 0 ? segments : [{ text, highlighted: false }];
}

function buildHighlightSegments(
  text: string,
  lowerText: string,
  lowerQuery: string
): Array<{ text: string; highlighted: boolean }> {
  const segments: Array<{ text: string; highlighted: boolean }> = [];
  let lastIndex = 0;
  let idx = lowerText.indexOf(lowerQuery, lastIndex);

  while (idx !== -1) {
    if (idx > lastIndex) {
      segments.push({ text: text.slice(lastIndex, idx), highlighted: false });
    }
    segments.push({ text: text.slice(idx, idx + lowerQuery.length), highlighted: true });
    lastIndex = idx + lowerQuery.length;
    idx = lowerText.indexOf(lowerQuery, lastIndex);
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), highlighted: false });
  }
  return segments;
}
