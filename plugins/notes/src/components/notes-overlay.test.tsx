// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotesOverlay } from "./notes-overlay";

const useNotesMock = vi.fn();
const useNoteFoldersMock = vi.fn();
const useNoteSnapshotsMock = vi.fn();
const useNoteSearchMock = vi.fn();
const usePluginSearchParamMock = vi.fn();

vi.mock("../use-notes", () => ({
  useNotes: (...args: unknown[]) => useNotesMock(...args),
}));

vi.mock("../use-note-folders", () => ({
  useNoteFolders: (...args: unknown[]) => useNoteFoldersMock(...args),
}));

vi.mock("../hooks/use-note-snapshots", () => ({
  useNoteSnapshots: (...args: unknown[]) => useNoteSnapshotsMock(...args),
}));

vi.mock("../hooks/use-note-search", () => ({
  useNoteSearch: (...args: unknown[]) => useNoteSearchMock(...args),
}));

vi.mock("@radarboard/plugin-sdk/use-plugin-search-param", () => ({
  usePluginSearchParam: (...args: unknown[]) => usePluginSearchParamMock(...args),
}));

vi.mock("@radarboard/ui/skeleton-shimmer", () => ({
  SkeletonShimmer: ({ children }: { children: ReactNode }) => createElement("div", null, children),
}));

vi.mock("@radarboard/plugin-sdk/components/list-header", () => ({
  PluginListHeader: ({
    search,
    addButton,
    count,
  }: {
    search?: { value: string; onChange: (value: string) => void };
    addButton?: { onClick?: () => void; custom?: ReactNode };
    count?: string;
  }) =>
    createElement("div", null, [
      createElement("div", { key: "count" }, count),
      search
        ? createElement("input", {
            key: "search",
            "aria-label": "Search notes",
            value: search.value,
            onChange: (e: Event) => search.onChange((e.target as HTMLInputElement).value),
          })
        : null,
      addButton?.onClick
        ? createElement("button", { key: "add", type: "button", onClick: addButton.onClick }, "Add")
        : null,
      addButton?.custom != null ? createElement("div", { key: "custom" }, addButton.custom) : null,
    ]),
}));

vi.mock("@radarboard/plugin-sdk/components/plugin-empty", () => ({
  PluginEmptyState: ({
    title,
    action,
  }: {
    title: string;
    action?: { label: string; onClick: () => void };
  }) =>
    createElement("div", null, [
      createElement("div", { key: "title" }, title),
      action
        ? createElement(
            "button",
            { key: "action", type: "button", onClick: action.onClick },
            action.label
          )
        : null,
    ]),
}));

vi.mock("@radarboard/plugin-sdk/components/three-pane-workspace", () => ({
  ThreePaneWorkspace: ({
    sidebar,
    list,
    detail,
  }: {
    sidebar: ReactNode;
    list: ReactNode;
    detail: ReactNode;
  }) =>
    createElement("div", null, [
      createElement("div", { key: "sidebar" }, sidebar),
      createElement("div", { key: "list" }, list),
      createElement("div", { key: "detail" }, detail),
    ]),
}));

vi.mock("./note-folder-sidebar", () => ({
  NoteFolderSidebar: ({
    onSelectFolder,
    onFilterByTag,
  }: {
    onSelectFolder: (value: string) => void;
    onFilterByTag?: (value: string) => void;
  }) =>
    createElement("div", null, [
      createElement(
        "button",
        { key: "folder", type: "button", onClick: () => onSelectFolder("folder-1") },
        "Select Folder"
      ),
      createElement(
        "button",
        { key: "tag", type: "button", onClick: () => onFilterByTag?.("alpha") },
        "Filter Tag"
      ),
    ]),
}));

vi.mock("./note-list-item", () => ({
  NoteListItem: ({
    note,
    onClick,
    onPin,
  }: {
    note: { id: string; title: string };
    onClick: () => void;
    onPin: (id: string) => void;
  }) =>
    createElement("div", null, [
      createElement("button", { key: "select", type: "button", onClick }, `Select ${note.title}`),
      createElement(
        "button",
        { key: "pin", type: "button", onClick: () => onPin(note.id) },
        `Pin ${note.title}`
      ),
    ]),
}));

