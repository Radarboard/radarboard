"use client";

import { ColorDot } from "@radarboard/plugin-sdk/components/sidebar/color-dot";
import { SidebarContextMenu as ContextMenu } from "@radarboard/plugin-sdk/components/sidebar/context-menu";
import { FolderItem } from "@radarboard/plugin-sdk/components/sidebar/folder-item";
import { InlineEditInput as InlineInput } from "@radarboard/plugin-sdk/components/sidebar/inline-input";
import { SidebarSection } from "@radarboard/plugin-sdk/components/sidebar/section-header";
import {
  SidebarHeader,
  SidebarShell,
} from "@radarboard/plugin-sdk/components/sidebar/sidebar-shell";
import { Button } from "@radarboard/ui/button";
import { cn } from "@radarboard/utils/cn";
import {
  Archive,
  ChevronDown,
  FolderPlus,
  Inbox,
  LayoutList,
  MoreHorizontal,
  Star,
  Trash2,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { computeNoteCounts } from "../note-operations";
import type { FolderSelection, Note, NoteFolder } from "../types";

interface NoteFolderSidebarProps {
  folders: NoteFolder[];
  notes: Note[];
  selectedFolder: FolderSelection;
  onSelectFolder: (selection: FolderSelection) => void;
  onAddFolder: (name: string) => Promise<NoteFolder>;
  onRenameFolder: (id: string, name: string) => Promise<void>;
  onArchiveFolder: (id: string) => Promise<void>;
  onDeleteFolder: (id: string) => Promise<void>;
  /** When set, filters notes list by tag */
  onFilterByTag?: (tag: string) => void;
}

export function NoteFolderSidebar({
  folders,
  notes,
  selectedFolder,
  onSelectFolder,
  onAddFolder,
  onRenameFolder,
  onArchiveFolder,
  onDeleteFolder,
  onFilterByTag,
}: NoteFolderSidebarProps) {
  const [sidebarUi, setSidebarUi] = useState({
    contextMenuId: null as string | null,
    createName: "",
    editName: "",
    editingId: null as string | null,
    isCreating: false,
    showArchived: false,
  });
  const { contextMenuId, createName, editName, editingId, isCreating, showArchived } = sidebarUi;

  const counts = useMemo(() => computeNoteCounts(notes), [notes]);

  const activeFolders = useMemo(
    () => folders.filter((f) => !f.archived).sort((a, b) => a.order - b.order),
    [folders]
  );

  const archivedFolders = useMemo(
    () => folders.filter((f) => f.archived).sort((a, b) => a.order - b.order),
    [folders]
  );

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const n of notes) {
      if (n.status === "active") {
        for (const t of n.tags) set.add(t);
      }
    }
    return [...set].sort();
  }, [notes]);

  const handleCreateSubmit = useCallback(async () => {
    const trimmed = createName.trim();
    if (!trimmed) return;
    await onAddFolder(trimmed);
    setSidebarUi((current) => ({ ...current, createName: "", isCreating: false }));
  }, [createName, onAddFolder]);

  const handleEditSubmit = useCallback(async () => {
    if (!editingId) return;
    const trimmed = editName.trim();
    if (!trimmed) return;
    await onRenameFolder(editingId, trimmed);
    setSidebarUi((current) => ({ ...current, editingId: null, editName: "" }));
  }, [editingId, editName, onRenameFolder]);

  const startEdit = useCallback((folder: NoteFolder) => {
    setSidebarUi((current) => ({
      ...current,
      editingId: folder.id,
      editName: folder.name,
      contextMenuId: null,
    }));
  }, []);

  return (
    <SidebarShell
      header={
        <SidebarHeader
          label="Folders"
          action={
            <Button
              type="button"
              onClick={() => setSidebarUi((current) => ({ ...current, isCreating: true }))}
              variant="ghost"
              size="icon"
              uppercase={false}
              className="text-dim hover:text-foreground-secondary"
              aria-label="Create notebook"
            >
              <FolderPlus className="icon-base" />
            </Button>
          }
        />
      }
    >
      {/* Smart folders */}
      <FolderItem
        icon={<LayoutList className="icon-sm" />}
        label="All Notes"
        count={counts.all}
        selected={selectedFolder === "all"}
        onClick={() => onSelectFolder("all")}
      />
      <FolderItem
        icon={<Inbox className="icon-sm" />}
        label="Inbox"
        count={counts.inbox}
        selected={selectedFolder === "inbox"}
        onClick={() => onSelectFolder("inbox")}
      />
      <FolderItem
        icon={<Star className="icon-sm" />}
        label="Favorites"
        count={counts.favorites}
        selected={selectedFolder === "favorites"}
        onClick={() => onSelectFolder("favorites")}
      />
      <FolderItem
        icon={<Archive className="icon-sm" />}
        label="Archive"
        count={counts.archive}
        selected={selectedFolder === "archive"}
        onClick={() => onSelectFolder("archive")}
      />
      <FolderItem
        icon={<Trash2 className="icon-sm" />}
        label="Trash"
        count={counts.trash}
        selected={selectedFolder === "trash"}
        onClick={() => onSelectFolder("trash")}
      />

      {/* Custom notebooks */}
      {(activeFolders.length > 0 || isCreating) && (
        <SidebarSection title="Notebooks">
          {activeFolders.map((f) =>
            editingId === f.id ? (
              <InlineInput
                key={f.id}
                value={editName}
                onChange={(value) => setSidebarUi((current) => ({ ...current, editName: value }))}
                onSubmit={handleEditSubmit}
                onCancel={() => setSidebarUi((current) => ({ ...current, editingId: null }))}
              />
            ) : (
              <div key={f.id} className="group relative">
                <FolderItem
                  icon={<ColorDot color={f.color} />}
                  label={f.name}
                  count={counts.byFolder.get(f.id) ?? 0}
                  selected={selectedFolder === f.id}
                  onClick={() => onSelectFolder(f.id)}
                />
                <Button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSidebarUi((current) => ({
                      ...current,
                      contextMenuId: current.contextMenuId === f.id ? null : f.id,
                    }));
                  }}
                  variant="ghost"
                  size="icon"
                  uppercase={false}
                  className="absolute top-1/2 right-2 -translate-y-1/2 text-dim opacity-0 hover:text-foreground-secondary group-hover:opacity-100"
                  aria-label="Folder options"
                >
                  <MoreHorizontal className="icon-base" />
                </Button>
                {contextMenuId === f.id && (
                  <ContextMenu
                    onRename={() => startEdit(f)}
                    onArchive={() => {
                      onArchiveFolder(f.id).catch(() => {
                        /* fire-and-forget */
                      });
                      setSidebarUi((current) => ({ ...current, contextMenuId: null }));
                    }}
                    onDelete={
                      (counts.byFolder.get(f.id) ?? 0) === 0
                        ? () => {
                            onDeleteFolder(f.id).catch(() => {
                              /* fire-and-forget */
                            });
                            setSidebarUi((current) => ({ ...current, contextMenuId: null }));
                          }
                        : undefined
                    }
                    onClose={() => setSidebarUi((current) => ({ ...current, contextMenuId: null }))}
                  />
                )}
              </div>
            )
          )}

          {Boolean(isCreating) && (
            <InlineInput
              value={createName}
              onChange={(v: string) => setSidebarUi((c) => ({ ...c, createName: v }))}
              onSubmit={handleCreateSubmit}
              onCancel={() => {
                setSidebarUi((c) => ({ ...c, isCreating: false, createName: "" }));
              }}
              placeholder="Notebook name..."
            />
          )}
        </SidebarSection>
      )}

      {/* Archived folders */}
      {archivedFolders.length > 0 && (
        <div className="mt-3">
          <Button
            type="button"
            onClick={() => setSidebarUi((c) => ({ ...c, showArchived: !c.showArchived }))}
            variant="ghost"
            uppercase
            className="h-auto w-full justify-start gap-1 px-3 py-1 text-dim hover:text-foreground-secondary"
          >
            <ChevronDown
              className={cn("icon-xs transition-transform", !showArchived && "-rotate-90")}
            />
            Archived
          </Button>
          {Boolean(showArchived) &&
            archivedFolders.map((f) => (
              <FolderItem
                key={f.id}
                icon={<Archive className="icon-xs text-dim" />}
                label={f.name}
                count={counts.byFolder.get(f.id) ?? 0}
                selected={selectedFolder === f.id}
                onClick={() => onSelectFolder(f.id)}
                dimmed
              />
            ))}
        </div>
      )}

      {/* Tags */}
      {allTags.length > 0 && (
        <SidebarSection title="Tags">
          <div className="mt-1 flex flex-wrap gap-1">
            {allTags.slice(0, 20).map((tag) => (
              <Button
                key={tag}
                type="button"
                onClick={() => onFilterByTag?.(tag)}
                variant="outline"
                size="xs"
                uppercase={false}
                className="text-dim hover:border-foreground-secondary/30 hover:text-foreground-secondary"
              >
                {tag}
              </Button>
            ))}
          </div>
        </SidebarSection>
      )}
    </SidebarShell>
  );
}
