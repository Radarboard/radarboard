// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useTaskFolders } from "./use-task-folders";

vi.mock("./folder-operations", async () => {
  const actual = await vi.importActual<typeof import("./folder-operations")>("./folder-operations");
  return {
    ...actual,
    generateFolderId: vi.fn(() => "generated-task-folder"),
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
      projects: {
        list: vi.fn(async () => [{ slug: "atlas", name: "Atlas", color: "#f00" }]),
      },
    },
    store,
  };
}

describe("useTaskFolders", () => {
  it("loads and syncs folders with projects, then supports folder updates", async () => {
    const { api, store } = createApi({
      "tasks:folders": [
        { id: "folder-1", name: "Old", type: "project", projectSlug: "atlas", order: 1 },
      ],
    });

    const { result } = renderHook(() => useTaskFolders(api as never));

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    expect(result.current.folders[0]).toMatchObject({
      id: "folder-1",
      name: "Atlas",
      projectSlug: "atlas",
    });

    await act(async () => {
      await result.current.addFolder("Custom");
    });
    await act(async () => {
      await result.current.renameFolder("generated-task-folder", "Custom 2");
    });
    await act(async () => {
      await result.current.archiveFolder("generated-task-folder");
    });
    await act(async () => {
      await result.current.reorderFolders(["generated-task-folder", "folder-1"]);
    });
    await act(async () => {
      await result.current.deleteFolder("folder-1");
    });

    expect(result.current.folders).toEqual([
      expect.objectContaining({
        id: "generated-task-folder",
        name: "Custom 2",
        archived: true,
        order: 0,
      }),
    ]);
    expect(store.get("tasks:folders")).toEqual(result.current.folders);
  });
});
