import { generateId, now, TRASH_RETENTION_DAYS } from "@radarboard/plugin-sdk/utils";
import type { Recurrence, Subtask, Task } from "./types";

export { generateId, now };

/**
 * Normalize a single task — fills defaults for fields added after initial release.
 */
export function normalizeTask(task: Record<string, unknown> & { id: string }): Task {
  return {
    ...(task as unknown as Task),
    subtasks: (task.subtasks as Subtask[] | undefined) ?? [],
    recurrence: (task.recurrence as Recurrence | null | undefined) ?? null,
    deletedAt: (task.deletedAt as string | null | undefined) ?? null,
  };
}

/**
 * Normalize an array of tasks and purge tasks that have been in trash > 30 days.
 */
export function normalizeTasks(tasks: Array<Record<string, unknown> & { id: string }>): Task[] {
  const cutoff = Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return tasks.map(normalizeTask).filter((t) => {
    if (t.deletedAt === null) return true;
    return new Date(t.deletedAt).getTime() > cutoff;
  });
}

/**
 * Calculate the next due date based on a recurrence pattern.
 * Monthly: clamps to last day of target month (Jan 31 → Feb 28).
 * If no dueDate, uses today as base.
 */
export function advanceDueDate(dueDate: string | undefined, recurrence: Recurrence): string {
  const parseDateOnly = (value: string): Date => {
    const [yearPart, monthPart, dayPart] = value
      .split("-")
      .map((part) => Number.parseInt(part, 10));
    if (!yearPart || !monthPart || !dayPart) {
      return new Date(value);
    }
    return new Date(yearPart, monthPart - 1, dayPart);
  };

  const base = dueDate ? parseDateOnly(dueDate) : new Date();
  const year = base.getFullYear();
  const month = base.getMonth();
  const day = base.getDate();

  let nextDate: Date;

  switch (recurrence.pattern) {
    case "daily":
      nextDate = new Date(year, month, day + 1);
      break;
    case "weekly":
      nextDate = new Date(year, month, day + 7);
      break;
    case "monthly": {
      const nextMonth = month + 1;
      // Last day of the target month
      const lastDay = new Date(year, nextMonth + 1, 0).getDate();
      nextDate = new Date(year, nextMonth, Math.min(day, lastDay));
      break;
    }
    case "custom":
      nextDate = new Date(year, month, day + (recurrence.intervalDays ?? 1));
      break;
    default:
      nextDate = new Date(year, month, day + 1);
  }

  // Format as YYYY-MM-DD
  const ny = nextDate.getFullYear();
  const nm = String(nextDate.getMonth() + 1).padStart(2, "0");
  const nd = String(nextDate.getDate()).padStart(2, "0");
  return `${ny}-${nm}-${nd}`;
}

/**
 * Clone a completed recurring task with the next due date.
 * Returns null if the task has no recurrence.
 */
export function spawnRecurrence(task: Task): Task | null {
  if (!task.recurrence) return null;

  return {
    ...task,
    id: generateId(),
    status: "todo",
    subtasks: task.subtasks.map((s) => ({ ...s, done: false })),
    dueDate: advanceDueDate(task.dueDate, task.recurrence),
    deletedAt: null,
    createdAt: now(),
    updatedAt: now(),
  };
}

/**
 * Soft-delete a task by setting deletedAt.
 */
export function softDelete(task: Task): Task {
  return { ...task, deletedAt: now(), updatedAt: now() };
}

/**
 * Restore a task from trash (clears deletedAt) or archive (sets status to "todo").
 */
export function restoreTask(task: Task): Task {
  if (task.deletedAt !== null) {
    return { ...task, deletedAt: null, updatedAt: now() };
  }
  if (task.status === "archived") {
    return { ...task, status: "todo", updatedAt: now() };
  }
  return task;
}
