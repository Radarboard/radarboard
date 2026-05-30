// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { NoteHistory } from "./note-history";

vi.mock("@radarboard/ui/rich-text-viewer", () => ({
  RichTextViewer: ({ markdown }: { markdown: string }) => createElement("div", null, markdown),
}));

describe("NoteHistory", () => {
  it("shows an empty state when no snapshots exist", () => {
    render(
      createElement(NoteHistory, {
        snapshots: [],
        onRestore: vi.fn(),
        onClose: vi.fn(),
      })
    );

    expect(
      screen.getByText("No snapshots yet. Edits create snapshots automatically.")
    ).toBeTruthy();
  });

  it("selects snapshots, restores, and closes", () => {
    const onRestore = vi.fn();
    const onClose = vi.fn();

    render(
      createElement(NoteHistory, {
        snapshots: [
          {
            id: "snap-1",
            noteId: "note-1",
            title: "Older",
            content: "old content",
            createdAt: "2026-03-20T00:00:00.000Z",
          },
          {
            id: "snap-2",
            noteId: "note-1",
            title: "Newer",
            content: "",
            createdAt: "2026-03-21T00:00:00.000Z",
          },
        ],
        onRestore,
        onClose,
      })
    );

    fireEvent.click(screen.getByRole("button", { name: /Older/i }));
    fireEvent.click(screen.getByRole("button", { name: /Restore/i }));
    fireEvent.click(screen.getByRole("button", { name: /Close history/i }));

    expect(onRestore).toHaveBeenCalledWith(
      expect.objectContaining({ id: "snap-1", content: "old content" })
    );
    expect(onClose).toHaveBeenCalled();
  });
});
