// @vitest-environment jsdom

import { TooltipProvider } from "@radarboard/ui/tooltip";
import { fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { NoteEditor } from "./note-editor";

const autoSave = {
  status: "saved" as const,
  handleChange: vi.fn(),
  flush: vi.fn(),
  reset: vi.fn(),
};

vi.mock("../hooks/use-auto-save", () => ({
  useAutoSave: vi.fn(() => autoSave),
}));

vi.mock("@radarboard/ui/rich-text-composer", () => ({
  RichTextComposer: ({ onChange }: { onChange: (value: string) => void }) =>
    createElement(
      "button",
      {
        type: "button",
        onClick: () => onChange("updated markdown"),
      },
      "Mock Rich Editor"
    ),
}));

vi.mock("@radarboard/ui/rich-text-viewer", () => ({
  RichTextViewer: ({ markdown }: { markdown: string }) => createElement("div", null, markdown),
}));

describe("NoteEditor", () => {
  it("handles active note editing actions", () => {
    const onUpdate = vi.fn(async () => {});
    const onPin = vi.fn(async () => {});
    const onArchive = vi.fn(async () => {});
    const onTrash = vi.fn(async () => {});
    const onRestore = vi.fn(async () => {});
    const onPermanentDelete = vi.fn(async () => {});
    const onMoveToFolder = vi.fn(async () => {});
    const onShowHistory = vi.fn();

    render(
      createElement(
        TooltipProvider,
        null,
        createElement(NoteEditor, {
          note: {
            id: "note-1",
            title: "Alpha",
            content: "hello",
            contentFormat: "markdown",
            tags: ["docs"],
            folderId: undefined,
            status: "active",
            pinned: false,
            wordCount: 1,
            trashedAt: null,
            archivedAt: null,
            createdAt: "2026-03-20T00:00:00.000Z",
            updatedAt: "2026-03-21T00:00:00.000Z",
          },
          folders: [
            {
              id: "folder-1",
              name: "Docs",
              archived: false,
              order: 1,
              createdAt: "2026-03-20T00:00:00.000Z",
            },
          ],
          onUpdate,
          onPin,
          onArchive,
          onTrash,
          onRestore,
          onPermanentDelete,
          onMoveToFolder,
          onShowHistory,
          onCreateSnapshot: vi.fn(),
        })
      )
    );

    fireEvent.change(screen.getByPlaceholderText("Note title..."), {
      target: { value: "Alpha 2" },
    });
    fireEvent.blur(screen.getByPlaceholderText("Note title..."));
    fireEvent.click(screen.getByRole("button", { name: /Mock Rich Editor/i }));
    fireEvent.click(screen.getByRole("button", { name: /Markdown/i }));
    fireEvent.change(screen.getByPlaceholderText("Tags (comma-separated)..."), {
      target: { value: "docs,alpha" },
    });
    fireEvent.blur(screen.getByPlaceholderText("Tags (comma-separated)..."));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "folder-1" } });
    fireEvent.click(screen.getByRole("button", { name: /Pin/i }));
    fireEvent.click(screen.getByRole("button", { name: /History/i }));
    fireEvent.click(screen.getByRole("button", { name: /Archive/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Trash$/i }));

    expect(autoSave.handleChange).toHaveBeenCalled();
    expect(autoSave.flush).toHaveBeenCalled();
    expect(onMoveToFolder).toHaveBeenCalledWith("note-1", "folder-1");
    expect(onPin).toHaveBeenCalledWith("note-1");
    expect(onShowHistory).toHaveBeenCalledWith("note-1");
    expect(onArchive).toHaveBeenCalledWith("note-1");
    expect(onTrash).toHaveBeenCalledWith("note-1");
    expect(screen.getByText("Saved")).toBeTruthy();
  });

  it("renders restore and permanent delete actions for trashed notes", () => {
    const onRestore = vi.fn(async () => {});
    const onPermanentDelete = vi.fn(async () => {});

    render(
      createElement(
        TooltipProvider,
        null,
        createElement(NoteEditor, {
          note: {
            id: "note-2",
            title: "Beta",
            content: "",
            contentFormat: "markdown",
            tags: [],
            folderId: undefined,
            status: "trashed",
            pinned: false,
            wordCount: 0,
            trashedAt: "2026-03-21T00:00:00.000Z",
            archivedAt: null,
            createdAt: "2026-03-20T00:00:00.000Z",
            updatedAt: "2026-03-21T00:00:00.000Z",
          },
          folders: [],
          onUpdate: vi.fn(async () => {}),
          onPin: vi.fn(async () => {}),
          onArchive: vi.fn(async () => {}),
          onTrash: vi.fn(async () => {}),
          onRestore,
          onPermanentDelete,
          onMoveToFolder: vi.fn(async () => {}),
        })
      )
    );

    fireEvent.click(screen.getByRole("button", { name: /Restore/i }));
    fireEvent.click(screen.getByRole("button", { name: /Delete forever/i }));

    expect(onRestore).toHaveBeenCalledWith("note-2");
    expect(onPermanentDelete).toHaveBeenCalledWith("note-2");
  });
});
