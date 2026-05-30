import type { PluginAPI, PluginIntentHandler } from "@radarboard/plugin-sdk/types";
import type { IntentPayload, IntentResult } from "@radarboard/types/intent";
import { countWords, generateId, now } from "./note-operations";
import { DB_KEYS, type Note } from "./types";

function buildContent(payload: IntentPayload): string {
  switch (payload.kind) {
    case "link":
      return `[${payload.title}](${payload.url})${payload.description ? `\n\n${payload.description}` : ""}`;
    case "structured":
      return payload.bodyMarkdown ?? payload.title;
    case "text":
      return payload.body ?? "";
    default:
      return (payload as { title?: string }).title ?? "";
  }
}

export const notesIntents: PluginIntentHandler[] = [
  {
    action: "create-note",
    label: "Save as Note",
    accepts: ["text", "link", "structured"],
    handle: async (payload: IntentPayload, api: PluginAPI): Promise<IntentResult> => {
      const notes = (await api.db.get<Note[]>(DB_KEYS.notes)) ?? [];
      const content = buildContent(payload);
      const note: Note = {
        id: generateId(),
        title: payload.title,
        content,
        contentFormat: "markdown",
        tags: payload.tags ?? [],
        status: "active",
        pinned: false,
        wordCount: countWords(content),
        trashedAt: null,
        archivedAt: null,
        createdAt: now(),
        updatedAt: now(),
      };
      notes.push(note);
      await api.db.set(DB_KEYS.notes, notes);
      return { success: true, message: "Note created", createdItemId: note.id };
    },
  },
];
