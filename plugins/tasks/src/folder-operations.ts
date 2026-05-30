import type { TaskFolder } from "./types";

export function generateFolderId(): string {
  return `f-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function now(): string {
  return new Date().toISOString();
}

export interface ProjectInfo {
  slug: string;
  name: string;
  color: string;
}

/**
 * Normalize a raw folder record — fills defaults for fields that may be missing.
 */
export function normalizeFolder(raw: Record<string, unknown> & { id: string }): TaskFolder {
  return {
    id: raw.id,
    name: (raw.name as string) ?? "Untitled",
    type: (raw.type as TaskFolder["type"]) ?? "custom",
    projectSlug: raw.projectSlug as string | undefined,
    color: raw.color as string | undefined,
    archived: (raw.archived as boolean) ?? false,
    order: (raw.order as number) ?? 0,
    createdAt: (raw.createdAt as string) ?? now(),
  };
}

/**
 * Sync folders with the current project list.
 *
 * - Creates a new folder for each project that doesn't have one
 * - Archives folders for projects that no longer exist
 * - Un-archives folders for projects that reappear
 *
 * Returns the updated folder list (only if changes were made, otherwise same ref).
 */
function shouldArchiveFolder(folder: TaskFolder, activeSlugs: Set<string>): boolean {
  return (
    folder.type === "project" &&
    !!folder.projectSlug &&
    !activeSlugs.has(folder.projectSlug) &&
    !folder.archived
  );
}

function upsertProjectFolders(
  updated: TaskFolder[],
  projects: ProjectInfo[],
  existingBySlug: Map<string, TaskFolder>,
  startOrder: number
): boolean {
  let changed = false;
  let nextOrder = startOrder;

  for (const project of projects) {
    const existing = existingBySlug.get(project.slug);
    if (!existing) {
      updated.push({
        id: generateFolderId(),
        name: project.name,
        type: "project",
        projectSlug: project.slug,
        color: project.color,
        archived: false,
        order: nextOrder++,
        createdAt: now(),
      });
      changed = true;
      continue;
    }

    const needsUpdate =
      existing.archived || existing.name !== project.name || existing.color !== project.color;
    if (!needsUpdate) continue;

    const idx = updated.findIndex((f) => f.id === existing.id);
    if (idx === -1) continue;

    updated[idx] = { ...existing, archived: false, name: project.name, color: project.color };
    changed = true;
  }
  return changed;
}

export function syncFoldersWithProjects(
  folders: TaskFolder[],
  projects: ProjectInfo[]
): { folders: TaskFolder[]; changed: boolean } {
  const projectSlugs = new Set(projects.map((p) => p.slug));
  const existingBySlug = new Map<string, TaskFolder>();
  for (const f of folders) {
    if (f.type === "project" && f.projectSlug) {
      existingBySlug.set(f.projectSlug, f);
    }
  }

  const updated = [...folders];
  const maxOrder = folders.reduce((max, f) => Math.max(max, f.order), 0);
  let changed = upsertProjectFolders(updated, projects, existingBySlug, maxOrder + 1);

  for (let i = 0; i < updated.length; i++) {
    const folder = updated[i];
    if (folder && shouldArchiveFolder(folder, projectSlugs)) {
      updated[i] = { ...folder, archived: true };
      changed = true;
    }
  }

  return { folders: updated, changed };
}
