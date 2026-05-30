"use client";

import { useLayoutMode } from "@radarboard/plugin-sdk/components/layout-context";
import { PluginListHeader } from "@radarboard/plugin-sdk/components/list-header";
import { PluginListTabs } from "@radarboard/plugin-sdk/components/list-tabs";
import { ThreePaneWorkspace } from "@radarboard/plugin-sdk/components/three-pane-workspace";
import type { PluginRenderProps } from "@radarboard/plugin-sdk/types";
import { usePluginSearchParam } from "@radarboard/plugin-sdk/use-plugin-search-param";
import { Button } from "@radarboard/ui/button";
import { SkeletonShimmer } from "@radarboard/ui/skeleton-shimmer";
import { cn } from "@radarboard/utils/cn";
import { Columns3, List } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_KANBAN_COLUMNS,
  type KanbanColumn,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from "../types";
import { useTaskFolders } from "../use-task-folders";
import { useTasks } from "../use-tasks";
import { PomodoroTimer } from "./pomodoro";
import { TaskDetailPanel } from "./task-detail-panel";
import { TaskFilters } from "./task-filters";
import { type FolderSelection, TaskFolderSidebar } from "./task-folder-sidebar";
import { TaskFormDialog } from "./task-form";
import { TaskKanban } from "./task-kanban";
import { TaskList } from "./task-list";

type DisplayMode = "list" | "kanban";

const DISPLAY_MODE_KEY = "tasks:display-mode";
const KANBAN_COLUMNS_KEY = "tasks:kanban-columns";

function filterByFolder(
  tasks: Task[],
  selectedFolder: string,
  folders: Array<{ id: string; type: string; projectSlug?: string }>
): Task[] {
  if (selectedFolder === "all") return tasks;
  if (selectedFolder === "inbox") {
    return tasks.filter((t) => !t.folderId && !t.projectId);
  }
  const folder = folders.find((f) => f.id === selectedFolder);
  if (!folder) return tasks;

  return tasks.filter((t) => {
    if (t.folderId === folder.id) return true;
    return (
      !t.folderId &&
      folder.type === "project" &&
      !!folder.projectSlug &&
      t.projectId === folder.projectSlug
    );
  });
}

function applyTaskFilters(
  tasks: Task[],
  viewMode: "active" | "trash",
  statusFilter: TaskStatus | "all",
  priorityFilter: TaskPriority | "all"
): Task[] {
  if (viewMode === "trash") {
    return tasks.filter((t) => t.deletedAt !== null);
  }
  return tasks.filter((t) => {
    if (t.deletedAt !== null) return false;
    if (statusFilter === "all") {
      if (t.status === "archived") return false;
    } else if (t.status !== statusFilter) {
      return false;
    }
    if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
    return true;
  });
}

