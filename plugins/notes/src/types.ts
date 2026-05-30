/** Status lifecycle: active → archived → trashed → permanently deleted */
export type NoteStatus = "active" | "archived" | "trashed";

export interface Note {
  id: string;
  title: string;
  /** Markdown content — the canonical storage format */
  content: string;
  contentFormat: "markdown";
  tags: string[];
  folderId?: string;
  status: NoteStatus;
  pinned: boolean;
  wordCount: number;
  trashedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NoteFolder {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  archived: boolean;
  order: number;
  createdAt: string;
}

export interface NoteTemplate {
  id: string;
  name: string;
  description: string;
  /** Markdown body — may include `{date}` placeholders */
  content: string;
  tags: string[];
  icon?: string;
  builtIn: boolean;
  order: number;
}

export interface NoteSnapshot {
  id: string;
  noteId: string;
  title: string;
  content: string;
  createdAt: string;
}

export type SmartFolder = "all" | "inbox" | "favorites" | "archive" | "trash";
export type FolderSelection = SmartFolder | string;

export const DB_KEYS = {
  notes: "notes:list",
  folders: "notes:folders",
  templates: "notes:templates",
  snapshots: "notes:snapshots",
  schemaVersion: "notes:schema-version",
} as const;
