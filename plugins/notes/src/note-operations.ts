import { generateId, now } from "@radarboard/plugin-sdk/utils";
import type { Note, NoteFolder, NoteSnapshot } from "./types";

export { generateId, now };

// ---------------------------------------------------------------------------
// Word count
// ---------------------------------------------------------------------------

/** Count words in a markdown string (strips markdown syntax roughly). */
export function countWords(markdown: string): number {
  if (!markdown) return 0;
  // Strip code blocks, then collapse whitespace and count tokens
  const stripped = markdown
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]+`/g, "")
    .replace(/[#*_~>[\]()!|-]/g, " ")
    .trim();
  if (!stripped) return 0;
  return stripped.split(/\s+/).length;
}

// ---------------------------------------------------------------------------
// HTML detection & conversion
// ---------------------------------------------------------------------------

const HTML_TAG_RE = /<\/?(?:p|div|br|strong|em|ul|ol|li|h[1-6]|blockquote|code|pre|a|span)\b/i;

/** Returns true if the string likely contains HTML from the old RichTextComposer. */
export function looksLikeHtml(value: string): boolean {
  return HTML_TAG_RE.test(value);
}

/**
 * Minimal HTML-to-markdown fallback for migration.
 *
 * The proper conversion should use `turndown` at the call-site (which is a
 * browser-only dependency). This function handles the simplest cases so that
 * the migration can run without importing turndown directly.
 */
export function stripHtmlToPlaintext(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li>/gi, "- ")
    .replace(/<\/h([1-6])>/gi, "\n\n")
    .replace(/<h([1-6])[^>]*>/gi, (_m, level) => `${"#".repeat(Number(level))} `)
    .replace(/<strong>([\s\S]*?)<\/strong>/gi, "**$1**")
    .replace(/<em>([\s\S]*?)<\/em>/gi, "*$1*")
    .replace(/<code>([\s\S]*?)<\/code>/gi, "`$1`")
    .replace(/<blockquote>([\s\S]*?)<\/blockquote>/gi, "> $1")
    .replace(/<a\s+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ---------------------------------------------------------------------------
// Note normalisation (v1 → v2 migration)
// ---------------------------------------------------------------------------

/**
 * Ensure a raw note object (possibly from schema v1) has all v2 fields.
 * Missing fields are back-filled with safe defaults.
 */
export function normalizeNote(raw: Record<string, unknown> & { id: string }): Note {
  const content = typeof raw.content === "string" ? raw.content : "";
  const migratedContent = looksLikeHtml(content) ? stripHtmlToPlaintext(content) : content;

  return {
    id: raw.id,
    title: typeof raw.title === "string" ? raw.title : "",
    content: migratedContent,
    contentFormat: "markdown",
    tags: Array.isArray(raw.tags) ? (raw.tags as string[]) : [],
    folderId: typeof raw.folderId === "string" ? raw.folderId : undefined,
    status: isValidStatus(raw.status) ? raw.status : "active",
    pinned: typeof raw.pinned === "boolean" ? raw.pinned : false,
    wordCount: typeof raw.wordCount === "number" ? raw.wordCount : countWords(migratedContent),
    trashedAt: typeof raw.trashedAt === "string" ? raw.trashedAt : null,
    archivedAt: typeof raw.archivedAt === "string" ? raw.archivedAt : null,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : now(),
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : now(),
  };
}

function isValidStatus(v: unknown): v is Note["status"] {
  return v === "active" || v === "archived" || v === "trashed";
}

// ---------------------------------------------------------------------------
// Folder normalisation
// ---------------------------------------------------------------------------

export function normalizeFolder(raw: Record<string, unknown> & { id: string }): NoteFolder {
  return {
    id: raw.id,
    name: typeof raw.name === "string" ? raw.name : "Untitled",
    color: typeof raw.color === "string" ? raw.color : undefined,
    icon: typeof raw.icon === "string" ? raw.icon : undefined,
    archived: typeof raw.archived === "boolean" ? raw.archived : false,
    order: typeof raw.order === "number" ? raw.order : 0,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : now(),
  };
}

// ---------------------------------------------------------------------------
// Snapshot helpers
// ---------------------------------------------------------------------------

const MAX_SNAPSHOTS_PER_NOTE = 50;

export function pruneSnapshots(snapshots: NoteSnapshot[], noteId: string): NoteSnapshot[] {
  const forNote = snapshots.filter((s) => s.noteId === noteId);
  if (forNote.length <= MAX_SNAPSHOTS_PER_NOTE) return snapshots;

  // Keep the most recent MAX_SNAPSHOTS_PER_NOTE
  const sorted = [...forNote].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const toRemove = new Set(sorted.slice(MAX_SNAPSHOTS_PER_NOTE).map((s) => s.id));
  return snapshots.filter((s) => !toRemove.has(s.id));
}

// ---------------------------------------------------------------------------
// Note count helpers
// ---------------------------------------------------------------------------

export interface NoteCounts {
  all: number;
  inbox: number;
  favorites: number;
  archive: number;
  trash: number;
  byFolder: Map<string, number>;
}

export function computeNoteCounts(notes: Note[]): NoteCounts {
  let all = 0;
  let inbox = 0;
  let favorites = 0;
  let archive = 0;
  let trash = 0;
  const byFolder = new Map<string, number>();

  for (const n of notes) {
    if (n.status === "trashed") {
      trash++;
      continue;
    }
    if (n.status === "archived") {
      archive++;
      continue;
    }
    // active
    all++;
    if (n.pinned) favorites++;
    if (n.folderId) {
      byFolder.set(n.folderId, (byFolder.get(n.folderId) ?? 0) + 1);
    } else {
      inbox++;
    }
  }

  return { all, inbox, favorites, archive, trash, byFolder };
}
