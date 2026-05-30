import type { PluginAPI, PluginIntentHandler } from "@radarboard/plugin-sdk/types";
import type { IntentPayload, IntentResult } from "@radarboard/types/intent";
import { generateId, normalizeTasks, now } from "./task-operations";
import type { Task } from "./types";

const DB_KEY = "tasks:list";

async function getTasks(api: PluginAPI): Promise<Task[]> {
  const raw = (await api.db.get<Array<Record<string, unknown> & { id: string }>>(DB_KEY)) ?? [];
  return normalizeTasks(raw);
}

function buildDescription(payload: IntentPayload): string {
  switch (payload.kind) {
    case "link":
      return `[${payload.title}](${payload.url})${payload.description ? `\n\n${payload.description}` : ""}`;
    case "structured":
      return payload.bodyMarkdown ?? payload.title;
    case "text":
      return payload.body ?? "";
    default:
      return (payload as { title?: string }).title ?? "";
  }
}

export const tasksIntents: PluginIntentHandler[] = [
  {
    action: "create-task",
    label: "Add as Task",
    accepts: ["text", "link", "structured"],
    handle: async (payload: IntentPayload, api: PluginAPI): Promise<IntentResult> => {
      const tasks = await getTasks(api);
      const task: Task = {
        id: generateId(),
        title: payload.title,
        description: buildDescription(payload),
        status: "todo",
        priority: "medium",
        projectId: payload.projectSlug ?? undefined,
        subtasks: [],
        recurrence: null,
        deletedAt: null,
        createdAt: now(),
        updatedAt: now(),
      };
      tasks.push(task);
      await api.db.set(DB_KEY, tasks);
      return { success: true, message: "Task created", createdItemId: task.id };
    },
  },
];
