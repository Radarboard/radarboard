// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { highlightMatches, useNoteSearch } from "./use-note-search";

const NOTES = [
  {
    id: "1",
    title: "Alpha note",
    content: "Hello radarboard world",
    tags: ["launch"],
    status: "active",
    pinned: true,
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-03T00:00:00.000Z",
  },
  {
    id: "2",
    title: "Beta note",
    content: "hello again",
    tags: ["archive"],
    status: "archived",
    pinned: false,
    createdAt: "2026-03-02T00:00:00.000Z",
    updatedAt: "2026-03-04T00:00:00.000Z",
  },
] as never;

describe("useNoteSearch", () => {
  it("filters by folder and ranks search results", () => {
    const { result } = renderHook(() => useNoteSearch(NOTES, "all", "alpha"));

    expect(result.current).toHaveLength(1);
    expect(result.current[0]?.note.id).toBe("1");
    expect(result.current[0]?.score).toBeGreaterThan(0);
  });

  it("supports archived folders and match highlighting", () => {
    const { result } = renderHook(() => useNoteSearch(NOTES, "archive", "", "created"));

    expect(result.current.map((entry) => entry.note.id)).toEqual(["2"]);
    expect(highlightMatches("Radarboard Alpha", "alpha")).toEqual([
      { text: "Radarboard ", highlighted: false },
      { text: "Alpha", highlighted: true },
    ]);
  });
});