function TasksOverlayHeader({
  effectiveDisplayMode,
  filteredTasksCount,
  handleDisplayModeChange,
  isDrawer,
  pinPomodoro,
  priorityFilter,
  setOverlayUi,
  statusFilter,
  viewMode,
}: {
  effectiveDisplayMode: "list" | "kanban";
  filteredTasksCount: number;
  handleDisplayModeChange: (mode: DisplayMode) => void;
  isDrawer: boolean;
  pinPomodoro: React.ReactNode;
  priorityFilter: TaskPriority | "all";
  statusFilter: TaskStatus | "all";
  setOverlayUi: React.Dispatch<
    React.SetStateAction<{
      displayMode: DisplayMode;
      kanbanColumns: KanbanColumn[];
      priorityFilter: TaskPriority | "all";
      selectedFolder: FolderSelection;
      selectedTask: Task | null;
      showForm: boolean;
      statusFilter: TaskStatus | "all";
      viewMode: "active" | "trash";
    }>
  >;
  viewMode: "active" | "trash";
}) {
  return (
    <>
      <PluginListHeader
        label="Tasks"
        addButton={
          viewMode === "active"
            ? {
                label: "New Task",
                onClick: () => setOverlayUi((current) => ({ ...current, showForm: true })),
              }
            : undefined
        }
        count={`${filteredTasksCount} task${filteredTasksCount !== 1 ? "s" : ""}`}
        extra={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                uppercase={false}
                onClick={() => handleDisplayModeChange("list")}
                className={cn(
                  "rounded p-1 transition-colors",
                  effectiveDisplayMode === "list"
                    ? "bg-secondary text-foreground-secondary"
                    : "text-dim hover:text-foreground-secondary"
                )}
                aria-label="List view"
                disabled={viewMode === "trash"}
              >
                <List className="icon-base" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                uppercase={false}
                onClick={() => handleDisplayModeChange("kanban")}
                className={cn(
                  "rounded p-1 transition-colors",
                  effectiveDisplayMode === "kanban"
                    ? "bg-secondary text-foreground-secondary"
                    : "text-dim hover:text-foreground-secondary",
                  (viewMode === "trash" || isDrawer) && "cursor-not-allowed opacity-40"
                )}
                aria-label="Kanban view"
                disabled={viewMode === "trash" || isDrawer}
              >
                <Columns3 className="icon-base" />
              </Button>
            </div>
            {pinPomodoro}
          </div>
        }
      />

      <PluginListTabs
        tabs={[
          { value: "active" as const, label: "Active" },
          {
            value: "trash" as const,
            label: "Trash",
            activeClassName: "bg-red-500/20 text-red-400",
          },
        ]}
        value={viewMode}
        onChange={(value) => setOverlayUi((current) => ({ ...current, viewMode: value }))}
      />

      {viewMode === "active" ? (
        <TaskFilters
          statusFilter={statusFilter}
          priorityFilter={priorityFilter}
          viewMode={viewMode}
          onStatusChange={(value) =>
            setOverlayUi((current) => ({ ...current, statusFilter: value }))
          }
          onPriorityChange={(value) =>
            setOverlayUi((current) => ({ ...current, priorityFilter: value }))
          }
          onViewModeChange={(value) => setOverlayUi((current) => ({ ...current, viewMode: value }))}
          displayMode={effectiveDisplayMode}
        />
      ) : null}

      {viewMode === "trash" ? (
        <div className="border-border border-b bg-red-500/5 px-4 py-2 text-red-400/70 text-w-sm">
          Tasks in trash are permanently deleted after 30 days
        </div>
      ) : null}
    </>
  );
}

