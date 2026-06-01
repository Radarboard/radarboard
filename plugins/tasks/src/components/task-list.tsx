"use client";

import {
  ListRowChip,
  ListRowStatusChip,
  PluginListRow,
} from "@radarboard/plugin-sdk/components/list-row";
import { Button } from "@radarboard/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@radarboard/ui/tooltip";
import { cn } from "@radarboard/utils/cn";
import { Archive, Check, Circle, Clock, Play, Repeat, Trash2 } from "lucide-react";
import type React from "react";
import { useCallback } from "react";
import type { Task, TaskStatus } from "../types";

const STATUS_ICONS: Record<TaskStatus, typeof Circle> = {
  todo: Circle,
  "in-progress": Clock,
  done: Check,
  archived: Archive,
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  todo: "text-dim",
  "in-progress": "text-amber-400",
  done: "text-emerald-400",
  archived: "text-dim",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-secondary",
  medium: "bg-blue-500/20 text-blue-400",
  high: "bg-orange-500/20 text-orange-400",
  urgent: "bg-red-500/20 text-red-400",
};

const STATUS_CYCLE: Partial<Record<TaskStatus, TaskStatus>> = {
  todo: "in-progress",
  "in-progress": "done",
  done: "todo",
};

interface TaskListProps {
  tasks: Task[];
  onSelect: (task: Task) => void;
  onStatusCycle: (taskId: string, status: TaskStatus) => void;
  onDelete: (taskId: string) => void;
  onRestore?: (taskId: string) => void;
  onPermanentDelete?: (taskId: string) => void;
  onStartPomodoro: (taskId: string) => void;
  activePomodoroTaskId?: string;
  trashMode?: boolean;
}

export function TaskList({
  tasks,
  onSelect,
  onStatusCycle: onStatusChange,
  onDelete,
  onRestore,
  onPermanentDelete,
  onStartPomodoro,
  activePomodoroTaskId: pomodoroTaskId,
  trashMode,
}: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="text-center text-dim text-w-sm">
          {trashMode ? "Trash is empty." : "No tasks yet. Press `n` to create one."}
        </div>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {tasks.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          selected={false}
          onSelect={() => onSelect(task)}
          onStatusCycle={() => {
            const next = STATUS_CYCLE[task.status];
            if (next) onStatusChange(task.id, next);
          }}
          onDelete={() => onDelete(task.id)}
          onRestore={onRestore ? () => onRestore(task.id) : undefined}
          onPermanentDelete={onPermanentDelete ? () => onPermanentDelete(task.id) : undefined}
          onPomodoro={() => onStartPomodoro(task.id)}
          isPomodoring={pomodoroTaskId === task.id}
          trashMode={trashMode}
        />
      ))}
    </div>
  );
}

function TaskRow({
  task,
  selected,
  onSelect,
  onStatusCycle,
  onDelete,
  onRestore,
  onPermanentDelete,
  onPomodoro,
  isPomodoring,
  trashMode,
}: {
  task: Task;
  selected: boolean;
  onSelect: () => void;
  onStatusCycle: () => void;
  onDelete: () => void;
  onRestore?: () => void;
  onPermanentDelete?: () => void;
  onPomodoro: () => void;
  isPomodoring: boolean;
  trashMode?: boolean;
}) {
  const StatusIcon = STATUS_ICONS[task.status];
  const subtasksDone = task.subtasks?.filter((s) => s.done).length ?? 0;
  const subtasksTotal = task.subtasks?.length ?? 0;
  const isDone = task.status === "done" || task.status === "archived";

  const handleStatusClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onStatusCycle();
    },
    [onStatusCycle]
  );

  return (
    <PluginListRow
      indicator={
        <Button
          type="button"
          onClick={handleStatusClick}
          variant="ghost"
          size="icon"
          uppercase={false}
          className={cn("shrink-0 hover:text-emerald-400", STATUS_COLORS[task.status])}
          aria-label={task.status === "done" ? "Completed" : "Cycle status"}
        >
          <StatusIcon className="icon-base" />
        </Button>
      }
      title={task.title}
      titleBadge={
        <>
          {subtasksTotal > 0 && (
            <span className="text-dim text-w-sm">
              {subtasksDone}/{subtasksTotal}
            </span>
          )}
          {Boolean(task.recurrence) && <Repeat className="icon-xs text-dim" />}
        </>
      }
      subtitle={task.description}
      chips={
        <>
          {Boolean(task.projectId) && <ListRowChip>{task.projectId}</ListRowChip>}
          <ListRowStatusChip className={PRIORITY_COLORS[task.priority]}>
            {task.priority}
          </ListRowStatusChip>
          {Boolean(task.dueDate) && (
            <span className="font-mono text-dim text-w-sm">{task.dueDate}</span>
          )}
        </>
      }
      selected={selected}
      onClick={onSelect}
      strikethrough={task.status === "done"}
      className={isDone ? "opacity-50" : undefined}
      hoverActions={
        trashMode ? (
          <TrashHoverActions onRestore={onRestore} onPermanentDelete={onPermanentDelete} />
        ) : (
          <ActiveHoverActions
            isDone={isDone}
            isPomodoring={isPomodoring}
            onPomodoro={onPomodoro}
            onDelete={onDelete}
          />
        )
      }
    />
  );
}

function TrashHoverActions({
  onRestore,
  onPermanentDelete,
}: {
  onRestore?: () => void;
  onPermanentDelete?: () => void;
}) {
  return (
    <>
      {Boolean(onRestore) && (
        <Button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRestore?.();
          }}
          variant="ghost"
          size="sm"
          uppercase={false}
          className="text-muted-foreground hover:text-foreground-secondary"
        >
          Restore
        </Button>
      )}
      {Boolean(onPermanentDelete) && (
        <Button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPermanentDelete?.();
          }}
          variant="ghost"
          size="sm"
          uppercase={false}
          className="text-red-400 hover:bg-red-400/10"
        >
          Delete Forever
        </Button>
      )}
    </>
  );
}

function ActiveHoverActions({
  isDone,
  isPomodoring,
  onPomodoro,
  onDelete,
}: {
  isDone: boolean;
  isPomodoring: boolean;
  onPomodoro: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      {!isDone && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPomodoro();
              }}
              variant="ghost"
              size="icon"
              uppercase={false}
              className={cn(
                isPomodoring
                  ? "bg-red-400/10 text-red-400"
                  : "text-dim hover:bg-surface-raised hover:text-muted-foreground"
              )}
              aria-label={isPomodoring ? "Pomodoro active" : "Start Pomodoro"}
            >
              <Play className="icon-base" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{isPomodoring ? "Pomodoro active" : "Start Pomodoro"}</TooltipContent>
        </Tooltip>
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            variant="ghost"
            size="icon"
            uppercase={false}
            className="text-dim hover:bg-red-400/10 hover:text-red-400"
            aria-label="Move to trash"
          >
            <Trash2 className="icon-base" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Move to trash</TooltipContent>
      </Tooltip>
    </>
  );
}
