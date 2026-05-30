"use client";

import {
  FormField,
  FormInput,
  FormSelect,
  PluginFormDialog,
} from "@radarboard/plugin-sdk/components/form-dialog";
import { PluginListHeader } from "@radarboard/plugin-sdk/components/list-header";
import { PluginEmptyState } from "@radarboard/plugin-sdk/components/plugin-empty";
import { ThreePaneWorkspace } from "@radarboard/plugin-sdk/components/three-pane-workspace";
import type { PluginRenderProps } from "@radarboard/plugin-sdk/types";
import { usePluginSearchParam } from "@radarboard/plugin-sdk/use-plugin-search-param";
import { SkeletonShimmer } from "@radarboard/ui/skeleton-shimmer";
import { StickyNote } from "lucide-react";
import { useCallback, useState } from "react";
import useSWR from "swr";
import { useNoteSearch } from "../hooks/use-note-search";
import { useNoteSnapshots } from "../hooks/use-note-snapshots";
import { DB_KEYS, type FolderSelection, type NoteTemplate } from "../types";
import { useNoteFolders } from "../use-note-folders";
import { useNotes } from "../use-notes";
import { NoteEditor } from "./note-editor";
import { NoteFolderSidebar } from "./note-folder-sidebar";
import { NoteHistory } from "./note-history";
import { NoteListItem } from "./note-list-item";
import { TemplateManager } from "./template-manager";
import { TemplatePicker } from "./template-picker";

const SMART_FOLDERS = new Set(["all", "inbox", "favorites", "archive", "trash"]);

function isCustomFolder(folder: string): boolean {
  return typeof folder === "string" && !SMART_FOLDERS.has(folder);
}

function getEmptyStateTitle(searchQuery: string, folder: FolderSelection): string {
  if (searchQuery) return "No notes match your search.";
  if (folder === "trash") return "Trash is empty.";
  if (folder === "archive") return "No archived notes.";
  if (folder === "favorites") return "No pinned notes yet.";
  return "No notes yet.";
}

async function loadTemplates(db: PluginRenderProps["api"]["db"]) {
  return (await db.get<NoteTemplate[]>(DB_KEYS.templates)) ?? [];
}

function NotesListPane({
  searchQuery,
  selectedFolder,
  selectedNote,
  setOverlayUi,
  userTemplates,
  visibleNotes,
  addTemplateAction,
  createNoteAction,
  createFromTemplateAction,
  pinNote,
}: {
  searchQuery: string;
  selectedFolder: FolderSelection;
  selectedNote: import("../types").Note | null;
  setOverlayUi: React.Dispatch<
    React.SetStateAction<{
      newFolderId: string;
      newTitle: string;
      searchQuery: string;
      selectedFolder: FolderSelection;
      selectedNoteId: string | null;
      showCreateModal: boolean;
      showHistory: boolean;
      showTemplateManager: boolean;
    }>
  >;
  userTemplates: NoteTemplate[];
  visibleNotes: import("../types").Note[];
  addTemplateAction: () => void;
  createNoteAction: () => void;
  createFromTemplateAction: (template: {
    title: string;
    content: string;
    tags: string[];
  }) => Promise<void>;
  pinNote: (id: string) => Promise<void>;
}) {
  return (
    <div className="flex h-full flex-col">
      <PluginListHeader
        label="Notes"
        search={{
          value: searchQuery,
          onChange: (value) => setOverlayUi((current) => ({ ...current, searchQuery: value })),
          placeholder: "Search notes...",
        }}
        addButton={{
          label: "New Note",
          onClick: createNoteAction,
          custom: (
            <TemplatePicker
              userTemplates={userTemplates}
              onBlankNote={createNoteAction}
              onSelect={createFromTemplateAction}
              onManage={addTemplateAction}
            />
          ),
        }}
        count={`${visibleNotes.length} note${visibleNotes.length !== 1 ? "s" : ""}${searchQuery ? ` matching "${searchQuery}"` : ""}`}
      />

      <div className="scrollbar-thin flex-1 divide-y divide-border overflow-y-auto overflow-x-hidden">
        {visibleNotes.length === 0 ? (
          <PluginEmptyState
            title={getEmptyStateTitle(searchQuery, selectedFolder)}
            description={
              !searchQuery && selectedFolder === "all" ? "Create one to get started." : undefined
            }
            action={
              !searchQuery && selectedFolder === "all"
                ? { label: "New Note", onClick: createNoteAction }
                : undefined
            }
          />
        ) : (
          visibleNotes.map((note) => (
            <NoteListItem
              key={note.id}
              note={note}
              selected={selectedNote?.id === note.id}
              searchQuery={searchQuery}
              onClick={() =>
                setOverlayUi((current) => ({
                  ...current,
                  selectedNoteId: note.id,
                  showHistory: false,
                }))
              }
              onPin={pinNote}
            />
          ))
        )}
      </div>
    </div>
  );
}

