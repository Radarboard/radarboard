"use client";

import { useDemoMode } from "@radarboard/hooks/use-demo-mode";
import type { PluginAPI } from "@radarboard/plugin-sdk/types";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  generateId,
  normalizeTask,
  normalizeTasks,
  now,
  restoreTask as restoreTaskOp,
  softDelete,
  spawnRecurrence,
} from "./task-operations";
import {
  DEFAULT_TASKS_SETTINGS,
  type PomodoroSession,
  type Recurrence,
  type Task,
  type TaskPriority,
  type TasksSettings,
} from "./types";

const DB_KEYS = {
  tasks: "tasks:list",
  pomodoro: "tasks:pomodoro:current",
  settings: "tasks:settings",
} as const;

const DEMO_TASKS: Task[] = [
  {
    id: "demo-1",
    title: "Review Q1 analytics report",
    description: "",
    status: "todo",
    priority: "high",
    subtasks: [],
    recurrence: null,
    deletedAt: null,
    createdAt: "2026-03-25T10:00:00Z",
    updatedAt: "2026-03-25T10:00:00Z",
  },
  {
    id: "demo-2",
    title: "Update landing page copy",
    description: "",
    status: "done",
    priority: "medium",
    subtasks: [],
    recurrence: null,
    deletedAt: null,
    createdAt: "2026-03-24T14:00:00Z",
    updatedAt: "2026-03-24T14:00:00Z",
  },
  {
    id: "demo-3",
    title: "Set up Stripe webhook for refunds",
    description: "",
    status: "todo",
    priority: "low",
    subtasks: [],
    recurrence: null,
    deletedAt: null,
    createdAt: "2026-03-23T09:00:00Z",
    updatedAt: "2026-03-23T09:00:00Z",
  },
  {
    id: "demo-4",
    title: "Deploy v2.1 to production",
    description: "",
    status: "done",
    priority: "high",
    subtasks: [],
    recurrence: null,
    deletedAt: null,
    createdAt: "2026-03-22T16:00:00Z",
    updatedAt: "2026-03-22T16:00:00Z",
  },
  {
    id: "demo-5",
    title: "Write API docs for /billing endpoint",
    description: "",
    status: "in-progress",
    priority: "medium",
    subtasks: [],
    recurrence: null,
    deletedAt: null,
    createdAt: "2026-03-21T11:00:00Z",
    updatedAt: "2026-03-21T11:00:00Z",
  },
];

