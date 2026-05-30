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
import { SidebarStats } from "@radarboard/plugin-sdk/components/sidebar/sidebar-stats";
import { Button } from "@radarboard/ui/button";
import { cn } from "@radarboard/utils/cn";
import { Archive, ChevronDown, FolderPlus, Inbox, LayoutList, MoreHorizontal } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import type { Task, TaskFolder } from "../types";

type FolderSelection = "all" | "inbox" | string; // string = folderId

function computeTaskCounts(tasks: Task[], folders: TaskFolder[]) {
  const counts = new Map<string, number>();
  let inbox = 0;
  let total = 0;
  for (const t of tasks) {
    if (t.deletedAt !== null) continue;
    total++;
    if (t.folderId) {
      counts.set(t.folderId, (counts.get(t.folderId) ?? 0) + 1);
      continue;
    }
    if (!t.projectId) {
      inbox++;
      continue;
    }
    const folder = folders.find((f) => f.type === "project" && f.projectSlug === t.projectId);
    if (folder) {
      counts.set(folder.id, (counts.get(folder.id) ?? 0) + 1);
    } else {
      inbox++;
    }
  }
  return { counts, inbox, total };
}

interface TaskFolderSidebarProps {
  folders: TaskFolder[];
  tasks: Task[];
  selectedFolder: FolderSelection;
  onSelectFolder: (selection: FolderSelection) => void;
  onAddFolder: (name: string) => Promise<TaskFolder>;
  onRenameFolder: (id: string, name: string) => Promise<void>;
  onArchiveFolder: (id: string) => Promise<void>;
  onDeleteFolder: (id: string) => Promise<void>;
}

export type { FolderSelection };

export function TaskFolderSidebar({
  folders,
  tasks,
  selectedFolder,
  onSelectFolder,
  onAddFolder,
  onRenameFolder,
  onArchiveFolder,
  onDeleteFolder,
}: TaskFolderSidebarProps) {
  const [sidebarUi, setSidebarUi] = useState({
    contextMenuId: null as string | null,
    createName: "",
    editName: "",
    editingId: null as string | null,
    isCreating: false,
    showArchived: false,
  });
  const { contextMenuId, createName, editName, editingId, isCreating, showArchived } = sidebarUi;

  const taskCounts = useMemo(() => computeTaskCounts(tasks, folders), [tasks, folders]);

  const projectFolders = useMemo(
    () =>
      folders.filter((f) => f.type === "project" && !f.archived).sort((a, b) => a.order - b.order),
    [folders]
  );

  const customFolders = useMemo(
    () =>
      folders.filter((f) => f.type === "custom" && !f.archived).sort((a, b) => a.order - b.order),
    [folders]
  );

  const archivedFolders = useMemo(
    () => folders.filter((f) => f.archived).sort((a, b) => a.order - b.order),
    [folders]
  );

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

  const startEdit = useCallback((folder: TaskFolder) => {
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
              aria-label="Create custom folder"
            >
              <FolderPlus className="icon-base" />
            </Button>
          }
          stats={<SidebarStats value={String(taskCounts.total)} label="Active tasks" />}
        />
      }
    >
      {/* Fixed items */}
      <FolderItem
        icon={<LayoutList className="icon-sm" />}
        label="All Tasks"
        count={taskCounts.total}
        selected={selectedFolder === "all"}
        onClick={() => onSelectFolder("all")}
      />
      <FolderItem
        icon={<Inbox className="icon-sm" />}
        label="Inbox"
        count={taskCounts.inbox}
        selected={selectedFolder === "inbox"}
        onClick={() => onSelectFolder("inbox")}
      />

      {/* Project folders */}
      {projectFolders.length > 0 && (
        <SidebarSection title="Projects">
          {projectFolders.map((f) => (
            <FolderItem
              key={f.id}
              icon={<ColorDot color={f.color} />}
              label={f.name}
              count={taskCounts.counts.get(f.id) ?? 0}
              selected={selectedFolder === f.id}
              onClick={() => onSelectFolder(f.id)}
            />
          ))}
        </SidebarSection>
      )}

      {/* Custom folders */}
      {(customFolders.length > 0 || isCreating) && (
        <SidebarSection title="Custom">
          {customFolders.map((f) =>
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
                  icon={<ColorDot color={f.color ?? "#6b7280"} />}
                  label={f.name}
                  count={taskCounts.counts.get(f.id) ?? 0}
                  selected={selectedFolder === f.id}
                  onClick={() => onSelectFolder(f.id)}
                />
                {/* Context menu trigger */}
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
                {/* Simple dropdown */}
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
                      (taskCounts.counts.get(f.id) ?? 0) === 0
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
              onChange={(value) => setSidebarUi((current) => ({ ...current, createName: value }))}
              onSubmit={handleCreateSubmit}
              onCancel={() => {
                setSidebarUi((current) => ({ ...current, isCreating: false, createName: "" }));
              }}
              placeholder="Folder name..."
            />
          )}
        </SidebarSection>
      )}

      {/* Archived folders */}
      {archivedFolders.length > 0 && (
        <div className="mt-3">
          <Button
            type="button"
            onClick={() =>
              setSidebarUi((current) => ({ ...current, showArchived: !current.showArchived }))
            }
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
                count={taskCounts.counts.get(f.id) ?? 0}
                selected={selectedFolder === f.id}
                onClick={() => onSelectFolder(f.id)}
                dimmed
              />
            ))}
        </div>
      )}
    </SidebarShell>
  );
}