function CreateNoteDialog({
  folders,
  newFolderId,
  newTitle,
  onClose,
  onSubmit,
  setOverlayUi,
  showCreateModal,
}: {
  folders: import("../types").NoteFolder[];
  newFolderId: string;
  newTitle: string;
  onClose: () => void;
  onSubmit: () => Promise<void>;
  setOverlayUi: React.Dispatch<
    React.SetStateAction<{
      newFolderId: string;
      newTitle: string;
      searchQuery: string;
      selectedFolder: FolderSelection;
      selectedNoteId: string | null;
      showCreateModal: boolean;
      showHistory: boolean;
      showTemplateManager: boolean;
    }>
  >;
  showCreateModal: boolean;
}) {
  return (
    <PluginFormDialog
      open={showCreateModal}
      onClose={onClose}
      title="New Note"
      onSubmit={onSubmit}
      submitLabel="Create Note"
      submitDisabled={!newTitle.trim()}
    >
      <FormField label="Title">
        <FormInput
          placeholder="Note title..."
          value={newTitle}
          ref={(node) => node?.focus()}
          onChange={(e) => setOverlayUi((current) => ({ ...current, newTitle: e.target.value }))}
        />
      </FormField>

      <FormField label="Folder">
        <FormSelect
          value={newFolderId}
          onChange={(e) => setOverlayUi((current) => ({ ...current, newFolderId: e.target.value }))}
        >
          <option value="">(None)</option>
          {folders.map((folder) => (
            <option key={folder.id} value={folder.id}>
              {folder.name}
            </option>
          ))}
        </FormSelect>
      </FormField>
    </PluginFormDialog>
  );
}