export function useTasks(api: PluginAPI) {
  const { isDemoMode } = useDemoMode();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [pomodoro, setPomodoro] = useState<PomodoroSession | null>(null);
  const [settings, setSettings] = useState<TasksSettings>(DEFAULT_TASKS_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  // Load initial data
  useEffect(() => {
    if (isDemoMode) {
      setTasks(DEMO_TASKS);
      setLoaded(true);
      return;
    }
    let cancelled = false;
    async function load() {
      const [t, p, s] = await Promise.all([
        api.db.get<Array<Record<string, unknown> & { id: string }>>(DB_KEYS.tasks),
        api.db.get<PomodoroSession>(DB_KEYS.pomodoro),
        api.db.get<TasksSettings>(DB_KEYS.settings),
      ]);
      if (cancelled) return;
      if (t) setTasks(normalizeTasks(t));
      if (p) setPomodoro(p);
      if (s) setSettings(s);
      setLoaded(true);
    }
    load().catch(() => {
      /* fire-and-forget */
    });
    return () => {
      cancelled = true;
    };
  }, [api, isDemoMode]);

  const persistTasks = useCallback(
    async (updated: Task[]) => {
      if (isDemoMode) return;
      setTasks(updated);
      await api.db.set(DB_KEYS.tasks, updated);
    },
    [api, isDemoMode]
  );

  const addTask = useCallback(
    async (input: {
      title: string;
      description?: string;
      priority?: TaskPriority;
      dueDate?: string;
      projectId?: string;
      folderId?: string;
      subtasks?: Array<{ title: string; done?: boolean }>;
      recurrence?: Recurrence | null;
    }) => {
      const task: Task = normalizeTask({
        id: generateId(),
        title: input.title,
        description: input.description,
        status: "todo",
        priority: input.priority ?? "medium",
        dueDate: input.dueDate,
        projectId: input.projectId,
        folderId: input.folderId,
        subtasks: (input.subtasks ?? []).map((s) => ({
          id: generateId(),
          title: s.title,
          done: s.done ?? false,
        })),
        recurrence: input.recurrence ?? null,
        deletedAt: null,
        createdAt: now(),
        updatedAt: now(),
      } as Record<string, unknown> & { id: string });
      const updated = [...tasks, task];
      await persistTasks(updated);
      return task;
    },
    [tasks, persistTasks]
  );

  const updateTask = useCallback(
    async (
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
          | "deletedAt"
        >
      >
    ) => {
      let updated = tasks.map((t) => {
        if (t.id !== id) return t;
        return { ...t, ...changes, updatedAt: now() };
      });

      // Handle recurrence on status transition to "done"
      const task = updated.find((t) => t.id === id);
      if (task && changes.status === "done") {
        const original = tasks.find((t) => t.id === id);
        if (original && original.status !== "done") {
          const spawned = spawnRecurrence(task);
          if (spawned) {
            updated = [...updated, spawned];
            api.notify(`Next occurrence created for ${spawned.dueDate}`, "success");
          }
        }
      }

      await persistTasks(updated);
    },
    [tasks, persistTasks, api]
  );

  const completeTask = useCallback(
    async (id: string) => {
      await updateTask(id, { status: "done" });
    },
    [updateTask]
  );

  const softDeleteTask = useCallback(
    async (id: string) => {
      const updated = tasks.map((t) => (t.id === id ? softDelete(t) : t));
      await persistTasks(updated);
    },
    [tasks, persistTasks]
  );

  const permanentDeleteTask = useCallback(
    async (id: string) => {
      const updated = tasks.filter((t) => t.id !== id);
      await persistTasks(updated);
    },
    [tasks, persistTasks]
  );

  const archiveTask = useCallback(
    async (id: string) => {
      await updateTask(id, { status: "archived" });
    },
    [updateTask]
  );

  const restoreTask = useCallback(
    async (id: string) => {
      const task = tasks.find((t) => t.id === id);
      if (!task) return;
      const restored = restoreTaskOp(task);
      const updated = tasks.map((t) => (t.id === id ? restored : t));
      await persistTasks(updated);
    },
    [tasks, persistTasks]
  );

  const startPomodoro = useCallback(
    async (taskId: string) => {
      const session: PomodoroSession = {
        taskId,
        type: "work",
        startedAt: now(),
        durationMinutes: settings.workMinutes,
        completedCycles: pomodoro?.completedCycles ?? 0,
      };
      setPomodoro(session);
      await api.db.set(DB_KEYS.pomodoro, session);
    },
    [api, settings, pomodoro]
  );

  const stopPomodoro = useCallback(async () => {
    setPomodoro(null);
    await api.db.delete(DB_KEYS.pomodoro);
  }, [api]);

  const todayTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (t.deletedAt !== null) return false;
      if (t.status === "archived") return false;
      if (t.status === "done") return false;
      if (!t.dueDate) return true;
      const today = new Date().toLocaleDateString("en-CA");
      return t.dueDate <= (today ?? "");
    });
  }, [tasks]);

  const activeTasks = useMemo(() => {
    return tasks.filter((t) => t.deletedAt === null);
  }, [tasks]);

  return {
    tasks,
    activeTasks,
    todayTasks,
    pomodoro,
    settings,
    loaded,
    addTask,
    updateTask,
    completeTask,
    softDeleteTask,
    permanentDeleteTask,
    archiveTask,
    restoreTask,
    startPomodoro,
    stopPomodoro,
  };
}