vi.mock("./note-editor", () => ({
  NoteEditor: ({
    note,
    onTrash,
    onShowHistory,
    onCreateSnapshot,
  }: {
    note: { id: string; title: string; content: string };
    onTrash: (id: string) => Promise<void>;
    onShowHistory?: () => void;
    onCreateSnapshot?: (id: string, title: string, content: string) => void;
  }) =>
    createElement("div", null, [
      createElement("div", { key: "note" }, `Editor ${note.title}`),
      createElement(
        "button",
        {
          key: "trash",
          type: "button",
          onClick: () => {
            onTrash(note.id);
          },
        },
        "Trash Note"
      ),
      createElement(
        "button",
        {
          key: "history",
          type: "button",
          onClick: () => {
            onCreateSnapshot?.(note.id, note.title, note.content);
            onShowHistory?.();
          },
        },
        "Show History"
      ),
    ]),
}));

vi.mock("./note-history", () => ({
  NoteHistory: ({
    onRestore,
    onClose,
  }: {
    onRestore: (snapshot: { title: string; content: string }) => void;
    onClose: () => void;
  }) =>
    createElement("div", null, [
      createElement(
        "button",
        {
          key: "restore",
          type: "button",
          onClick: () => onRestore({ title: "Restored", content: "restored content" }),
        },
        "Restore Snapshot"
      ),
      createElement("button", { key: "close", type: "button", onClick: onClose }, "Close History"),
    ]),
}));

vi.mock("./template-picker", () => ({
  TemplatePicker: ({
    onBlankNote,
    onSelect,
    onManage,
  }: {
    onBlankNote: () => void;
    onSelect: (value: { title: string; content: string; tags: string[] }) => void;
    onManage?: () => void;
  }) =>
    createElement("div", null, [
      createElement("button", { key: "blank", type: "button", onClick: onBlankNote }, "Blank Note"),
      createElement(
        "button",
        {
          key: "template",
          type: "button",
          onClick: () =>
            onSelect({ title: "From Template", content: "templated", tags: ["alpha"] }),
        },
        "Use Template"
      ),
      createElement(
        "button",
        { key: "manage", type: "button", onClick: onManage },
        "Manage Templates"
      ),
    ]),
}));

vi.mock("./template-manager", () => ({
  TemplateManager: ({
    open,
    onAdd,
    onUpdate,
    onRemove,
    onClose,
  }: {
    open: boolean;
    onAdd: (value: {
      name: string;
      description: string;
      content: string;
      tags: string[];
      icon?: string;
    }) => Promise<unknown>;
    onUpdate: (id: string, value: { name: string }) => Promise<void>;
    onRemove: (id: string) => Promise<void>;
    onClose: () => void;
  }) =>
    open
      ? createElement("div", null, [
          createElement(
            "button",
            {
              key: "add-template",
              type: "button",
              onClick: () => {
                onAdd({
                  name: "New",
                  description: "d",
                  content: "c",
                  tags: [],
                  icon: undefined,
                });
              },
            },
            "Add Template"
          ),
          createElement(
            "button",
            {
              key: "update-template",
              type: "button",
              onClick: () => {
                onUpdate("tpl-1", { name: "Updated" });
              },
            },
            "Update Template"
          ),
          createElement(
            "button",
            {
              key: "remove-template",
              type: "button",
              onClick: () => {
                onRemove("tpl-1");
              },
            },
            "Remove Template"
          ),
          createElement(
            "button",
            { key: "close-template", type: "button", onClick: onClose },
            "Close Templates"
          ),
        ])
      : null,
}));

vi.mock("@radarboard/plugin-sdk/components/form-dialog", () => ({
  PluginFormDialog: ({
    open,
    onClose,
    onSubmit,
    children,
  }: {
    open: boolean;
    onClose: () => void;
    onSubmit: () => void;
    children: ReactNode;
  }) =>
    open
      ? createElement("div", null, [
          children,
          createElement(
            "button",
            { key: "submit", type: "button", onClick: onSubmit },
            "Submit Form"
          ),
          createElement("button", { key: "close", type: "button", onClick: onClose }, "Close Form"),
        ])
      : null,
  FormField: ({ children }: { children: ReactNode }) => createElement("div", null, children),
  FormInput: ({
    value,
    onChange,
    placeholder,
  }: {
    value?: string;
    onChange?: (event: { target: { value: string } }) => void;
    placeholder?: string;
  }) =>
    createElement("input", {
      "aria-label": placeholder ?? "form-input",
      value: value ?? "",
      onChange: (e: Event) =>
        onChange?.({ target: { value: (e.target as HTMLInputElement).value } }),
    }),
  FormSelect: ({
    value,
    onChange,
    children,
  }: {
    value?: string;
    onChange?: (event: { target: { value: string } }) => void;
    children: ReactNode;
  }) =>
    createElement(
      "select",
      {
        "aria-label": "form-select",
        value: value ?? "",
        onChange: (e: Event) =>
          onChange?.({ target: { value: (e.target as HTMLSelectElement).value } }),
      },
      children
    ),
}));

