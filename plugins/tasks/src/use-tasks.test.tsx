// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTasks } from "./use-tasks";

let mockIsDemoMode = false;

vi.mock("@radarboard/hooks/use-demo-mode", () => ({
  useDemoMode: () => ({ isDemoMode: mockIsDemoMode }),
}));

vi.mock("./task-operations", async () => {
  const actual = await vi.importActual<typeof import("./task-operations")>("./task-operations");
  return {
    ...actual,
    generateId: vi.fn(() => "generated-task"),
    now: vi.fn(() => "2026-03-28T00:00:00.000Z"),
  };
});

function createApi(initial: Record<string, unknown> = {}) {
  const store = new Map<string, unknown>(Object.entries(initial));
  return {
    api: {
      db: {
        get: vi.fn(async <T,>(key: string) => (store.has(key) ? (store.get(key) as T) : null)),
        set: vi.fn(async <T,>(key: string, value: T) => {
          store.set(key, value);
        }),
        delete: vi.fn(async (key: string) => {
          store.delete(key);
        }),
        list: vi.fn(async () => []),
      },
      notify: vi.fn(),
    },
    store,
  };
}

describe("useTasks", () => {
  beforeEach(() => {
    mockIsDemoMode = false;
  });

  it("loads demo tasks in demo mode", async () => {
    mockIsDemoMode = true;
    const { api } = createApi();

    const { result } = renderHook(() => useTasks(api as never));

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    expect(result.current.tasks).toHaveLength(5);
  });

  it("loads persisted tasks and supports task, recurrence, and pomodoro operations", async () => {
    const { api, store } = createApi({
      "tasks:list": [
        {
          id: "task-1",
          title: "Legacy task",
          status: "todo",
          priority: "medium",
          dueDate: "2026-03-20",
          subtasks: [],
          recurrence: { pattern: "daily" },
          deletedAt: null,
          createdAt: "2026-03-01T00:00:00.000Z",
          updatedAt: "2026-03-01T00:00:00.000Z",
        },
      ],
      "tasks:pomodoro:current": {
        taskId: "task-1",
        type: "work",
        startedAt: "2026-03-20T00:00:00.000Z",
        durationMinutes: 20,
        completedCycles: 2,
      },
      "tasks:settings": {
        workMinutes: 50,
        shortBreakMinutes: 10,
        longBreakMinutes: 20,
      },
    });

    const { result } = renderHook(() => useTasks(api as never));

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    expect(result.current.tasks).toHaveLength(1);
    expect(result.current.pomodoro).toMatchObject({ taskId: "task-1", completedCycles: 2 });
    expect(result.current.settings).toEqual({
      workMinutes: 50,
      shortBreakMinutes: 10,
      longBreakMinutes: 20,
    });

    await act(async () => {
      await result.current.addTask({
        title: "New task",
        description: "ship it",
        dueDate: "2026-03-21",
        projectId: "atlas",
        recurrence: { pattern: "weekly" },
      });
    });
    await act(async () => {
      await result.current.updateTask("generated-task", {
        title: "Updated task",
        status: "done",
      });
    });
    await act(async () => {
      await result.current.softDeleteTask("generated-task");
    });
    await act(async () => {
      await result.current.restoreTask("generated-task");
    });
    await act(async () => {
      await result.current.archiveTask("generated-task");
    });
    await act(async () => {
      await result.current.restoreTask("generated-task");
    });
    await act(async () => {
      await result.current.startPomodoro("generated-task");
    });
    await act(async () => {
      await result.current.stopPomodoro();
    });
    await act(async () => {
      await result.current.permanentDeleteTask("task-1");
    });

    expect(result.current.tasks.some((task) => task.id === "task-1")).toBe(false);
    expect(result.current.tasks.some((task) => task.id === "generated-task")).toBe(true);
    expect(result.current.tasks.some((task) => task.id !== "generated-task")).toBe(true);
    expect(api.notify).toHaveBeenCalled();
    expect(api.db.delete).toHaveBeenCalledWith("tasks:pomodoro:current");
    expect(store.get("tasks:list")).toEqual(result.current.tasks);
  });
});
