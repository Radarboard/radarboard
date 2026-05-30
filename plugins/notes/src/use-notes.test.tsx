// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useNotes } from "./use-notes";

let mockIsDemoMode = false;

vi.mock("@radarboard/hooks/use-demo-mode", () => ({
  useDemoMode: () => ({ isDemoMode: mockIsDemoMode }),
}));

vi.mock("./note-operations", async () => {
  const actual = await vi.importActual<typeof import("./note-operations")>("./note-operations");
  return {
    ...actual,
    generateId: vi.fn(() => "generated-note"),
    now: vi.fn(() => "2026-03-28T00:00:00.000Z"),
  };
});

function createApi(initial: Record<string, unknown> = {}) {
  const store = new Map<string, unknown>(Object.entries(initial));

  return {
    api: {
      db: {
        get: vi.fn(async <T,>(key: string) => (store.has(key) ? (store.get(key) as T) : null)),
        set: vi.fn(async <T,>(key: string, value: T) => {
          store.set(key, value);
        }),
        delete: vi.fn(async (key: string) => {
          store.delete(key);
        }),
        list: vi.fn(async () => []),
      },
    },
    store,
  };
}

describe("useNotes", () => {
  beforeEach(() => {
    mockIsDemoMode = false;
  });

  it("loads demo notes when demo mode is enabled", async () => {
    mockIsDemoMode = true;
    const { api } = createApi();

    const { result } = renderHook(() => useNotes(api as never));

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    expect(result.current.notes).toHaveLength(3);
    expect(result.current.notes[0]?.title).toBe("Sprint 14 retrospective");
  });

  it("migrates persisted notes and supports note operations", async () => {
    const { api, store } = createApi({
      "notes:list": [
        {
          id: "legacy-note",
          title: "Legacy",
          content: "<p>Hello world</p>",
          tags: ["old"],
          createdAt: "2026-03-01T00:00:00.000Z",
          updatedAt: "2026-03-01T00:00:00.000Z",
        },
      ],
      "notes:schema-version": 1,
    });

    const { result } = renderHook(() => useNotes(api as never));

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    expect(result.current.notes[0]).toMatchObject({
      id: "legacy-note",
      content: "Hello world",
      contentFormat: "markdown",
    });
    expect(api.db.set).toHaveBeenCalledWith("notes:schema-version", 2);

    await act(async () => {
      await result.current.addNote({
        title: "New note",
        content: "alpha beta",
        tags: ["fresh"],
        pinned: true,
      });
    });

    expect(result.current.notes.find((note) => note.id === "generated-note")).toMatchObject({
      title: "New note",
      wordCount: 2,
      pinned: true,
    });

    await act(async () => {
      await result.current.updateNote("generated-note", { content: "gamma delta epsilon" });
    });
    await act(async () => {
      await result.current.pinNote("generated-note");
    });
    await act(async () => {
      await result.current.archiveNote("generated-note");
    });
    await act(async () => {
      await result.current.trashNote("generated-note");
    });
    await act(async () => {
      await result.current.restoreNote("generated-note");
    });
    await act(async () => {
      await result.current.moveToFolder("generated-note", "folder-1");
    });

    expect(result.current.notes.find((note) => note.id === "generated-note")).toMatchObject({
      content: "gamma delta epsilon",
      wordCount: 3,
      pinned: false,
      status: "active",
      folderId: "folder-1",
      trashedAt: null,
      archivedAt: null,
    });

    await act(async () => {
      await result.current.deleteNote("legacy-note");
    });

    expect(result.current.notes.some((note) => note.id === "legacy-note")).toBe(false);
    expect(store.get("notes:list")).toEqual(result.current.notes);
  });
});
