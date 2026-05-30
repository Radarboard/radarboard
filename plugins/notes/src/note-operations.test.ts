import { describe, expect, it } from "vitest";
import {
  computeNoteCounts,
  countWords,
  looksLikeHtml,
  normalizeFolder,
  normalizeNote,
  pruneSnapshots,
  stripHtmlToPlaintext,
} from "./note-operations";
import type { Note, NoteSnapshot } from "./types";

describe("note operations", () => {
  it("counts markdown words while ignoring basic syntax", () => {
    expect(countWords("## Heading\n\nSome **bold** text and `code`")).toBe(5);
    expect(countWords("")).toBe(0);
  });

  it("detects html content and converts it to plain markdown-like text", () => {
    expect(looksLikeHtml("<p>Hello</p>")).toBe(true);
    expect(looksLikeHtml("Plain markdown")).toBe(false);
    expect(stripHtmlToPlaintext("<h2>Title</h2><p>Hello <strong>world</strong></p>")).toBe(
      "## Title\n\nHello **world**"
    );
  });

  it("normalizes legacy notes and folders", () => {
    const note = normalizeNote({
      id: "note-1",
      title: "Migrated",
      content: "<p>Hello</p>",
      tags: ["docs"],
    });
    const folder = normalizeFolder({ id: "folder-1" });

    expect(note.contentFormat).toBe("markdown");
    expect(note.content).toBe("Hello");
    expect(note.wordCount).toBe(1);
    expect(folder).toMatchObject({
      id: "folder-1",
      name: "Untitled",
      archived: false,
      order: 0,
    });
  });

  it("prunes snapshots past the max per note and computes note counts", () => {
    const snapshots: NoteSnapshot[] = Array.from({ length: 55 }, (_, index) => ({
      id: `snap-${index}`,
      noteId: "note-1",
      title: "Snapshot",
      content: "Content",
      createdAt: new Date(Date.UTC(2026, 2, index + 1)).toISOString(),
    }));

    const pruned = pruneSnapshots(snapshots, "note-1");

    expect(pruned).toHaveLength(50);
    expect(pruned.some((snapshot) => snapshot.id === "snap-0")).toBe(false);

    const notes: Note[] = [
      {
        id: "n-1",
        title: "Inbox note",
        content: "",
        contentFormat: "markdown",
        tags: [],
        status: "active",
        pinned: false,
        wordCount: 0,
        trashedAt: null,
        archivedAt: null,
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-01T00:00:00.000Z",
      },
      {
        id: "n-2",
        title: "Pinned",
        content: "",
        contentFormat: "markdown",
        tags: [],
        folderId: "folder-1",
        status: "active",
        pinned: true,
        wordCount: 0,
        trashedAt: null,
        archivedAt: null,
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-01T00:00:00.000Z",
      },
      {
        id: "n-3",
        title: "Archived",
        content: "",
        contentFormat: "markdown",
        tags: [],
        status: "archived",
        pinned: false,
        wordCount: 0,
        trashedAt: null,
        archivedAt: "2026-03-01T00:00:00.000Z",
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-01T00:00:00.000Z",
      },
      {
        id: "n-4",
        title: "Trash",
        content: "",
        contentFormat: "markdown",
        tags: [],
        status: "trashed",
        pinned: false,
        wordCount: 0,
        trashedAt: "2026-03-01T00:00:00.000Z",
        archivedAt: null,
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-01T00:00:00.000Z",
      },
    ];

    expect(computeNoteCounts(notes)).toEqual({
      all: 2,
      inbox: 1,
      favorites: 1,
      archive: 1,
      trash: 1,
      byFolder: new Map([["folder-1", 1]]),
    });
  });
});
