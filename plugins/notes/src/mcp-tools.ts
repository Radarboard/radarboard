import type { McpToolDefinition, PluginAPI } from "@radarboard/plugin-sdk/types";
import { z } from "zod";
import { countWords, generateId, normalizeNote, now } from "./note-operations";
import { hydrateTemplate, mergeTemplates } from "./templates";
import { DB_KEYS, type Note, type NoteFolder, type NoteTemplate } from "./types";

async function getNotes(api: PluginAPI): Promise<Note[]> {
  const raw =
    (await api.db.get<Array<Record<string, unknown> & { id: string }>>(DB_KEYS.notes)) ?? [];
  return raw.map(normalizeNote);
}

async function saveNotes(api: PluginAPI, notes: Note[]): Promise<void> {
  await api.db.set(DB_KEYS.notes, notes);
}

async function getFolders(api: PluginAPI): Promise<NoteFolder[]> {
  return (await api.db.get<NoteFolder[]>(DB_KEYS.folders)) ?? [];
}

export const notesMcpTools: McpToolDefinition[] = [
  // -----------------------------------------------------------------------
  // Core CRUD (updated for v2 schema)
  // -----------------------------------------------------------------------
  {
    name: "create_note",
    description: "Create a new note with a title, optional markdown content, tags, and folder.",
    parameters: z.object({
      title: z.string().describe("Note title"),
      content: z.string().optional().default("").describe("Markdown content"),
      tags: z.array(z.string()).optional().default([]).describe("Tags for the note"),
      folder_id: z.string().optional().describe("Folder ID to place the note in"),
      pinned: z.boolean().optional().default(false).describe("Pin the note"),
    }),
    execute: async (params: unknown, api: PluginAPI) => {
      const input = params as {
        title: string;
        content?: string;
        tags?: string[];
        folder_id?: string;
        pinned?: boolean;
      };
      const notes = await getNotes(api);
      const content = input.content ?? "";
      const note: Note = {
        id: generateId(),
        title: input.title,
        content,
        contentFormat: "markdown",
        tags: input.tags ?? [],
        folderId: input.folder_id,
        status: "active",
        pinned: input.pinned ?? false,
        wordCount: countWords(content),
        trashedAt: null,
        archivedAt: null,
        createdAt: now(),
        updatedAt: now(),
      };
      notes.push(note);
      await saveNotes(api, notes);
      return { success: true, note };
    },
  },

  {
    name: "list_notes",
    description: "List notes with optional filters for tag, status, folder, and pinned state.",
    parameters: z.object({
      tag: z.string().optional().describe("Filter notes by tag"),
      status: z.enum(["active", "archived", "trashed"]).optional().describe("Filter by status"),
      folder_id: z.string().optional().describe("Filter by folder ID"),
      pinned: z.boolean().optional().describe("Filter by pinned state"),
    }),
    execute: async (params: unknown, api: PluginAPI) => {
      const { tag, status, folder_id, pinned } = params as {
        tag?: string;
        status?: string;
        folder_id?: string;
        pinned?: boolean;
      };
      let notes = await getNotes(api);

      if (tag) notes = notes.filter((n) => n.tags.includes(tag));
      if (status) notes = notes.filter((n) => n.status === status);
      if (folder_id) notes = notes.filter((n) => n.folderId === folder_id);
      if (pinned !== undefined) notes = notes.filter((n) => n.pinned === pinned);

      return { notes, count: notes.length };
    },
  },

  {
    name: "update_note",
    description: "Update note fields (title, content, tags, folder) by ID.",
    parameters: z.object({
      note_id: z.string().describe("The note ID to update"),
      title: z.string().optional().describe("New title"),
      content: z.string().optional().describe("New markdown content"),
      tags: z.array(z.string()).optional().describe("New tags"),
      folder_id: z.string().optional().describe("Move to folder (empty string to remove)"),
    }),
    execute: async (params: unknown, api: PluginAPI) => {
      const { note_id, folder_id, ...changes } = params as {
        note_id: string;
        title?: string;
        content?: string;
        tags?: string[];
        folder_id?: string;
      };
      const notes = await getNotes(api);
      const note = notes.find((n) => n.id === note_id);
      if (!note) return { success: false, error: "Note not found" };

      if (changes.title !== undefined) note.title = changes.title;
      if (changes.content !== undefined) {
        note.content = changes.content;
        note.wordCount = countWords(changes.content);
      }
      if (changes.tags !== undefined) note.tags = changes.tags;
      if (folder_id !== undefined) note.folderId = folder_id || undefined;
      note.updatedAt = now();

      await saveNotes(api, notes);
      return { success: true, note };
    },
  },

  {
    name: "delete_note",
    description: "Move a note to trash (soft delete) or permanently delete it.",
    parameters: z.object({
      note_id: z.string().describe("The note ID to delete"),
      permanent: z.boolean().optional().default(false).describe("Permanently delete (skip trash)"),
    }),
    execute: async (params: unknown, api: PluginAPI) => {
      const { note_id, permanent } = params as { note_id: string; permanent?: boolean };
      const notes = await getNotes(api);
      const idx = notes.findIndex((n) => n.id === note_id);
      if (idx === -1) return { success: false, error: "Note not found" };

      if (permanent) {
        notes.splice(idx, 1);
      } else {
        const note = notes[idx];
        if (!note) return { success: false, error: "Note not found" };
        note.status = "trashed";
        note.trashedAt = now();
        note.updatedAt = now();
      }

      await saveNotes(api, notes);
      return { success: true };
    },
  },

  {
    name: "search_notes",
    description: "Search notes by query string across title, content, and tags (case-insensitive).",
    parameters: z.object({
      query: z.string().describe("Search query string"),
      folder_id: z.string().optional().describe("Scope search to a folder"),
    }),
    execute: async (params: unknown, api: PluginAPI) => {
      const { query, folder_id } = params as { query: string; folder_id?: string };
      let notes = await getNotes(api);
      if (folder_id) notes = notes.filter((n) => n.folderId === folder_id);

      const q = query.toLowerCase();
      const results = notes.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q) ||
          n.tags.some((t) => t.toLowerCase().includes(q))
      );

      return { notes: results, count: results.length };
    },
  },

  // -----------------------------------------------------------------------
  // New tools
  // -----------------------------------------------------------------------
  {
    name: "pin_note",
    description: "Toggle the pinned state of a note.",
    parameters: z.object({
      note_id: z.string().describe("The note ID to pin/unpin"),
    }),
    execute: async (params: unknown, api: PluginAPI) => {
      const { note_id } = params as { note_id: string };
      const notes = await getNotes(api);
      const note = notes.find((n) => n.id === note_id);
      if (!note) return { success: false, error: "Note not found" };

      note.pinned = !note.pinned;
      note.updatedAt = now();
      await saveNotes(api, notes);
      return { success: true, pinned: note.pinned };
    },
  },

  {
    name: "archive_note",
    description: "Archive or unarchive a note.",
    parameters: z.object({
      note_id: z.string().describe("The note ID"),
      unarchive: z.boolean().optional().default(false).describe("Set to true to unarchive"),
    }),
    execute: async (params: unknown, api: PluginAPI) => {
      const { note_id, unarchive } = params as { note_id: string; unarchive?: boolean };
      const notes = await getNotes(api);
      const note = notes.find((n) => n.id === note_id);
      if (!note) return { success: false, error: "Note not found" };

      if (unarchive) {
        note.status = "active";
        note.archivedAt = null;
      } else {
        note.status = "archived";
        note.archivedAt = now();
      }
      note.updatedAt = now();
      await saveNotes(api, notes);
      return { success: true, status: note.status };
    },
  },

  {
    name: "move_note",
    description: "Move a note to a different folder.",
    parameters: z.object({
      note_id: z.string().describe("The note ID"),
      folder_id: z.string().describe("Target folder ID (empty string to move to Inbox)"),
    }),
    execute: async (params: unknown, api: PluginAPI) => {
      const { note_id, folder_id } = params as { note_id: string; folder_id: string };
      const notes = await getNotes(api);
      const note = notes.find((n) => n.id === note_id);
      if (!note) return { success: false, error: "Note not found" };

      note.folderId = folder_id || undefined;
      note.updatedAt = now();
      await saveNotes(api, notes);
      return { success: true, folderId: note.folderId ?? null };
    },
  },

  {
    name: "list_note_folders",
    description: "List all note folders/notebooks.",
    parameters: z.object({}),
    execute: async (_params: unknown, api: PluginAPI) => {
      const folders = await getFolders(api);
      return { folders, count: folders.length };
    },
  },

  {
    name: "create_note_from_template",
    description: "Create a note from a built-in or user template.",
    parameters: z.object({
      template_id: z
        .string()
        .describe("Template ID (e.g. tpl-meeting, tpl-incident, tpl-daily, tpl-technical)"),
      title: z.string().optional().describe("Override the template title"),
      folder_id: z.string().optional().describe("Folder ID to place the note in"),
    }),
    execute: async (params: unknown, api: PluginAPI) => {
      const { template_id, title, folder_id } = params as {
        template_id: string;
        title?: string;
        folder_id?: string;
      };

      const userTemplates = (await api.db.get<NoteTemplate[]>(DB_KEYS.templates)) ?? [];
      const all = mergeTemplates(userTemplates);
      const template = all.find((t) => t.id === template_id);
      if (!template) return { success: false, error: `Template "${template_id}" not found` };

      const notes = await getNotes(api);
      const content = hydrateTemplate(template.content);
      const note: Note = {
        id: generateId(),
        title: title ?? template.name,
        content,
        contentFormat: "markdown",
        tags: template.tags,
        folderId: folder_id,
        status: "active",
        pinned: false,
        wordCount: countWords(content),
        trashedAt: null,
        archivedAt: null,
        createdAt: now(),
        updatedAt: now(),
      };
      notes.push(note);
      await saveNotes(api, notes);
      return { success: true, note };
    },
  },

  {
    name: "export_note",
    description: "Export a note's content as raw markdown.",
    parameters: z.object({
      note_id: z.string().describe("The note ID to export"),
    }),
    execute: async (params: unknown, api: PluginAPI) => {
      const { note_id } = params as { note_id: string };
      const notes = await getNotes(api);
      const note = notes.find((n) => n.id === note_id);
      if (!note) return { success: false, error: "Note not found" };

      return {
        success: true,
        title: note.title,
        markdown: note.content,
        tags: note.tags,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
      };
    },
  },
];