export function NotesOverlay({ api }: PluginRenderProps) {
  const {
    notes,
    loaded: notesLoaded,
    addNote,
    updateNote,
    deleteNote,
    pinNote,
    archiveNote,
    trashNote,
    restoreNote,
    moveToFolder,
  } = useNotes(api);

  const {
    folders,
    loaded: foldersLoaded,
    addFolder,
    renameFolder,
    archiveFolder,
    deleteFolder,
  } = useNoteFolders(api);

  const { createSnapshot, getSnapshotsForNote } = useNoteSnapshots(api);

  const [overlayUi, setOverlayUi] = useState({
    newFolderId: "",
    newTitle: "",
    searchQuery: "",
    selectedFolder: "all" as FolderSelection,
    selectedNoteId: null as string | null,
    showCreateModal: false,
    showHistory: false,
    showTemplateManager: false,
  });
  const {
    newFolderId,
    newTitle,
    searchQuery,
    selectedFolder,
    selectedNoteId,
    showCreateModal,
    showHistory,
    showTemplateManager,
  } = overlayUi;

  const urlNoteId = usePluginSearchParam(api, "noteId", "notes");
  const effectiveSelectedFolder = urlNoteId ? "all" : selectedFolder;
  const effectiveSearchQuery = urlNoteId ? "" : searchQuery;
  const effectiveSelectedNoteId = urlNoteId ?? selectedNoteId;
  const { data: userTemplates = [], mutate: mutateTemplates } = useSWR(
    ["notes-templates", api.db],
    ([, db]) => loadTemplates(db)
  );

  const persistTemplates = useCallback(
    async (updated: NoteTemplate[]) => {
      await mutateTemplates(updated, { revalidate: false });
      await api.db.set(DB_KEYS.templates, updated);
    },
    [api.db, mutateTemplates]
  );

  const addTemplate = useCallback(
    async (input: Pick<NoteTemplate, "name" | "description" | "content" | "tags" | "icon">) => {
      const id = `tpl-${Date.now()}`;
      const tpl: NoteTemplate = {
        id,
        name: input.name,
        description: input.description,
        content: input.content,
        tags: input.tags,
        icon: input.icon,
        builtIn: false,
        order: userTemplates.length + 100,
      };
      await persistTemplates([...userTemplates, tpl]);
      return tpl;
    },
    [userTemplates, persistTemplates]
  );

  const updateTemplate = useCallback(
    async (
      id: string,
      changes: Partial<Pick<NoteTemplate, "name" | "description" | "content" | "tags" | "icon">>
    ) => {
      const updated = userTemplates.map((t) => (t.id === id ? { ...t, ...changes } : t));
      await persistTemplates(updated);
    },
    [userTemplates, persistTemplates]
  );

  const removeTemplate = useCallback(
    async (id: string) => {
      await persistTemplates(userTemplates.filter((t) => t.id !== id));
    },
    [userTemplates, persistTemplates]
  );

  const searchResults = useNoteSearch(notes, effectiveSelectedFolder, effectiveSearchQuery);
  const visibleNotes = searchResults.map((r) => r.note);

  const selectedNote =
    visibleNotes.find((n) => n.id === effectiveSelectedNoteId) ?? visibleNotes[0] ?? null;

  const resolvedFolderId = useCallback(() => {
    if (newFolderId) return newFolderId;
    return isCustomFolder(effectiveSelectedFolder) ? effectiveSelectedFolder : undefined;
  }, [effectiveSelectedFolder, newFolderId]);

  const resetCreateForm = useCallback(() => {
    setOverlayUi((current) => ({
      ...current,
      newTitle: "",
      newFolderId: "",
    }));
  }, []);

  const handleCreateSubmit = useCallback(async () => {
    const note = await addNote({
      title: newTitle.trim() || "Untitled",
      folderId: resolvedFolderId(),
    });
    setOverlayUi((current) => ({
      ...current,
      selectedNoteId: note.id,
      showCreateModal: false,
      showHistory: false,
    }));
    resetCreateForm();
    api.notify("Note created", "success");
  }, [addNote, newTitle, resolvedFolderId, resetCreateForm, api]);

  const handleCreateFromTemplate = useCallback(
    async (template: { title: string; content: string; tags: string[] }) => {
      const folderId = isCustomFolder(effectiveSelectedFolder)
        ? effectiveSelectedFolder
        : undefined;
      const note = await addNote({
        title: template.title,
        content: template.content,
        tags: template.tags,
        folderId,
      });
      setOverlayUi((current) => ({
        ...current,
        selectedNoteId: note.id,
        showCreateModal: false,
        showHistory: false,
      }));
      api.notify(`Created from template: ${template.title}`, "success");
    },
    [addNote, effectiveSelectedFolder, api]
  );

  const handlePermanentDelete = useCallback(
    async (id: string) => {
      await deleteNote(id);
      setOverlayUi((current) => ({ ...current, selectedNoteId: null }));
      api.notify("Note permanently deleted", "success");
    },
    [deleteNote, api]
  );

  const handleFilterByTag = useCallback((tag: string) => {
    setOverlayUi((current) => ({
      ...current,
      searchQuery: tag,
      selectedFolder: "all",
    }));
  }, []);

  const handleCreateSnapshot = useCallback(
    (noteId: string, title: string, content: string) => {
      createSnapshot(noteId, title, content).catch(() => {
        /* fire-and-forget */
      });
    },
    [createSnapshot]
  );

  const handleRestoreSnapshot = useCallback(
    async (snapshot: { content: string; title: string }) => {
      if (!selectedNote) return;
      await updateNote(selectedNote.id, {
        content: snapshot.content,
        title: snapshot.title,
      });
      setOverlayUi((current) => ({ ...current, showHistory: false }));
      api.notify("Snapshot restored", "success");
    },
    [selectedNote, updateNote, api]
  );

  return (
    <SkeletonShimmer loading={!notesLoaded || !foldersLoaded}>
      <ThreePaneWorkspace
        className="bg-surface"
        initialSidebarWidth={220}
        initialListWidth={320}
        minSidebarWidth={180}
        minListWidth={260}
        minDetailWidth={420}
        sidebarClassName="border-r border-border bg-surface-raised flex flex-col"
        listClassName="border-r border-border flex flex-col"
        detailClassName="bg-surface flex flex-col"
        sidebarTabLabel="Folders"
        listTabLabel="Notes"
        detailKey={selectedNote?.id ?? null}
        sidebar={
          <NoteFolderSidebar
            folders={folders}
            notes={notes}
            selectedFolder={effectiveSelectedFolder}
            onSelectFolder={(f) => {
              setOverlayUi((current) => ({
                ...current,
                selectedFolder: f,
                searchQuery: "",
              }));
            }}
            onAddFolder={addFolder}
            onRenameFolder={renameFolder}
            onArchiveFolder={archiveFolder}
            onDeleteFolder={deleteFolder}
            onFilterByTag={handleFilterByTag}
          />
        }
        list={
          <NotesListPane
            searchQuery={effectiveSearchQuery}
            selectedFolder={effectiveSelectedFolder}
            selectedNote={selectedNote}
            setOverlayUi={setOverlayUi}
            userTemplates={userTemplates}
            visibleNotes={visibleNotes}
            addTemplateAction={() =>
              setOverlayUi((current) => ({ ...current, showTemplateManager: true }))
            }
            createNoteAction={() =>
              setOverlayUi((current) => ({ ...current, showCreateModal: true }))
            }
            createFromTemplateAction={handleCreateFromTemplate}
            pinNote={pinNote}
          />
        }
        detail={
          <NoteDetailPane
            note={selectedNote}
            showHistory={showHistory}
            folders={folders}
            getSnapshotsForNote={getSnapshotsForNote}
            onRestoreSnapshot={handleRestoreSnapshot}
            onCloseHistory={() => setOverlayUi((current) => ({ ...current, showHistory: false }))}
            onUpdate={updateNote}
            onPin={pinNote}
            onArchive={archiveNote}
            onTrash={trashNote}
            onRestore={restoreNote}
            onPermanentDelete={handlePermanentDelete}
            onMoveToFolder={moveToFolder}
            onShowHistory={() => setOverlayUi((current) => ({ ...current, showHistory: true }))}
            onCreateSnapshot={handleCreateSnapshot}
          />
        }
      />

      {/* ---------- Create Note Modal ---------- */}
      <CreateNoteDialog
        folders={folders}
        newFolderId={newFolderId}
        newTitle={newTitle}
        onClose={() => {
          setOverlayUi((current) => ({ ...current, showCreateModal: false }));
          resetCreateForm();
        }}
        onSubmit={handleCreateSubmit}
        setOverlayUi={setOverlayUi}
        showCreateModal={showCreateModal}
      />

      <TemplateManager
        open={showTemplateManager}
        onClose={() => setOverlayUi((current) => ({ ...current, showTemplateManager: false }))}
        userTemplates={userTemplates}
        onAdd={addTemplate}
        onUpdate={updateTemplate}
        onRemove={removeTemplate}
      />
    </SkeletonShimmer>
  );
}

