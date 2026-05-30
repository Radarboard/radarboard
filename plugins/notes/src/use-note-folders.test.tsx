// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useNoteFolders } from "./use-note-folders";

vi.mock("./note-operations", async () => {
  const actual = await vi.importActual<typeof import("./note-operations")>("./note-operations");
  return {
    ...actual,
    generateId: vi.fn(() => "generated-folder"),
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

describe("useNoteFolders", () => {
  it("loads, normalizes, and updates folders", async () => {
    const { api, store } = createApi({
      "notes:folders": [{ id: "folder-1", name: "Docs", order: 4 }],
    });

    const { result } = renderHook(() => useNoteFolders(api as never));

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    expect(result.current.folders).toEqual([
      expect.objectContaining({ id: "folder-1", name: "Docs", order: 4, archived: false }),
    ]);

    await act(async () => {
      await result.current.addFolder("Inbox");
    });
    await act(async () => {
      await result.current.renameFolder("generated-folder", "Inbox 2");
    });
    await act(async () => {
      await result.current.updateFolderColor("generated-folder", "blue");
    });
    await act(async () => {
      await result.current.archiveFolder("generated-folder");
    });
    await act(async () => {
      await result.current.reorderFolders(["generated-folder", "folder-1"]);
    });
    await act(async () => {
      await result.current.deleteFolder("folder-1");
    });

    expect(result.current.folders).toEqual([
      expect.objectContaining({
        id: "generated-folder",
        name: "Inbox 2",
        color: "blue",
        archived: true,
        order: 0,
      }),
    ]);
    expect(store.get("notes:folders")).toEqual(result.current.folders);
  });
});
