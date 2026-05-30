import { describe, expect, it } from "vitest";
import { normalizeFolder, syncFoldersWithProjects } from "./folder-operations";
import type { TaskFolder } from "./types";

describe("folder operations", () => {
  it("normalizes raw folders with safe defaults", () => {
    expect(normalizeFolder({ id: "folder-1" })).toMatchObject({
      id: "folder-1",
      name: "Untitled",
      type: "custom",
      archived: false,
      order: 0,
    });
  });

  it("creates project folders, updates existing ones, and archives removed projects", () => {
    const folders: TaskFolder[] = [
      {
        id: "f-1",
        name: "Atlas old",
        type: "project",
        projectSlug: "atlas",
        color: "#111",
        archived: true,
        order: 1,
        createdAt: "2026-03-01T00:00:00.000Z",
      },
      {
        id: "f-2",
        name: "Old Pulse",
        type: "project",
        projectSlug: "pulse",
        color: "#222",
        archived: false,
        order: 2,
        createdAt: "2026-03-01T00:00:00.000Z",
      },
    ];

    const result = syncFoldersWithProjects(folders, [
      { slug: "atlas", name: "Atlas", color: "#f00" },
      { slug: "nova", name: "Nova", color: "#0f0" },
    ]);

    expect(result.changed).toBe(true);
    expect(result.folders.find((folder) => folder.projectSlug === "atlas")).toMatchObject({
      name: "Atlas",
      color: "#f00",
      archived: false,
    });
    expect(result.folders.find((folder) => folder.projectSlug === "pulse")?.archived).toBe(true);
    expect(result.folders.some((folder) => folder.projectSlug === "nova")).toBe(true);
  });
});