function NoteDetailPane({
  note,
  showHistory,
  folders,
  getSnapshotsForNote,
  onRestoreSnapshot,
  onCloseHistory,
  onUpdate,
  onPin,
  onArchive,
  onTrash,
  onRestore,
  onPermanentDelete,
  onMoveToFolder,
  onShowHistory,
  onCreateSnapshot,
}: {
  note: import("../types").Note | null;
  showHistory: boolean;
  folders: import("../types").NoteFolder[];
  getSnapshotsForNote: (id: string) => import("../types").NoteSnapshot[];
  onRestoreSnapshot: (snapshot: { content: string; title: string }) => Promise<void>;
  onCloseHistory: () => void;
  onUpdate: (id: string, changes: Partial<import("../types").Note>) => Promise<void>;
  onPin: (id: string) => Promise<void>;
  onArchive: (id: string) => Promise<void>;
  onTrash: (id: string) => Promise<void>;
  onRestore: (id: string) => Promise<void>;
  onPermanentDelete: (id: string) => Promise<void>;
  onMoveToFolder: (id: string, folderId: string | undefined) => Promise<void>;
  onShowHistory: () => void;
  onCreateSnapshot: (noteId: string, title: string, content: string) => void;
}) {
  if (!note) {
    return (
      <PluginEmptyState
        icon={<StickyNote className="icon-lg" />}
        title="Select a note to view details"
        description="Or create a new one to get started."
      />
    );
  }

  if (showHistory) {
    return (
      <NoteHistory
        snapshots={getSnapshotsForNote(note.id)}
        onRestore={onRestoreSnapshot}
        onClose={onCloseHistory}
      />
    );
  }

  return (
    <NoteEditor
      key={note.id}
      note={note}
      folders={folders}
      onUpdate={onUpdate}
      onPin={onPin}
      onArchive={onArchive}
      onTrash={onTrash}
      onRestore={onRestore}
      onPermanentDelete={onPermanentDelete}
      onMoveToFolder={onMoveToFolder}
      onShowHistory={onShowHistory}
      onCreateSnapshot={onCreateSnapshot}
    />
  );
}
