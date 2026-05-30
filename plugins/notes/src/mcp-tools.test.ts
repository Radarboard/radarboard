import { createMockPluginAPI } from "@radarboard/plugin-sdk/testing";
import type { PluginAPI } from "@radarboard/plugin-sdk/types";
import { beforeEach, describe, expect, it } from "vitest";
import { notesMcpTools } from "./mcp-tools";
import type { Note, NoteFolder } from "./types";

function findTool(name: string) {
  const tool = notesMcpTools.find((t) => t.name === name);
  if (!tool) throw new Error(`Tool "${name}" not found`);
  return tool;
}

describe("Notes MCP Tools", () => {
  let api: PluginAPI;

  beforeEach(() => {
    api = createMockPluginAPI();
  });

  // -----------------------------------------------------------------------
  // create_note
  // -----------------------------------------------------------------------
  describe("create_note", () => {
    it("creates a note with required fields", async () => {
      const tool = findTool("create_note");
      const result = (await tool.execute({ title: "My Note" }, api)) as {
        success: boolean;
        note: Note;
      };

      expect(result.success).toBe(true);
      expect(result.note.title).toBe("My Note");
      expect(result.note.content).toBe("");
      expect(result.note.tags).toEqual([]);
      expect(result.note.id).toBeTruthy();
      expect(result.note.contentFormat).toBe("markdown");
      expect(result.note.status).toBe("active");
      expect(result.note.pinned).toBe(false);
    });

    it("creates a note with all fields", async () => {
      const tool = findTool("create_note");
      const result = (await tool.execute(
        {
          title: "Tagged Note",
          content: "Some **markdown** content",
          tags: ["work", "important"],
          folder_id: "folder-1",
          pinned: true,
        },
        api
      )) as { success: boolean; note: Note };

      expect(result.note.title).toBe("Tagged Note");
      expect(result.note.content).toBe("Some **markdown** content");
      expect(result.note.tags).toEqual(["work", "important"]);
      expect(result.note.folderId).toBe("folder-1");
      expect(result.note.pinned).toBe(true);
      expect(result.note.wordCount).toBeGreaterThan(0);
    });
  });

  // -----------------------------------------------------------------------
  // list_notes
  // -----------------------------------------------------------------------
  describe("list_notes", () => {
    it("returns empty list when no notes exist", async () => {
      const tool = findTool("list_notes");
      const result = (await tool.execute({}, api)) as {
        notes: Note[];
        count: number;
      };
      expect(result.notes).toEqual([]);
      expect(result.count).toBe(0);
    });

    it("filters by tag", async () => {
      const create = findTool("create_note");
      const list = findTool("list_notes");

      await create.execute({ title: "Work Note", tags: ["work"] }, api);
      await create.execute({ title: "Personal Note", tags: ["personal"] }, api);

      const result = (await list.execute({ tag: "work" }, api)) as {
        notes: Note[];
        count: number;
      };
      expect(result.count).toBe(1);
      expect(result.notes[0]?.title).toBe("Work Note");
    });

    it("filters by status", async () => {
      const create = findTool("create_note");
      const archive = findTool("archive_note");
      const list = findTool("list_notes");

      const { note } = (await create.execute({ title: "Active" }, api)) as { note: Note };
      await create.execute({ title: "Also Active" }, api);
      await archive.execute({ note_id: note.id }, api);

      const active = (await list.execute({ status: "active" }, api)) as { count: number };
      expect(active.count).toBe(1);

      const archived = (await list.execute({ status: "archived" }, api)) as { count: number };
      expect(archived.count).toBe(1);
    });

    it("filters by pinned", async () => {
      const create = findTool("create_note");
      const list = findTool("list_notes");

      await create.execute({ title: "Pinned", pinned: true }, api);
      await create.execute({ title: "Not pinned" }, api);

      const result = (await list.execute({ pinned: true }, api)) as { count: number };
      expect(result.count).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // update_note
  // -----------------------------------------------------------------------
  describe("update_note", () => {
    it("updates note fields", async () => {
      const create = findTool("create_note");
      const update = findTool("update_note");

      const { note } = (await create.execute({ title: "Old title" }, api)) as {
        note: Note;
      };
      const result = (await update.execute(
        {
          note_id: note.id,
          title: "New title",
          content: "Updated content",
          tags: ["updated"],
        },
        api
      )) as { success: boolean; note: Note };

      expect(result.success).toBe(true);
      expect(result.note.title).toBe("New title");
      expect(result.note.content).toBe("Updated content");
      expect(result.note.tags).toEqual(["updated"]);
    });

    it("moves note to folder", async () => {
      const create = findTool("create_note");
      const update = findTool("update_note");

      const { note } = (await create.execute({ title: "Test" }, api)) as { note: Note };
      const result = (await update.execute({ note_id: note.id, folder_id: "folder-abc" }, api)) as {
        success: boolean;
        note: Note;
      };

      expect(result.note.folderId).toBe("folder-abc");
    });

    it("returns error for nonexistent note", async () => {
      const tool = findTool("update_note");
      const result = (await tool.execute({ note_id: "fake-id", title: "Nope" }, api)) as {
        success: boolean;
        error: string;
      };

      expect(result.success).toBe(false);
      expect(result.error).toBe("Note not found");
    });
  });

  // -----------------------------------------------------------------------
  // delete_note
  // -----------------------------------------------------------------------
  describe("delete_note", () => {
    it("soft-deletes a note (moves to trash)", async () => {
      const create = findTool("create_note");
      const del = findTool("delete_note");
      const list = findTool("list_notes");

      const { note } = (await create.execute({ title: "Delete me" }, api)) as { note: Note };
      const result = (await del.execute({ note_id: note.id }, api)) as { success: boolean };
      expect(result.success).toBe(true);

      // Still exists but trashed
      const all = (await list.execute({}, api)) as { notes: Note[]; count: number };
      expect(all.count).toBe(1);
      expect(all.notes[0]?.status).toBe("trashed");

      // Filtered out when listing active
      const active = (await list.execute({ status: "active" }, api)) as { count: number };
      expect(active.count).toBe(0);
    });

    it("permanently deletes with permanent flag", async () => {
      const create = findTool("create_note");
      const del = findTool("delete_note");
      const list = findTool("list_notes");

      const { note } = (await create.execute({ title: "Delete me" }, api)) as { note: Note };
      await del.execute({ note_id: note.id, permanent: true }, api);

      const all = (await list.execute({}, api)) as { count: number };
      expect(all.count).toBe(0);
    });

    it("returns error for nonexistent note", async () => {
      const tool = findTool("delete_note");
      const result = (await tool.execute({ note_id: "nope" }, api)) as {
        success: boolean;
        error: string;
      };

      expect(result.success).toBe(false);
      expect(result.error).toBe("Note not found");
    });
  });

  // -----------------------------------------------------------------------
  // search_notes
  // -----------------------------------------------------------------------
  describe("search_notes", () => {
    it("finds notes by title", async () => {
      const create = findTool("create_note");
      const search = findTool("search_notes");

      await create.execute({ title: "Meeting Notes", content: "Discussed roadmap" }, api);
      await create.execute({ title: "Shopping List", content: "Buy groceries" }, api);

      const result = (await search.execute({ query: "meeting" }, api)) as {
        notes: Note[];
        count: number;
      };
      expect(result.count).toBe(1);
      expect(result.notes[0]?.title).toBe("Meeting Notes");
    });

    it("finds notes by content", async () => {
      const create = findTool("create_note");
      const search = findTool("search_notes");

      await create.execute({ title: "Note A", content: "Contains secret keyword" }, api);
      await create.execute({ title: "Note B", content: "Nothing here" }, api);

      const result = (await search.execute({ query: "secret" }, api)) as {
        notes: Note[];
        count: number;
      };
      expect(result.count).toBe(1);
      expect(result.notes[0]?.title).toBe("Note A");
    });

    it("finds notes by tag", async () => {
      const create = findTool("create_note");
      const search = findTool("search_notes");

      await create.execute({ title: "Note A", tags: ["urgent"] }, api);
      await create.execute({ title: "Note B", tags: ["low"] }, api);

      const result = (await search.execute({ query: "urgent" }, api)) as { count: number };
      expect(result.count).toBe(1);
    });

    it("returns empty for no match", async () => {
      const create = findTool("create_note");
      const search = findTool("search_notes");

      await create.execute({ title: "Some Note", content: "Some content" }, api);

      const result = (await search.execute({ query: "nonexistent" }, api)) as {
        notes: Note[];
        count: number;
      };
      expect(result.count).toBe(0);
      expect(result.notes).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // pin_note
  // -----------------------------------------------------------------------
  describe("pin_note", () => {
    it("toggles pin state", async () => {
      const create = findTool("create_note");
      const pin = findTool("pin_note");

      const { note } = (await create.execute({ title: "Pin me" }, api)) as { note: Note };

      const result1 = (await pin.execute({ note_id: note.id }, api)) as {
        success: boolean;
        pinned: boolean;
      };
      expect(result1.pinned).toBe(true);

      const result2 = (await pin.execute({ note_id: note.id }, api)) as {
        success: boolean;
        pinned: boolean;
      };
      expect(result2.pinned).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // archive_note
  // -----------------------------------------------------------------------
  describe("archive_note", () => {
    it("archives and unarchives a note", async () => {
      const create = findTool("create_note");
      const archive = findTool("archive_note");

      const { note } = (await create.execute({ title: "Archive me" }, api)) as { note: Note };

      const r1 = (await archive.execute({ note_id: note.id }, api)) as { status: string };
      expect(r1.status).toBe("archived");

      const r2 = (await archive.execute({ note_id: note.id, unarchive: true }, api)) as {
        status: string;
      };
      expect(r2.status).toBe("active");
    });
  });

  // -----------------------------------------------------------------------
  // move_note
  // -----------------------------------------------------------------------
  describe("move_note", () => {
    it("moves a note to a folder", async () => {
      const create = findTool("create_note");
      const move = findTool("move_note");

      const { note } = (await create.execute({ title: "Move me" }, api)) as { note: Note };
      const result = (await move.execute({ note_id: note.id, folder_id: "f1" }, api)) as {
        success: boolean;
        folderId: string;
      };
      expect(result.folderId).toBe("f1");
    });

    it("moves a note to inbox (no folder)", async () => {
      const create = findTool("create_note");
      const move = findTool("move_note");

      const { note } = (await create.execute({ title: "Move me", folder_id: "f1" }, api)) as {
        note: Note;
      };
      const result = (await move.execute({ note_id: note.id, folder_id: "" }, api)) as {
        folderId: null;
      };
      expect(result.folderId).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // list_note_folders
  // -----------------------------------------------------------------------
  describe("list_note_folders", () => {
    it("returns empty when no folders", async () => {
      const tool = findTool("list_note_folders");
      const result = (await tool.execute({}, api)) as {
        folders: NoteFolder[];
        count: number;
      };
      expect(result.count).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // create_note_from_template
  // -----------------------------------------------------------------------
  describe("create_note_from_template", () => {
    it("creates from built-in template", async () => {
      const tool = findTool("create_note_from_template");
      const result = (await tool.execute({ template_id: "tpl-meeting" }, api)) as {
        success: boolean;
        note: Note;
      };

      expect(result.success).toBe(true);
      expect(result.note.title).toBe("Meeting Notes");
      expect(result.note.content).toContain("## Meeting:");
      expect(result.note.tags).toContain("meeting");
    });

    it("returns error for unknown template", async () => {
      const tool = findTool("create_note_from_template");
      const result = (await tool.execute({ template_id: "tpl-unknown" }, api)) as {
        success: boolean;
        error: string;
      };
      expect(result.success).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // export_note
  // -----------------------------------------------------------------------
  describe("export_note", () => {
    it("exports note as markdown", async () => {
      const create = findTool("create_note");
      const exp = findTool("export_note");

      const { note } = (await create.execute(
        { title: "Export me", content: "# Hello\n\nWorld" },
        api
      )) as { note: Note };

      const result = (await exp.execute({ note_id: note.id }, api)) as {
        success: boolean;
        markdown: string;
        title: string;
      };

      expect(result.success).toBe(true);
      expect(result.markdown).toBe("# Hello\n\nWorld");
      expect(result.title).toBe("Export me");
    });
  });
});