function createApi() {
  const templates = [
    {
      id: "tpl-1",
      name: "Custom",
      description: "desc",
      content: "body",
      tags: [],
      builtIn: false,
      order: 1,
    },
  ];
  const db = {
    get: vi.fn(async (key: string) => (key === "notes:templates" ? templates : null)),
    set: vi.fn(async () => {}),
  };
  return {
    db,
    notify: vi.fn(),
    searchParams: new URLSearchParams(),
  };
}

describe("NotesOverlay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePluginSearchParamMock.mockReturnValue(null);
    useNotesMock.mockReturnValue({
      notes: [
        {
          id: "note-1",
          title: "Alpha",
          content: "a",
          contentFormat: "markdown",
          tags: [],
          status: "active",
        },
        {
          id: "note-2",
          title: "Beta",
          content: "b",
          contentFormat: "markdown",
          tags: [],
          status: "active",
        },
      ],
      loaded: true,
      addNote: vi.fn(async ({ title, content, tags, folderId }: any) => ({
        id: "note-3",
        title,
        content: content ?? "",
        contentFormat: "markdown",
        tags: tags ?? [],
        folderId,
        status: "active",
      })),
      updateNote: vi.fn(async () => {}),
      deleteNote: vi.fn(async () => {}),
      pinNote: vi.fn(async () => {}),
      archiveNote: vi.fn(async () => {}),
      trashNote: vi.fn(async () => {}),
      restoreNote: vi.fn(async () => {}),
      moveToFolder: vi.fn(async () => {}),
    });
    useNoteFoldersMock.mockReturnValue({
      folders: [{ id: "folder-1", name: "Docs" }],
      loaded: true,
      addFolder: vi.fn(async () => ({ id: "folder-2", name: "Ideas" })),
      renameFolder: vi.fn(async () => {}),
      archiveFolder: vi.fn(async () => {}),
      deleteFolder: vi.fn(async () => {}),
    });
    useNoteSnapshotsMock.mockReturnValue({
      createSnapshot: vi.fn(async () => {}),
      getSnapshotsForNote: vi.fn(() => [{ id: "snap-1", title: "Old", content: "old" }]),
    });
    useNoteSearchMock.mockImplementation((notes: any) =>
      notes.map((note: any) => ({ note, score: 0 }))
    );
  });

  it("wires note selection, creation, templates, history, and deletion flows", async () => {
    const api = createApi();
    render(createElement(NotesOverlay, { api } as any));

    await waitFor(() => {
      expect(api.db.get).toHaveBeenCalledWith("notes:templates");
    });

    fireEvent.click(screen.getByRole("button", { name: "Use Template" }));
    await waitFor(() => {
      expect(useNotesMock.mock.results[0]?.value.addNote).toHaveBeenCalledWith(
        expect.objectContaining({ title: "From Template", content: "templated", tags: ["alpha"] })
      );
    });
    expect(api.notify).toHaveBeenCalledWith("Created from template: From Template", "success");

    fireEvent.click(screen.getByRole("button", { name: "Manage Templates" }));
    fireEvent.click(screen.getByRole("button", { name: "Add Template" }));
    fireEvent.click(screen.getByRole("button", { name: "Update Template" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove Template" }));

    fireEvent.click(screen.getByRole("button", { name: "Blank Note" }));
    fireEvent.change(screen.getByLabelText("Note title..."), { target: { value: "Manual Note" } });
    fireEvent.change(screen.getByLabelText("form-select"), { target: { value: "folder-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit Form" }));

    await waitFor(() => {
      expect(useNotesMock.mock.results[0]?.value.addNote).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Manual Note", folderId: "folder-1" })
      );
    });
    expect(api.notify).toHaveBeenCalledWith("Note created", "success");

    fireEvent.click(screen.getByRole("button", { name: "Select Beta" }));
    fireEvent.click(screen.getByRole("button", { name: "Show History" }));
    fireEvent.click(screen.getByRole("button", { name: "Restore Snapshot" }));
    await waitFor(() => {
      expect(useNotesMock.mock.results[0]?.value.updateNote).toHaveBeenCalledWith("note-2", {
        content: "restored content",
        title: "Restored",
      });
    });
    expect(api.notify).toHaveBeenCalledWith("Snapshot restored", "success");

    fireEvent.click(await screen.findByRole("button", { name: "Trash Note" }));
    await waitFor(() => {
      expect(useNotesMock.mock.results[0]?.value.trashNote).toHaveBeenCalledWith("note-2");
    });
  });
});
