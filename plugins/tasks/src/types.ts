export type TaskStatus = "todo" | "in-progress" | "done" | "archived";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export type RecurrencePattern = "daily" | "weekly" | "monthly" | "custom";

export interface Recurrence {
  pattern: RecurrencePattern;
  intervalDays?: number; // Required when pattern is "custom"
}

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string; // ISO 8601 date string
  projectId?: string; // Links to a Radarboard project slug
  folderId?: string; // Links to a TaskFolder.id
  subtasks: Subtask[];
  recurrence: Recurrence | null;
  deletedAt: string | null; // ISO 8601 soft-delete timestamp, null = active
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface TaskFolder {
  id: string;
  name: string;
  type: "project" | "custom";
  projectSlug?: string; // Only for type="project" — matches Project.slug
  color?: string;
  archived: boolean;
  order: number;
  createdAt: string;
}

export interface KanbanColumn {
  id: string; // Matches a TaskStatus value, or a custom status string
  label: string; // User-visible name (e.g. "In Review")
  color?: string; // Accent color for the column header
  visible: boolean; // Hidden columns still exist, tasks just aren't shown
  order: number;
  width?: number; // Flex ratio (default 1). Columns share space proportionally.
}

export const DEFAULT_KANBAN_COLUMNS: KanbanColumn[] = [
  { id: "todo", label: "Todo", visible: true, order: 0 },
  { id: "in-progress", label: "In Progress", color: "blue", visible: true, order: 1 },
  { id: "done", label: "Done", color: "green", visible: true, order: 2 },
];

export interface PomodoroSession {
  taskId: string;
  type: "work" | "short-break" | "long-break";
  startedAt: string; // ISO 8601
  durationMinutes: number;
  completedCycles: number; // Number of completed work sessions
}

export interface TasksSettings {
  workMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
}

export const DEFAULT_TASKS_SETTINGS: TasksSettings = {
  workMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
};
