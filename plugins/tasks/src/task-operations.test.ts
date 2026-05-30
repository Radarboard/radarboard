import { describe, expect, it } from "vitest";
import {
  advanceDueDate,
  normalizeTask,
  normalizeTasks,
  restoreTask,
  softDelete,
  spawnRecurrence,
} from "./task-operations";
import type { Task } from "./types";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "test-1",
    title: "Test task",
    status: "todo",
    priority: "medium",
    subtasks: [],
    recurrence: null,
    deletedAt: null,
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("normalizeTask", () => {
  it("fills defaults for missing new fields", () => {
    const legacy = {
      id: "1",
      title: "Old",
      status: "todo",
      priority: "medium",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    } as Record<string, unknown> & { id: string };
    const result = normalizeTask(legacy);
    expect(result.subtasks).toEqual([]);
    expect(result.recurrence).toBeNull();
    expect(result.deletedAt).toBeNull();
  });

  it("preserves existing new fields", () => {
    const task = {
      id: "1",
      title: "New",
      status: "todo",
      priority: "medium",
      subtasks: [{ id: "s1", title: "sub", done: true }],
      recurrence: { pattern: "daily" },
      deletedAt: "2026-03-15T00:00:00Z",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    } as Record<string, unknown> & { id: string };
    const result = normalizeTask(task);
    expect(result.subtasks).toHaveLength(1);
    expect(result.recurrence).toEqual({ pattern: "daily" });
    expect(result.deletedAt).toBe("2026-03-15T00:00:00Z");
  });
});

describe("normalizeTasks", () => {
  it("purges tasks in trash older than 30 days", () => {
    const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    const recent = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();

    const tasks = [
      {
        id: "1",
        title: "Old deleted",
        status: "done",
        priority: "medium",
        deletedAt: old,
        createdAt: old,
        updatedAt: old,
      },
      {
        id: "2",
        title: "Recent deleted",
        status: "done",
        priority: "medium",
        deletedAt: recent,
        createdAt: recent,
        updatedAt: recent,
      },
      {
        id: "3",
        title: "Active",
        status: "todo",
        priority: "medium",
        createdAt: recent,
        updatedAt: recent,
      },
    ] as Array<Record<string, unknown> & { id: string }>;

    const result = normalizeTasks(tasks);
    expect(result).toHaveLength(2);
    expect(result.map((t) => t.id)).toEqual(["2", "3"]);
  });

  it("keeps all tasks when none are purged", () => {
    const tasks = [
      {
        id: "1",
        title: "Active",
        status: "todo",
        priority: "medium",
        createdAt: "2026-03-01T00:00:00Z",
        updatedAt: "2026-03-01T00:00:00Z",
      },
    ] as Array<Record<string, unknown> & { id: string }>;

    const result = normalizeTasks(tasks);
    expect(result).toHaveLength(1);
  });
});

describe("advanceDueDate", () => {
  it("advances daily by 1 day", () => {
    expect(advanceDueDate("2026-03-20", { pattern: "daily" })).toBe("2026-03-21");
  });

  it("advances weekly by 7 days", () => {
    expect(advanceDueDate("2026-03-20", { pattern: "weekly" })).toBe("2026-03-27");
  });

  it("advances monthly by 1 month", () => {
    expect(advanceDueDate("2026-03-15", { pattern: "monthly" })).toBe("2026-04-15");
  });

  it("clamps monthly end-of-month (Jan 31 → Feb 28)", () => {
    expect(advanceDueDate("2026-01-31", { pattern: "monthly" })).toBe("2026-02-28");
  });

  it("advances custom by N days", () => {
    expect(advanceDueDate("2026-03-20", { pattern: "custom", intervalDays: 10 })).toBe(
      "2026-03-30"
    );
  });

  it("uses today as base when no dueDate", () => {
    const result = advanceDueDate(undefined, { pattern: "daily" });
    // Should be a valid date string
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("handles year boundary", () => {
    expect(advanceDueDate("2026-12-31", { pattern: "daily" })).toBe("2027-01-01");
  });
});

describe("spawnRecurrence", () => {
  it("returns null for non-recurring task", () => {
    const task = makeTask({ recurrence: null });
    expect(spawnRecurrence(task)).toBeNull();
  });

  it("clones recurring task with advanced due date", () => {
    const task = makeTask({
      dueDate: "2026-03-20",
      recurrence: { pattern: "weekly" },
      subtasks: [
        { id: "s1", title: "Sub 1", done: true },
        { id: "s2", title: "Sub 2", done: false },
      ],
    });

    const spawned = spawnRecurrence(task) as Task;
    expect(spawned).not.toBeNull();
    expect(spawned.id).not.toBe(task.id);
    expect(spawned.status).toBe("todo");
    expect(spawned.dueDate).toBe("2026-03-27");
    expect(spawned.deletedAt).toBeNull();
    expect(spawned.recurrence).toEqual({ pattern: "weekly" });
  });

  it("resets subtask done flags", () => {
    const task = makeTask({
      recurrence: { pattern: "daily" },
      subtasks: [{ id: "s1", title: "Sub", done: true }],
    });

    const spawned = spawnRecurrence(task) as Task;
    expect(spawned.subtasks[0]?.done).toBe(false);
  });
});

describe("softDelete", () => {
  it("sets deletedAt to ISO string", () => {
    const task = makeTask();
    const deleted = softDelete(task);
    expect(deleted.deletedAt).toBeTruthy();
    expect(new Date(deleted.deletedAt as string).getTime()).toBeGreaterThan(0);
    expect(deleted.id).toBe(task.id);
  });
});

describe("restoreTask", () => {
  it("clears deletedAt for trashed tasks", () => {
    const task = makeTask({ deletedAt: "2026-03-15T00:00:00Z", status: "todo" });
    const restored = restoreTask(task);
    expect(restored.deletedAt).toBeNull();
    expect(restored.status).toBe("todo");
  });

  it("sets status to todo for archived tasks", () => {
    const task = makeTask({ status: "archived", deletedAt: null });
    const restored = restoreTask(task);
    expect(restored.status).toBe("todo");
    expect(restored.deletedAt).toBeNull();
  });

  it("returns task unchanged if neither trashed nor archived", () => {
    const task = makeTask({ status: "in-progress" });
    const restored = restoreTask(task);
    expect(restored).toEqual(task);
  });
});