export function TasksOverlay({ api }: PluginRenderProps) {
  const {
    tasks,
    pomodoro,
    loaded,
    addTask,
    updateTask,
    softDeleteTask,
    permanentDeleteTask,
    archiveTask,
    restoreTask,
    startPomodoro,
    stopPomodoro,
  } = useTasks(api);

  const {
    folders,
    loaded: foldersLoaded,
    addFolder,
    renameFolder,
    archiveFolder,
    deleteFolder,
  } = useTaskFolders(api);

  const [overlayUi, setOverlayUi] = useState({
    displayMode: "list" as DisplayMode,
    kanbanColumns: DEFAULT_KANBAN_COLUMNS,
    priorityFilter: "all" as TaskPriority | "all",
    selectedFolder: "all" as FolderSelection,
    selectedTask: null as Task | null,
    showForm: false,
    statusFilter: "all" as TaskStatus | "all",
    viewMode: "active" as "active" | "trash",
  });
  const {
    displayMode,
    kanbanColumns,
    priorityFilter,
    selectedFolder,
    selectedTask,
    showForm,
    statusFilter,
    viewMode,
  } = overlayUi;

  // Sync task selection from URL and custom event — reset filters so the
  // target task is visible regardless of the current filter state.
  const urlTaskId = usePluginSearchParam(api, "taskId", "tasks");
  useEffect(() => {
    if (!loaded || !urlTaskId) return;
    const task = tasks.find((t) => t.id === urlTaskId);
    if (task) {
      setOverlayUi((current) => ({
        ...current,
        statusFilter: "all",
        priorityFilter: "all",
        viewMode: task.deletedAt ? "trash" : "active",
        selectedTask: task,
      }));
    }
  }, [loaded, tasks, urlTaskId]);

  // Load persisted display mode and kanban columns
  useEffect(() => {
    api.db
      .get<DisplayMode>(DISPLAY_MODE_KEY)
      .then((mode) => {
        if (mode) setOverlayUi((current) => ({ ...current, displayMode: mode }));
      })
      .catch(() => {
        /* fire-and-forget */
      });
    api.db
      .get<KanbanColumn[]>(KANBAN_COLUMNS_KEY)
      .then((cols) => {
        if (cols && cols.length > 0) {
          setOverlayUi((current) => ({ ...current, kanbanColumns: cols }));
        }
      })
      .catch(() => {
        /* fire-and-forget */
      });
  }, [api]);

  // Persist display mode changes
  const handleDisplayModeChange = useCallback(
    (mode: DisplayMode) => {
      setOverlayUi((current) => ({ ...current, displayMode: mode }));
      api.db.set(DISPLAY_MODE_KEY, mode).catch(() => {
        /* fire-and-forget */
      });
    },
    [api]
  );

  // Persist kanban column changes
  const handleColumnsChange = useCallback(
    (cols: KanbanColumn[]) => {
      setOverlayUi((current) => ({ ...current, kanbanColumns: cols }));
      api.db.set(KANBAN_COLUMNS_KEY, cols).catch(() => {
        /* fire-and-forget */
      });
    },
    [api]
  );

  // Force list view in trash mode and drawer mode (kanban needs horizontal space)
  const layoutMode = useLayoutMode();
  const isDrawer = layoutMode === "drawer";
  const effectiveDisplayMode = viewMode === "trash" || isDrawer ? "list" : displayMode;

  // Keyboard shortcuts
  const handleShortcut = useCallback(
    ({
      key,
      preventDefault,
      stopPropagation,
      target,
    }: {
      key: string;
      preventDefault: () => void;
      stopPropagation?: () => void;
      target: EventTarget | null;
    }) => {
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      if (key === "Escape" && selectedTask) {
        preventDefault();
        stopPropagation?.();
        setOverlayUi((current) => ({ ...current, selectedTask: null }));
        return;
      }

      if (key === "n") {
        preventDefault();
        setOverlayUi((current) => ({ ...current, showForm: true }));
      }
    },
    [selectedTask]
  );

  useEffect(() => {
    const handleDocumentKeyDown = (event: KeyboardEvent) => {
      handleShortcut(event);
    };

    window.addEventListener("keydown", handleDocumentKeyDown);
    return () => window.removeEventListener("keydown", handleDocumentKeyDown);
  }, [handleShortcut]);

  // Derive available projects from tasks (for backward compat in detail panel)
  const projects = useMemo(() => {
    const ids = new Set<string>();
    for (const t of tasks) {
      if (t.projectId && t.deletedAt === null) ids.add(t.projectId);
    }
    return Array.from(ids).sort();
  }, [tasks]);

  const folderFilteredTasks = useMemo(
    () => filterByFolder(tasks, selectedFolder, folders),
    [tasks, selectedFolder, folders]
  );

  const filteredTasks = useMemo(
    () => applyTaskFilters(folderFilteredTasks, viewMode, statusFilter, priorityFilter),
    [folderFilteredTasks, statusFilter, priorityFilter, viewMode]
  );

  // Keep selectedTask in sync with task state
  const resolvedSelectedTask = useMemo(() => {
    if (!selectedTask) return null;
    return tasks.find((t) => t.id === selectedTask.id) ?? null;
  }, [tasks, selectedTask]);

  // Derive default folderId/projectId from selected folder for new tasks
  const defaultFolderContext = useMemo(() => {
    if (selectedFolder === "all" || selectedFolder === "inbox") return {};
    const folder = folders.find((f) => f.id === selectedFolder);
    if (!folder || folder.archived) return {};
    return {
      folderId: folder.id,
      projectId: folder.type === "project" ? folder.projectSlug : undefined,
    };
  }, [selectedFolder, folders]);

  const handleAddTask = useCallback(
    async (input: {
      title: string;
      description?: string;
      priority?: TaskPriority;
      dueDate?: string;
      projectId?: string;
    }) => {
      await addTask({
        ...input,
        // Apply folder context
        projectId: input.projectId || defaultFolderContext.projectId,
        folderId: defaultFolderContext.folderId,
      });
      setOverlayUi((current) => ({ ...current, showForm: false }));
      api.notify("Task created", "success");
    },
    [addTask, api, defaultFolderContext]
  );

  const handleStatusCycle = useCallback(
    async (id: string, nextStatus: TaskStatus) => {
      await updateTask(id, { status: nextStatus });
    },
    [updateTask]
  );

  return (
    <SkeletonShimmer loading={!loaded || !foldersLoaded}>
      <div className="flex h-full flex-col">
        <TasksOverlayHeader
          effectiveDisplayMode={effectiveDisplayMode}
          filteredTasksCount={filteredTasks.length}
          handleDisplayModeChange={handleDisplayModeChange}
          isDrawer={isDrawer}
          pinPomodoro={<PomodoroTimer session={pomodoro} onStop={stopPomodoro} compact />}
          priorityFilter={priorityFilter}
          setOverlayUi={setOverlayUi}
          statusFilter={statusFilter}
          viewMode={viewMode}
        />

        {/* New task dialog */}
        <TaskFormDialog
          open={showForm && viewMode === "active"}
          onClose={() => setOverlayUi((current) => ({ ...current, showForm: false }))}
          onSubmit={(input) => {
            handleAddTask(input).catch(() => {
              /* fire-and-forget */
            });
            setOverlayUi((current) => ({ ...current, showForm: false }));
          }}
        />

        <TasksMainContent
          effectiveDisplayMode={effectiveDisplayMode}
          folders={folders}
          tasks={tasks}
          filteredTasks={filteredTasks}
          kanbanColumns={kanbanColumns}
          selectedFolder={selectedFolder}
          resolvedSelectedTask={resolvedSelectedTask}
          viewMode={viewMode}
          projects={projects}
          pomodoro={pomodoro}
          onSelectFolder={(value) =>
            setOverlayUi((current) => ({ ...current, selectedFolder: value }))
          }
          onAddFolder={addFolder}
          onRenameFolder={renameFolder}
          onArchiveFolder={archiveFolder}
          onDeleteFolder={deleteFolder}
          onColumnsChange={handleColumnsChange}
          onStatusCycle={handleStatusCycle}
          onSelect={(task) => setOverlayUi((current) => ({ ...current, selectedTask: task }))}
          onUpdate={updateTask}
          onArchive={archiveTask}
          onDelete={softDeleteTask}
          onStartPomodoro={startPomodoro}
          onRestore={restoreTask}
          onPermanentDelete={permanentDeleteTask}
          onCloseDetail={() => setOverlayUi((current) => ({ ...current, selectedTask: null }))}
        />

        {/* Pomodoro section (when no compact display) */}
        {Boolean(pomodoro) && (
          <div className="border-border border-t bg-surface">
            <PomodoroTimer session={pomodoro} onStop={stopPomodoro} />
          </div>
        )}
      </div>
    </SkeletonShimmer>
  );
}

