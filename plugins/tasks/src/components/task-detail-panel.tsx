"use client";

import { Button } from "@radarboard/ui/button";
import { Input } from "@radarboard/ui/input";
import { NativeSelect } from "@radarboard/ui/select";
import { Textarea } from "@radarboard/ui/textarea";
import { cn } from "@radarboard/utils/cn";
import { Archive, Trash2, X } from "lucide-react";
import type React from "react";
import { useCallback, useState } from "react";
import { generateId } from "../task-operations";
import type {
  Recurrence,
  RecurrencePattern,
  Task,
  TaskFolder,
  TaskPriority,
  TaskStatus,
} from "../types";
import { SubtaskList } from "./subtask-list";

const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Med" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const STATUSES: { value: TaskStatus; label: string }[] = [
  { value: "todo", label: "Todo" },
  { value: "in-progress", label: "In Progress" },
  { value: "done", label: "Done" },
  { value: "archived", label: "Archived" },
];

const RECURRENCE_OPTIONS: { value: RecurrencePattern | "none"; label: string }[] = [
  { value: "none", label: "None" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "custom", label: "Custom" },
];

interface TaskDetailPanelProps {
  task: Task;
  projects: string[];
  folders?: TaskFolder[];
  onUpdate: (
    id: string,
    changes: Partial<
      Pick<
        Task,
        | "title"
        | "description"
        | "status"
        | "priority"
        | "dueDate"
        | "projectId"
        | "folderId"
        | "subtasks"
        | "recurrence"
      >
    >
  ) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

function TaskDetailHeader({
  attachTitleInputRef,
  editingTitle,
  handleTitleKeyDown,
  handleTitleSave,
  onClose,
  onStartEditing,
  setTitleDraft,
  task,
  titleDraft,
}: {
  attachTitleInputRef: (node: HTMLInputElement | null) => void;
  editingTitle: boolean;
  handleTitleKeyDown: (e: React.KeyboardEvent) => void;
  handleTitleSave: () => void;
  onClose: () => void;
  onStartEditing: () => void;
  setTitleDraft: React.Dispatch<React.SetStateAction<string>>;
  task: Task;
  titleDraft: string;
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      {editingTitle ? (
        <Input
          ref={attachTitleInputRef}
          type="text"
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={handleTitleSave}
          onKeyDown={handleTitleKeyDown}
          variant="ghost"
          size="default"
          className="flex-1 font-medium text-foreground-secondary text-w-sm"
        />
      ) : (
        <Button
          type="button"
          variant="ghost-link"
          spacing="none"
          uppercase={false}
          onClick={onStartEditing}
          className="flex-1 text-left font-medium text-foreground-secondary text-w-sm hover:text-foreground"
        >
          {task.title}
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        uppercase={false}
        onClick={onClose}
        className="shrink-0 rounded-item p-1 text-dim transition-colors hover:text-muted-foreground"
      >
        <X className="icon-base" />
      </Button>
    </div>
  );
}

function TaskDetailFooter({
  onArchive,
  onDelete,
  task,
}: {
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
  task: Task;
}) {
  return (
    <>
      <div className="space-y-1 border-border border-t pt-2">
        <div className="text-dim text-w-sm">
          Created {new Date(task.createdAt).toLocaleDateString()}
        </div>
        <div className="text-dim text-w-sm">
          Updated {new Date(task.updatedAt).toLocaleDateString()}
        </div>
        <div className="font-mono text-dim text-w-sm">{task.id}</div>
      </div>

      <div className="flex items-center gap-2 border-border border-t pt-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          uppercase={false}
          onClick={() => onArchive(task.id)}
          className="flex items-center gap-1.5 rounded-item px-3 py-1.5 text-muted-foreground text-w-sm transition-colors hover:bg-surface-raised hover:text-foreground-secondary"
        >
          <Archive className="icon-base" />
          Archive
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          uppercase={false}
          onClick={() => onDelete(task.id)}
          className="flex items-center gap-1.5 rounded-item px-3 py-1.5 text-red-400/70 text-w-sm transition-colors hover:bg-red-400/10 hover:text-red-400"
        >
          <Trash2 className="icon-base" />
          Move to trash
        </Button>
      </div>
    </>
  );
}

export function TaskDetailPanel({
  task,
  projects,
  folders,
  onUpdate,
  onArchive,
  onDelete,
  onClose,
}: TaskDetailPanelProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(task.title);
  const [customInterval, setCustomInterval] = useState(
    task.recurrence?.pattern === "custom" ? (task.recurrence.intervalDays ?? 1) : 1
  );
  const attachTitleInputRef = useCallback((node: HTMLInputElement | null) => {
    if (!node) return;
    node.focus();
    node.setSelectionRange(node.value.length, node.value.length);
  }, []);

  const handleTitleSave = useCallback(() => {
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== task.title) {
      onUpdate(task.id, { title: trimmed });
    }
    setEditingTitle(false);
  }, [titleDraft, task.id, task.title, onUpdate]);

  const handleTitleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleTitleSave();
      } else if (e.key === "Escape") {
        setTitleDraft(task.title);
        setEditingTitle(false);
      }
    },
    [handleTitleSave, task.title]
  );

  const handleRecurrenceChange = useCallback(
    (value: string) => {
      if (value === "none") {
        onUpdate(task.id, { recurrence: null });
        return;
      }
      const pattern = value as RecurrencePattern;
      const recurrence: Recurrence =
        pattern === "custom" ? { pattern, intervalDays: customInterval } : { pattern };
      onUpdate(task.id, { recurrence });
    },
    [task.id, onUpdate, customInterval]
  );

  const handleCustomIntervalChange = useCallback(
    (days: number) => {
      setCustomInterval(days);
      if (task.recurrence?.pattern === "custom") {
        onUpdate(task.id, { recurrence: { pattern: "custom", intervalDays: days } });
      }
    },
    [task.id, task.recurrence, onUpdate]
  );

  const handleSubtaskToggle = useCallback(
    (subtaskId: string) => {
      const updated = task.subtasks.map((s) => (s.id === subtaskId ? { ...s, done: !s.done } : s));
      onUpdate(task.id, { subtasks: updated });
    },
    [task.id, task.subtasks, onUpdate]
  );

  const handleSubtaskAdd = useCallback(
    (title: string) => {
      const updated = [...task.subtasks, { id: generateId(), title, done: false }];
      onUpdate(task.id, { subtasks: updated });
    },
    [task.id, task.subtasks, onUpdate]
  );

  const handleSubtaskRemove = useCallback(
    (subtaskId: string) => {
      const updated = task.subtasks.filter((s) => s.id !== subtaskId);
      onUpdate(task.id, { subtasks: updated });
    },
    [task.id, task.subtasks, onUpdate]
  );

  const recurrenceValue = task.recurrence?.pattern ?? "none";

  return (
    <div className="w-[400px] shrink-0 overflow-y-auto border-border border-l bg-surface">
      <div className="space-y-5 p-4">
        <TaskDetailHeader
          attachTitleInputRef={attachTitleInputRef}
          editingTitle={editingTitle}
          handleTitleKeyDown={handleTitleKeyDown}
          handleTitleSave={handleTitleSave}
          onClose={onClose}
          onStartEditing={() => {
            setTitleDraft(task.title);
            setEditingTitle(true);
          }}
          setTitleDraft={setTitleDraft}
          task={task}
          titleDraft={titleDraft}
        />

        {/* Status */}
        <div className="space-y-1">
          <span className="text-dim text-w-sm">Status</span>
          <div className="flex gap-1">
            {STATUSES.map((s) => (
              <Button
                key={s.value}
                type="button"
                variant="ghost"
                size="sm"
                uppercase={false}
                onClick={() => onUpdate(task.id, { status: s.value })}
                className={cn(
                  "rounded-item px-2 py-1 font-mono text-w-sm transition-colors",
                  task.status === s.value
                    ? "bg-secondary text-foreground-secondary"
                    : "text-dim hover:bg-surface-raised hover:text-dim"
                )}
              >
                {s.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Priority */}
        <div className="space-y-1">
          <span className="text-dim text-w-sm">Priority</span>
          <div className="flex gap-1">
            {PRIORITIES.map((p) => (
              <Button
                key={p.value}
                type="button"
                variant="ghost"
                size="sm"
                uppercase={false}
                onClick={() => onUpdate(task.id, { priority: p.value })}
                className={cn(
                  "rounded-item px-2 py-1 font-mono text-w-sm uppercase transition-colors",
                  task.priority === p.value
                    ? "bg-secondary text-foreground-secondary"
                    : "text-dim hover:bg-surface-raised hover:text-dim"
                )}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Due date */}
        <div className="space-y-1">
          <span className="text-dim text-w-sm">Due Date</span>
          <Input
            type="date"
            value={task.dueDate ?? ""}
            onChange={(e) => onUpdate(task.id, { dueDate: e.target.value || undefined })}
            variant="ghost"
            size="default"
            className="text-foreground-secondary text-w-sm"
            style={{ colorScheme: "light dark" }}
          />
        </div>

        {/* Folder / Project */}
        <div className="space-y-1">
          <span className="text-dim text-w-sm">Folder</span>
          {folders && folders.length > 0 ? (
            <NativeSelect
              value={task.folderId ?? ""}
              onChange={(e) => {
                const folderId = e.target.value || undefined;
                const folder = folderId ? folders.find((f) => f.id === folderId) : undefined;
                const projectId = folder?.type === "project" ? folder.projectSlug : task.projectId;
                onUpdate(task.id, { folderId, projectId });
              }}
              variant="ghost"
              size="default"
              className="w-full text-foreground-secondary text-w-sm"
            >
              <option value="">No folder</option>
              {folders
                .filter((f) => !f.archived)
                .map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
            </NativeSelect>
          ) : (
            <Input
              type="text"
              value={task.projectId ?? ""}
              onChange={(e) => onUpdate(task.id, { projectId: e.target.value || undefined })}
              placeholder="Project name..."
              list="task-projects"
              variant="ghost"
              size="default"
              className="w-full text-foreground-secondary text-w-sm"
            />
          )}
          {(!folders || folders.length === 0) && projects.length > 0 && (
            <datalist id="task-projects">
              {projects.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          )}
        </div>

        {/* Description */}
        <div className="space-y-1">
          <span className="text-dim text-w-sm">Description</span>
          <Textarea
            value={task.description ?? ""}
            onChange={(e) => onUpdate(task.id, { description: e.target.value || undefined })}
            placeholder="Add a description..."
            rows={3}
            className="resize-none bg-transparent p-2 text-foreground-secondary text-w-sm"
          />
        </div>

        {/* Subtasks */}
        <div className="space-y-1">
          <span className="text-dim text-w-sm">Subtasks</span>
          <SubtaskList
            subtasks={task.subtasks}
            onToggle={handleSubtaskToggle}
            onAdd={handleSubtaskAdd}
            onRemove={handleSubtaskRemove}
          />
        </div>

        {/* Recurrence */}
        <div className="space-y-1">
          <span className="text-dim text-w-sm">Recurrence</span>
          <div className="flex items-center gap-2">
            <NativeSelect
              value={recurrenceValue}
              onChange={(e) => handleRecurrenceChange(e.target.value)}
              variant="ghost"
              size="default"
              className="text-foreground-secondary text-w-sm"
            >
              {RECURRENCE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </NativeSelect>
            {recurrenceValue === "custom" && (
              <div className="flex items-center gap-1">
                <span className="text-dim text-w-sm">every</span>
                <Input
                  type="number"
                  min={1}
                  value={customInterval}
                  onChange={(e) => handleCustomIntervalChange(Number(e.target.value) || 1)}
                  variant="ghost"
                  size="sm"
                  className="w-12 text-center text-foreground-secondary text-w-sm"
                />
                <span className="text-dim text-w-sm">days</span>
              </div>
            )}
          </div>
        </div>

        <TaskDetailFooter onArchive={onArchive} onDelete={onDelete} task={task} />
      </div>
    </div>
  );
}
