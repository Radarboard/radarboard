// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useNoteSnapshots } from "./use-note-snapshots";

vi.mock("../note-operations", async () => {
  const actual = await vi.importActual<typeof import("../note-operations")>("../note-operations");
  return {
    ...actual,
    generateId: vi.fn(() => "snapshot-2"),
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
        delete: vi.fn(async () => {}),
        list: vi.fn(async () => []),
      },
    },
    store,
  };
}

describe("useNoteSnapshots", () => {
  it("loads, creates, sorts, and deletes snapshots", async () => {
    const { api, store } = createApi({
      "notes:snapshots": [
        {
          id: "snapshot-1",
          noteId: "note-1",
          title: "Older",
          content: "old",
          createdAt: "2026-03-20T00:00:00.000Z",
        },
      ],
    });

    const { result } = renderHook(() => useNoteSnapshots(api as never));

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    await act(async () => {
      await result.current.createSnapshot("note-1", "Newer", "content");
    });

    expect(result.current.getSnapshotsForNote("note-1").map((snapshot) => snapshot.id)).toEqual([
      "snapshot-2",
      "snapshot-1",
    ]);

    await act(async () => {
      await result.current.deleteSnapshot("snapshot-1");
    });

    expect(result.current.snapshots.map((snapshot) => snapshot.id)).toEqual(["snapshot-2"]);
    expect(store.get("notes:snapshots")).toEqual(result.current.snapshots);
  });
});
