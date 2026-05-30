import { createMockPluginAPI } from "@radarboard/plugin-sdk/testing";
import type { PluginAPI } from "@radarboard/plugin-sdk/types";
import { beforeEach, describe, expect, it } from "vitest";
import { tasksMcpTools } from "./mcp-tools";
import type { Task } from "./types";

function findTool(name: string) {
  const tool = tasksMcpTools.find((t) => t.name === name);
  if (!tool) throw new Error(`Tool "${name}" not found`);
  return tool;
}

describe("Tasks MCP Tools", () => {
  let api: PluginAPI;

  beforeEach(() => {
    api = createMockPluginAPI();
  });

  describe("create_task", () => {
    it("creates a task with required fields", async () => {
      const tool = findTool("create_task");
      const result = (await tool.execute({ title: "Buy milk" }, api)) as {
        success: boolean;
        task: Task;
      };

      expect(result.success).toBe(true);
      expect(result.task.title).toBe("Buy milk");
      expect(result.task.status).toBe("todo");
      expect(result.task.priority).toBe("medium");
      expect(result.task.id).toBeTruthy();
    });

    it("creates a task with all optional fields", async () => {
      const tool = findTool("create_task");
      const result = (await tool.execute(
        {
          title: "Ship feature",
          description: "The big one",
          priority: "urgent",
          due_date: "2026-04-01",
          project_id: "my-project",
        },
        api
      )) as { success: boolean; task: Task };

      expect(result.task.description).toBe("The big one");
      expect(result.task.priority).toBe("urgent");
      expect(result.task.dueDate).toBe("2026-04-01");
      expect(result.task.projectId).toBe("my-project");
    });

    it("persists tasks across calls", async () => {
      const create = findTool("create_task");
      const list = findTool("list_tasks");

      await create.execute({ title: "Task 1" }, api);
      await create.execute({ title: "Task 2" }, api);

      const result = (await list.execute({}, api)) as {
        tasks: Task[];
        count: number;
      };
      expect(result.count).toBe(2);
      expect(result.tasks.map((t) => t.title)).toEqual(["Task 1", "Task 2"]);
    });
  });

  describe("list_tasks", () => {
    it("returns empty list when no tasks exist", async () => {
      const tool = findTool("list_tasks");
      const result = (await tool.execute({}, api)) as {
        tasks: Task[];
        count: number;
      };
      expect(result.tasks).toEqual([]);
      expect(result.count).toBe(0);
    });

    it("filters by status", async () => {
      const create = findTool("create_task");
      const complete = findTool("complete_task");
      const list = findTool("list_tasks");

      const r1 = (await create.execute({ title: "Done task" }, api)) as {
        task: Task;
      };
      await create.execute({ title: "Todo task" }, api);
      await complete.execute({ task_id: r1.task.id }, api);

      const result = (await list.execute({ status: "done" }, api)) as {
        tasks: Task[];
        count: number;
      };
      expect(result.count).toBe(1);
      expect(result.tasks[0]?.title).toBe("Done task");
    });

    it("filters by priority", async () => {
      const create = findTool("create_task");
      const list = findTool("list_tasks");

      await create.execute({ title: "Low", priority: "low" }, api);
      await create.execute({ title: "High", priority: "high" }, api);

      const result = (await list.execute({ priority: "high" }, api)) as {
        tasks: Task[];
        count: number;
      };
      expect(result.count).toBe(1);
      expect(result.tasks[0]?.title).toBe("High");
    });
  });

  describe("complete_task", () => {
    it("marks a task as done", async () => {
      const create = findTool("create_task");
      const complete = findTool("complete_task");

      const { task } = (await create.execute({ title: "Finish" }, api)) as {
        task: Task;
      };
      const result = (await complete.execute({ task_id: task.id }, api)) as {
        success: boolean;
        task: Task;
      };

      expect(result.success).toBe(true);
      expect(result.task.status).toBe("done");
    });

    it("returns error for nonexistent task", async () => {
      const tool = findTool("complete_task");
      const result = (await tool.execute({ task_id: "fake-id" }, api)) as {
        success: boolean;
        error: string;
      };

      expect(result.success).toBe(false);
      expect(result.error).toBe("Task not found");
    });
  });

  describe("update_task", () => {
    it("updates task fields", async () => {
      const create = findTool("create_task");
      const update = findTool("update_task");

      const { task } = (await create.execute({ title: "Old title" }, api)) as {
        task: Task;
      };
      const result = (await update.execute(
        {
          task_id: task.id,
          title: "New title",
          priority: "high",
          status: "in-progress",
        },
        api
      )) as { success: boolean; task: Task };

      expect(result.success).toBe(true);
      expect(result.task.title).toBe("New title");
      expect(result.task.priority).toBe("high");
      expect(result.task.status).toBe("in-progress");
    });
  });

  describe("delete_task", () => {
    it("soft-deletes a task", async () => {
      const create = findTool("create_task");
      const del = findTool("delete_task");
      const list = findTool("list_tasks");

      const { task } = (await create.execute({ title: "Delete me" }, api)) as {
        task: Task;
      };
      const result = (await del.execute({ task_id: task.id }, api)) as {
        success: boolean;
      };

      expect(result.success).toBe(true);
      // Default list excludes deleted
      const remaining = (await list.execute({}, api)) as { count: number };
      expect(remaining.count).toBe(0);

      // include_deleted shows it
      const all = (await list.execute({ include_deleted: true }, api)) as { count: number };
      expect(all.count).toBe(1);
    });

    it("returns error for nonexistent task", async () => {
      const tool = findTool("delete_task");
      const result = (await tool.execute({ task_id: "nope" }, api)) as {
        success: boolean;
        error: string;
      };

      expect(result.success).toBe(false);
    });
  });

  describe("get_task", () => {
    it("returns full task detail", async () => {
      const create = findTool("create_task");
      const get = findTool("get_task");

      const { task } = (await create.execute(
        { title: "Detail task", subtasks: [{ title: "Sub 1" }], recurrence: { pattern: "daily" } },
        api
      )) as { task: Task };

      const result = (await get.execute({ task_id: task.id }, api)) as {
        success: boolean;
        task: Task;
      };

      expect(result.success).toBe(true);
      expect(result.task.title).toBe("Detail task");
      expect(result.task.subtasks).toHaveLength(1);
      expect(result.task.recurrence?.pattern).toBe("daily");
    });

    it("returns error for nonexistent task", async () => {
      const get = findTool("get_task");
      const result = (await get.execute({ task_id: "fake" }, api)) as {
        success: boolean;
        error: string;
      };
      expect(result.success).toBe(false);
    });
  });

  describe("archive_task", () => {
    it("sets status to archived", async () => {
      const create = findTool("create_task");
      const archive = findTool("archive_task");

      const { task } = (await create.execute({ title: "Archive me" }, api)) as { task: Task };
      const result = (await archive.execute({ task_id: task.id }, api)) as {
        success: boolean;
        task: Task;
      };

      expect(result.success).toBe(true);
      expect(result.task.status).toBe("archived");
    });

    it("archived tasks excluded from default list", async () => {
      const create = findTool("create_task");
      const archive = findTool("archive_task");
      const list = findTool("list_tasks");

      const { task } = (await create.execute({ title: "Archive me" }, api)) as { task: Task };
      await archive.execute({ task_id: task.id }, api);

      const result = (await list.execute({}, api)) as { count: number };
      expect(result.count).toBe(0);

      const withArchived = (await list.execute({ include_archived: true }, api)) as {
        count: number;
      };
      expect(withArchived.count).toBe(1);
    });
  });

  describe("restore_task", () => {
    it("restores archived task to todo", async () => {
      const create = findTool("create_task");
      const archive = findTool("archive_task");
      const restore = findTool("restore_task");

      const { task } = (await create.execute({ title: "Restore me" }, api)) as { task: Task };
      await archive.execute({ task_id: task.id }, api);

      const result = (await restore.execute({ task_id: task.id }, api)) as {
        success: boolean;
        task: Task;
      };
      expect(result.success).toBe(true);
      expect(result.task.status).toBe("todo");
    });

    it("restores soft-deleted task", async () => {
      const create = findTool("create_task");
      const del = findTool("delete_task");
      const restore = findTool("restore_task");

      const { task } = (await create.execute({ title: "Trashed" }, api)) as { task: Task };
      await del.execute({ task_id: task.id }, api);

      const result = (await restore.execute({ task_id: task.id }, api)) as {
        success: boolean;
        task: Task;
      };
      expect(result.success).toBe(true);
      expect(result.task.deletedAt).toBeNull();
    });
  });

  describe("add_subtask", () => {
    it("appends a subtask to a task", async () => {
      const create = findTool("create_task");
      const addSub = findTool("add_subtask");

      const { task } = (await create.execute({ title: "Parent" }, api)) as { task: Task };
      const result = (await addSub.execute({ task_id: task.id, title: "Child subtask" }, api)) as {
        success: boolean;
        task: Task;
      };

      expect(result.success).toBe(true);
      expect(result.task.subtasks).toHaveLength(1);
      expect(result.task.subtasks[0]?.title).toBe("Child subtask");
      expect(result.task.subtasks[0]?.done).toBe(false);
    });
  });

  describe("toggle_subtask", () => {
    it("toggles subtask done state", async () => {
      const create = findTool("create_task");
      const addSub = findTool("add_subtask");
      const toggle = findTool("toggle_subtask");

      const { task } = (await create.execute({ title: "Parent" }, api)) as { task: Task };
      const { task: withSub } = (await addSub.execute(
        { task_id: task.id, title: "Toggle me" },
        api
      )) as { task: Task };

      const subtaskId = withSub.subtasks[0]?.id;
      const result = (await toggle.execute({ task_id: task.id, subtask_id: subtaskId }, api)) as {
        success: boolean;
        task: Task;
        allDone: boolean;
      };

      expect(result.success).toBe(true);
      expect(result.task.subtasks[0]?.done).toBe(true);
      expect(result.allDone).toBe(true);
    });

    it("auto-completes parent when all subtasks done", async () => {
      const create = findTool("create_task");
      const addSub = findTool("add_subtask");
      const toggle = findTool("toggle_subtask");

      const { task } = (await create.execute({ title: "Parent" }, api)) as { task: Task };
      await addSub.execute({ task_id: task.id, title: "Sub 1" }, api);
      const { task: withSubs } = (await addSub.execute(
        { task_id: task.id, title: "Sub 2" },
        api
      )) as { task: Task };

      const sub1Id = withSubs.subtasks[0]?.id;
      const sub2Id = withSubs.subtasks[1]?.id;

      await toggle.execute({ task_id: task.id, subtask_id: sub1Id }, api);
      const result = (await toggle.execute({ task_id: task.id, subtask_id: sub2Id }, api)) as {
        success: boolean;
        task: Task;
        allDone: boolean;
      };

      expect(result.allDone).toBe(true);
      expect(result.task.status).toBe("done");
    });
  });

  describe("remove_subtask", () => {
    it("removes a subtask", async () => {
      const create = findTool("create_task");
      const addSub = findTool("add_subtask");
      const removeSub = findTool("remove_subtask");

      const { task } = (await create.execute({ title: "Parent" }, api)) as { task: Task };
      const { task: withSub } = (await addSub.execute(
        { task_id: task.id, title: "Remove me" },
        api
      )) as { task: Task };

      const subtaskId = withSub.subtasks[0]?.id;
      const result = (await removeSub.execute(
        { task_id: task.id, subtask_id: subtaskId },
        api
      )) as { success: boolean; task: Task };

      expect(result.success).toBe(true);
      expect(result.task.subtasks).toHaveLength(0);
    });

    it("returns error for nonexistent subtask", async () => {
      const create = findTool("create_task");
      const removeSub = findTool("remove_subtask");

      const { task } = (await create.execute({ title: "Parent" }, api)) as { task: Task };
      const result = (await removeSub.execute({ task_id: task.id, subtask_id: "fake" }, api)) as {
        success: boolean;
        error: string;
      };

      expect(result.success).toBe(false);
      expect(result.error).toBe("Subtask not found");
    });
  });

  describe("create_task with subtasks and recurrence", () => {
    it("creates task with subtasks", async () => {
      const create = findTool("create_task");
      const result = (await create.execute(
        {
          title: "Complex task",
          subtasks: [{ title: "Step 1" }, { title: "Step 2", done: true }],
        },
        api
      )) as { success: boolean; task: Task };

      expect(result.task.subtasks).toHaveLength(2);
      expect(result.task.subtasks[0]?.done).toBe(false);
      expect(result.task.subtasks[1]?.done).toBe(true);
    });

    it("creates task with recurrence", async () => {
      const create = findTool("create_task");
      const result = (await create.execute(
        { title: "Recurring", recurrence: { pattern: "weekly" } },
        api
      )) as { success: boolean; task: Task };

      expect(result.task.recurrence?.pattern).toBe("weekly");
    });
  });

  describe("complete_task with recurrence", () => {
    it("spawns next occurrence on completion", async () => {
      const create = findTool("create_task");
      const complete = findTool("complete_task");
      const list = findTool("list_tasks");

      await create.execute(
        {
          title: "Weekly task",
          due_date: "2026-03-20",
          recurrence: { pattern: "weekly" },
        },
        api
      );

      const { tasks: before } = (await list.execute(
        { include_archived: true, include_deleted: true },
        api
      )) as {
        tasks: Task[];
      };
      const taskId = before[0]?.id;

      await complete.execute({ task_id: taskId }, api);

      const { tasks: after } = (await list.execute(
        { include_archived: true, include_deleted: true },
        api
      )) as {
        tasks: Task[];
      };

      // Original + spawned
      expect(after).toHaveLength(2);
      const original = after.find((t) => t.id === taskId);
      const spawned = after.find((t) => t.id !== taskId);
      expect(original?.status).toBe("done");
      expect(spawned?.status).toBe("todo");
      expect(spawned?.dueDate).toBe("2026-03-27");
    });
  });
});