function TasksMainContent({
  effectiveDisplayMode,
  folders,
  tasks,
  filteredTasks,
  kanbanColumns,
  selectedFolder,
  resolvedSelectedTask,
  viewMode,
  projects,
  pomodoro,
  onSelectFolder,
  onAddFolder,
  onRenameFolder,
  onArchiveFolder,
  onDeleteFolder,
  onColumnsChange,
  onStatusCycle,
  onSelect,
  onUpdate,
  onArchive,
  onDelete,
  onStartPomodoro,
  onRestore,
  onPermanentDelete,
  onCloseDetail,
}: {
  effectiveDisplayMode: "list" | "kanban";
  folders: Array<import("../types").TaskFolder>;
  tasks: Task[];
  filteredTasks: Task[];
  kanbanColumns: KanbanColumn[];
  selectedFolder: FolderSelection;
  resolvedSelectedTask: Task | null;
  viewMode: "active" | "trash";
  projects: string[];
  pomodoro: { taskId: string } | null;
  onSelectFolder: (f: FolderSelection) => void;
  onAddFolder: (name: string) => Promise<import("../types").TaskFolder>;
  onRenameFolder: (id: string, name: string) => Promise<void>;
  onArchiveFolder: (id: string) => Promise<void>;
  onDeleteFolder: (id: string) => Promise<void>;
  onColumnsChange: (cols: KanbanColumn[]) => void;
  onStatusCycle: (id: string, status: TaskStatus) => Promise<void>;
  onSelect: (task: Task) => void;
  onUpdate: (id: string, changes: Partial<Task>) => Promise<void>;
  onArchive: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onStartPomodoro: (id: string) => void;
  onRestore: (id: string) => Promise<void>;
  onPermanentDelete: (id: string) => Promise<void>;
  onCloseDetail: () => void;
}) {
  const sidebarEl = (
    <TaskFolderSidebar
      folders={folders}
      tasks={tasks}
      selectedFolder={selectedFolder}
      onSelectFolder={onSelectFolder}
      onAddFolder={onAddFolder}
      onRenameFolder={onRenameFolder}
      onArchiveFolder={onArchiveFolder}
      onDeleteFolder={onDeleteFolder}
    />
  );

  const detailEl =
    resolvedSelectedTask && viewMode === "active" ? (
      <TaskDetailPanel
        task={resolvedSelectedTask}
        projects={projects}
        folders={folders}
        onUpdate={onUpdate}
        onArchive={onArchive}
        onDelete={onDelete}
        onClose={onCloseDetail}
      />
    ) : null;

  if (effectiveDisplayMode === "kanban") {
    return (
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="min-h-0 w-[200px] shrink-0 overflow-hidden border-border border-r">
          {sidebarEl}
        </aside>
        <div className="min-h-0 min-w-0 flex-1">
          <TaskKanban
            tasks={filteredTasks}
            columns={kanbanColumns}
            onColumnsChange={onColumnsChange}
            onStatusChange={onStatusCycle}
            onSelect={onSelect}
            activePomodoroTaskId={pomodoro?.taskId}
          />
        </div>
        {detailEl}
      </div>
    );
  }

  return (
    <ThreePaneWorkspace
      sidebar={sidebarEl}
      list={
        <div className="h-full overflow-y-auto">
          <TaskList
            tasks={filteredTasks}
            onStatusCycle={onStatusCycle}
            onDelete={onDelete}
            onSelect={onSelect}
            onStartPomodoro={onStartPomodoro}
            activePomodoroTaskId={pomodoro?.taskId}
            trashMode={viewMode === "trash"}
            onRestore={onRestore}
            onPermanentDelete={onPermanentDelete}
          />
        </div>
      }
      detail={detailEl}
      detailKey={resolvedSelectedTask?.id ?? null}
      sidebarTabLabel="Folders"
      listTabLabel="Tasks"
      initialSidebarWidth={200}
      initialListWidth={600}
      minSidebarWidth={160}
      minListWidth={300}
      minDetailWidth={380}
    />
  );
}
