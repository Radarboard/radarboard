import type { McpToolDefinition, PluginAPI } from "@radarboard/plugin-sdk/types";
import { z } from "zod";
import {
  generateId,
  normalizeTasks,
  now,
  restoreTask as restoreTaskOp,
  softDelete,
  spawnRecurrence,
} from "./task-operations";
import type { Task, TaskPriority, TaskStatus } from "./types";

const DB_KEYS = {
  tasks: "tasks:list",
  pomodoro: "tasks:pomodoro:current",
} as const;

async function getTasks(api: PluginAPI): Promise<Task[]> {
  const raw =
    (await api.db.get<Array<Record<string, unknown> & { id: string }>>(DB_KEYS.tasks)) ?? [];
  return normalizeTasks(raw);
}

async function saveTasks(api: PluginAPI, tasks: Task[]): Promise<void> {
  await api.db.set(DB_KEYS.tasks, tasks);
}

const recurrenceSchema = z
  .object({
    pattern: z.enum(["daily", "weekly", "monthly", "custom"]),
    intervalDays: z.number().optional(),
  })
  .nullable()
  .optional();

const subtaskInputSchema = z.array(
  z.object({
    title: z.string(),
    done: z.boolean().optional(),
  })
);

export const tasksMcpTools: McpToolDefinition[] = [
  {
    name: "create_task",
    description:
      "Create a new task. Optionally include subtasks (checklist items) and recurrence (daily/weekly/monthly/custom) at creation time.",
    parameters: z.object({
      title: z.string().describe("Task title"),
      description: z.string().optional().describe("Task description"),
      priority: z
        .enum(["low", "medium", "high", "urgent"])
        .optional()
        .default("medium")
        .describe("Task priority"),
      due_date: z.string().optional().describe("Due date in YYYY-MM-DD format"),
      project_id: z.string().optional().describe("Project slug to associate the task with"),
      subtasks: subtaskInputSchema.optional().describe("Initial subtask checklist items"),
      recurrence: recurrenceSchema.describe(
        "Recurrence config: daily, weekly, monthly, or custom with intervalDays"
      ),
    }),
    execute: async (params: unknown, api: PluginAPI) => {
      const input = params as {
        title: string;
        description?: string;
        priority?: TaskPriority;
        due_date?: string;
        project_id?: string;
        subtasks?: Array<{ title: string; done?: boolean }>;
        recurrence?: { pattern: string; intervalDays?: number } | null;
      };
      const tasks = await getTasks(api);
      const task: Task = {
        id: generateId(),
        title: input.title,
        description: input.description,
        status: "todo",
        priority: input.priority ?? "medium",
        dueDate: input.due_date,
        projectId: input.project_id,
        subtasks: (input.subtasks ?? []).map((s) => ({
          id: generateId(),
          title: s.title,
          done: s.done ?? false,
        })),
        recurrence: (input.recurrence as Task["recurrence"]) ?? null,
        deletedAt: null,
        createdAt: now(),
        updatedAt: now(),
      };
      tasks.push(task);
      await saveTasks(api, tasks);
      return { success: true, task };
    },
  },

  {
    name: "list_tasks",
    description:
      "List tasks with optional filters. By default, excludes archived and trashed tasks. Use include_archived or include_deleted to see those. Supports filtering by status, project, priority, and due date.",
    parameters: z.object({
      status: z
        .enum(["todo", "in-progress", "done", "archived"])
        .optional()
        .describe("Filter by status"),
      project_id: z.string().optional().describe("Filter by project slug"),
      priority: z
        .enum(["low", "medium", "high", "urgent"])
        .optional()
        .describe("Filter by priority"),
      due_date: z.string().optional().describe("Filter by due date (YYYY-MM-DD)"),
      include_archived: z
        .boolean()
        .optional()
        .default(false)
        .describe("Include archived tasks (default: false)"),
      include_deleted: z
        .boolean()
        .optional()
        .default(false)
        .describe("Include trashed/soft-deleted tasks (default: false)"),
    }),
    execute: async (params: unknown, api: PluginAPI) => {
      const filters = params as {
        status?: TaskStatus;
        project_id?: string;
        priority?: TaskPriority;
        due_date?: string;
        include_archived?: boolean;
        include_deleted?: boolean;
      };
      let tasks = await getTasks(api);

      // Default: exclude archived and deleted
      if (!filters.include_deleted) tasks = tasks.filter((t) => t.deletedAt === null);
      if (!filters.include_archived) tasks = tasks.filter((t) => t.status !== "archived");

      if (filters.status) tasks = tasks.filter((t) => t.status === filters.status);
      if (filters.project_id) tasks = tasks.filter((t) => t.projectId === filters.project_id);
      if (filters.priority) tasks = tasks.filter((t) => t.priority === filters.priority);
      if (filters.due_date) tasks = tasks.filter((t) => t.dueDate === filters.due_date);

      return { tasks, count: tasks.length };
    },
  },

  {
    name: "complete_task",
    description:
      "Mark a task as done by its ID. If the task is recurring, automatically creates the next occurrence.",
    parameters: z.object({
      task_id: z.string().describe("The task ID to complete"),
    }),
    execute: async (params: unknown, api: PluginAPI) => {
      const { task_id } = params as { task_id: string };
      let tasks = await getTasks(api);
      const task = tasks.find((t) => t.id === task_id);
      if (!task) return { success: false, error: "Task not found" };

      const previousStatus = task.status;
      task.status = "done";
      task.updatedAt = now();

      // Spawn recurrence if transitioning to done
      if (previousStatus !== "done") {
        const spawned = spawnRecurrence(task);
        if (spawned) {
          tasks = [...tasks, spawned];
        }
      }

      await saveTasks(api, tasks);
      return { success: true, task };
    },
  },

  {
    name: "update_task",
    description:
      "Update task fields. Can set subtasks (replaces entire list), recurrence, status (including 'archived'), priority, due date, and project. When status changes to 'done' on a recurring task, the next occurrence is auto-created.",
    parameters: z.object({
      task_id: z.string().describe("The task ID to update"),
      title: z.string().optional().describe("New title"),
      description: z.string().optional().describe("New description"),
      status: z.enum(["todo", "in-progress", "done", "archived"]).optional().describe("New status"),
      priority: z.enum(["low", "medium", "high", "urgent"]).optional().describe("New priority"),
      due_date: z.string().optional().describe("New due date (YYYY-MM-DD)"),
      project_id: z.string().optional().describe("Project slug"),
      subtasks: z
        .array(
          z.object({
            id: z.string().optional(),
            title: z.string(),
            done: z.boolean(),
          })
        )
        .optional()
        .describe("Replace subtask list"),
      recurrence: recurrenceSchema.describe("Set or clear recurrence"),
    }),
    execute: async (params: unknown, api: PluginAPI) => {
      const { task_id, ...changes } = params as {
        task_id: string;
        title?: string;
        description?: string;
        status?: TaskStatus;
        priority?: TaskPriority;
        due_date?: string;
        project_id?: string;
        subtasks?: Array<{ id?: string; title: string; done: boolean }>;
        recurrence?: { pattern: string; intervalDays?: number } | null;
      };
      let tasks = await getTasks(api);
      const task = tasks.find((t) => t.id === task_id);
      if (!task) return { success: false, error: "Task not found" };

      const previousStatus = task.status;

      if (changes.title !== undefined) task.title = changes.title;
      if (changes.description !== undefined) task.description = changes.description;
      if (changes.status !== undefined) task.status = changes.status;
      if (changes.priority !== undefined) task.priority = changes.priority;
      if (changes.due_date !== undefined) task.dueDate = changes.due_date;
      if (changes.project_id !== undefined) task.projectId = changes.project_id;
      if (changes.subtasks !== undefined) {
        task.subtasks = changes.subtasks.map((s) => ({
          id: s.id ?? generateId(),
          title: s.title,
          done: s.done,
        }));
      }
      if (changes.recurrence !== undefined) {
        task.recurrence = (changes.recurrence as Task["recurrence"]) ?? null;
      }
      task.updatedAt = now();

      // Spawn recurrence if transitioning to done
      if (changes.status === "done" && previousStatus !== "done") {
        const spawned = spawnRecurrence(task);
        if (spawned) {
          tasks = [...tasks, spawned];
        }
      }

      await saveTasks(api, tasks);
      return { success: true, task };
    },
  },

  {
    name: "delete_task",
    description:
      "Soft-delete a task (moves to trash, recoverable for 30 days). Use restore_task to recover.",
    parameters: z.object({
      task_id: z.string().describe("The task ID to delete"),
    }),
    execute: async (params: unknown, api: PluginAPI) => {
      const { task_id } = params as { task_id: string };
      const tasks = await getTasks(api);
      const task = tasks.find((t) => t.id === task_id);
      if (!task) return { success: false, error: "Task not found" };

      const updated = tasks.map((t) => (t.id === task_id ? softDelete(t) : t));
      await saveTasks(api, updated);
      return { success: true };
    },
  },

  {
    name: "get_task",
    description:
      "Get full details of a single task including subtasks, recurrence config, project, and metadata.",
    parameters: z.object({
      task_id: z.string().describe("The task ID to retrieve"),
    }),
    execute: async (params: unknown, api: PluginAPI) => {
      const { task_id } = params as { task_id: string };
      const tasks = await getTasks(api);
      const task = tasks.find((t) => t.id === task_id);
      if (!task) return { success: false, error: "Task not found" };
      return { success: true, task };
    },
  },

  {
    name: "archive_task",
    description: "Archive a task — hides it from the default list. Use restore_task to unarchive.",
    parameters: z.object({
      task_id: z.string().describe("The task ID to archive"),
    }),
    execute: async (params: unknown, api: PluginAPI) => {
      const { task_id } = params as { task_id: string };
      const tasks = await getTasks(api);
      const task = tasks.find((t) => t.id === task_id);
      if (!task) return { success: false, error: "Task not found" };

      task.status = "archived";
      task.updatedAt = now();
      await saveTasks(api, tasks);
      return { success: true, task };
    },
  },

  {
    name: "restore_task",
    description:
      "Restore a task from archive (sets status to 'todo') or trash (clears deletedAt, preserves status).",
    parameters: z.object({
      task_id: z.string().describe("The task ID to restore"),
    }),
    execute: async (params: unknown, api: PluginAPI) => {
      const { task_id } = params as { task_id: string };
      const tasks = await getTasks(api);
      const task = tasks.find((t) => t.id === task_id);
      if (!task) return { success: false, error: "Task not found" };

      const restored = restoreTaskOp(task);
      const updated = tasks.map((t) => (t.id === task_id ? restored : t));
      await saveTasks(api, updated);
      return { success: true, task: restored };
    },
  },

  {
    name: "add_subtask",
    description: "Add a new subtask to a task's checklist (initially unchecked).",
    parameters: z.object({
      task_id: z.string().describe("The parent task ID"),
      title: z.string().describe("Subtask title"),
    }),
    execute: async (params: unknown, api: PluginAPI) => {
      const { task_id, title } = params as { task_id: string; title: string };
      const tasks = await getTasks(api);
      const task = tasks.find((t) => t.id === task_id);
      if (!task) return { success: false, error: "Task not found" };

      task.subtasks.push({ id: generateId(), title, done: false });
      task.updatedAt = now();
      await saveTasks(api, tasks);
      return { success: true, task };
    },
  },

  {
    name: "toggle_subtask",
    description:
      "Toggle a subtask's done state. If all subtasks become done, the parent task is auto-completed (with recurrence if configured).",
    parameters: z.object({
      task_id: z.string().describe("The parent task ID"),
      subtask_id: z.string().describe("The subtask ID to toggle"),
    }),
    execute: async (params: unknown, api: PluginAPI) => {
      const { task_id, subtask_id } = params as { task_id: string; subtask_id: string };
      let tasks = await getTasks(api);
      const task = tasks.find((t) => t.id === task_id);
      if (!task) return { success: false, error: "Task not found" };

      const subtask = task.subtasks.find((s) => s.id === subtask_id);
      if (!subtask) return { success: false, error: "Subtask not found" };

      subtask.done = !subtask.done;
      task.updatedAt = now();

      // Auto-complete parent when all subtasks done
      const allDone = task.subtasks.length > 0 && task.subtasks.every((s) => s.done);
      if (allDone && task.status !== "done") {
        task.status = "done";
        const spawned = spawnRecurrence(task);
        if (spawned) {
          tasks = [...tasks, spawned];
        }
      }

      await saveTasks(api, tasks);
      return { success: true, task, allDone };
    },
  },

  {
    name: "remove_subtask",
    description: "Remove a subtask from a task's checklist.",
    parameters: z.object({
      task_id: z.string().describe("The parent task ID"),
      subtask_id: z.string().describe("The subtask ID to remove"),
    }),
    execute: async (params: unknown, api: PluginAPI) => {
      const { task_id, subtask_id } = params as { task_id: string; subtask_id: string };
      const tasks = await getTasks(api);
      const task = tasks.find((t) => t.id === task_id);
      if (!task) return { success: false, error: "Task not found" };

      const before = task.subtasks.length;
      task.subtasks = task.subtasks.filter((s) => s.id !== subtask_id);
      if (task.subtasks.length === before) return { success: false, error: "Subtask not found" };

      task.updatedAt = now();
      await saveTasks(api, tasks);
      return { success: true, task };
    },
  },

  {
    name: "start_pomodoro",
    description: "Start a Pomodoro focus timer for a specific task.",
    parameters: z.object({
      task_id: z.string().describe("The task ID to start a Pomodoro for"),
    }),
    execute: async (params: unknown, api: PluginAPI) => {
      const { task_id } = params as { task_id: string };
      const tasks = await getTasks(api);
      const task = tasks.find((t) => t.id === task_id);
      if (!task) return { success: false, error: "Task not found" };

      const session = {
        taskId: task_id,
        type: "work" as const,
        startedAt: now(),
        durationMinutes: 25,
        completedCycles: 0,
      };
      await api.db.set(DB_KEYS.pomodoro, session);
      return { success: true, session };
    },
  },

  {
    name: "get_pomodoro_status",
    description: "Get the current Pomodoro timer state, if any.",
    parameters: z.object({}),
    execute: async (_params: unknown, api: PluginAPI) => {
      const session = await api.db.get(DB_KEYS.pomodoro);
      return { session: session ?? null };
    },
  },
];
