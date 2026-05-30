# Tasks Plugin Improvements Design

**Date:** 2026-03-21
**Status:** Draft
**Plugin:** `tasks` (packages/plugins/src/plugins/tasks/)

## Overview

Improve the Tasks plugin with workflow features (subtasks, recurrence, archive/trash), a task detail/edit panel, and project integration. These changes turn the plugin from a minimal task tracker into a practical daily workflow tool.

## Goals

1. Add subtask checklists to tasks for breaking down work
2. Support recurring tasks that auto-spawn on completion
3. Introduce soft delete (trash) and archive for task lifecycle management
4. Build a slide-out detail panel for viewing and editing tasks
5. Surface project integration in filters and task display

## Non-Goals

- Pomodoro improvements (separate effort)
- Real-time widget updates via WebSocket
- Drag-and-drop reordering
- Multi-level subtask nesting

---

## 1. Data Model Changes

### Task Type Updates

```typescript
interface Subtask {
  id: string;          // nano-id or timestamp-based
  title: string;
  done: boolean;
}

type RecurrencePattern = "daily" | "weekly" | "monthly" | "custom";

interface Recurrence {
  pattern: RecurrencePattern;
  intervalDays?: number;  // Required when pattern is "custom"
}

interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;  // Extend TaskStatus type to include "archived"
  priority: "low" | "medium" | "high" | "urgent";
  dueDate?: string;           // ISO 8601 date
  projectId?: string;         // Links to Radarboard projects
  subtasks: Subtask[];        // NEW: flat checklist
  recurrence: Recurrence | null;  // NEW: repeat config
  deletedAt: string | null;   // NEW: soft delete timestamp (ISO 8601), null = active
  createdAt: string;
  updatedAt: string;
}
```

### Migration

Existing tasks lack `subtasks`, `recurrence`, and `deletedAt`. The `useTasks` hook normalizes on load:

```typescript
const normalize = (task: Task): Task => ({
  ...task,
  subtasks: task.subtasks ?? [],
  recurrence: task.recurrence ?? null,
  deletedAt: task.deletedAt ?? null,
});
```

### TaskStatus Type Update

The existing `TaskStatus = "todo" | "in-progress" | "done"` type must be extended to include `"archived"`. This type is imported in `task-filters.tsx`, `task-list.tsx`, and `mcp-tools.ts` — all must be updated. The "Trash" filter is **not** a status value; it is handled via a separate filter mode that checks `deletedAt !== null` (see Section 6).

### Auto-Purge

On data load, tasks where `deletedAt` is older than 30 days are permanently removed from the persisted list. This keeps the trash from growing unbounded.

**Known limitation**: If the app stays open without reloading, purge won't run until the next data load. This is acceptable for a personal tool.

### Shared Task Operations Module

**New file: `task-operations.ts`** — Pure utility functions used by both `use-tasks.ts` (React hook) and `mcp-tools.ts` (MCP tools). This avoids duplicating logic across the two execution paths.

Exports:
- `normalizeTasks(tasks: Task[]): Task[]` — migration/normalization + auto-purge
- `spawnRecurrence(task: Task): Task | null` — clone a recurring task with advanced due date, returns null if not recurring. Handles monthly end-of-month by clamping to last day of target month.
- `advanceDueDate(dueDate: string | undefined, recurrence: Recurrence): string` — calculates next due date
- `softDelete(task: Task): Task` — sets `deletedAt`
- `restoreTask(task: Task): Task` — clears `deletedAt` if trashed, sets status to "todo" if archived (known tradeoff: previous status is not preserved when archiving — restoring always resets to "todo")

Both `use-tasks.ts` and `mcp-tools.ts` import from this module, ensuring recurrence triggers correctly regardless of whether a task is completed via UI or MCP tool.

---

## 2. Task Detail Panel (Slide-out)

### Trigger

Clicking a task row in the task list opens the detail panel. The existing `selectedTask` state in `tasks-overlay.tsx` already wires `onSelect` through to `TaskList` row clicks — the plumbing exists but no panel renders in response. This change adds the panel component that consumes that state.

### Layout

The panel slides in from the right (~400px wide). The task list compresses to fill the remaining space.

```
+---------------------------+------------------+
| Task List (compressed)    | Detail Panel     |
|                           |                  |
| [filters]                 | Title (editable) |
| [task rows...]            | Status dropdown  |
|                           | Priority buttons |
|                           | Due date picker  |
|                           | Project selector |
|                           | Description      |
|                           |                  |
|                           | --- Subtasks --- |
|                           | [x] Item 1      |
|                           | [ ] Item 2      |
|                           | + Add subtask    |
|                           | 1/2 done         |
|                           |                  |
|                           | Recurrence: None |
|                           |                  |
|                           | --- Meta ---     |
|                           | Created: ...     |
|                           | Updated: ...     |
|                           |                  |
|                           | [Archive][Delete]|
+---------------------------+------------------+
```

### Fields

| Field | Behavior |
|-------|----------|
| **Title** | Click to edit inline. Enter to save, Escape to cancel. |
| **Status** | Dropdown pill: Todo, In Progress, Done, Archived. Changing saves immediately. |
| **Priority** | Button group (Low, Med, High, Urgent). Same as create form. |
| **Due date** | Date input. Clearing removes the due date. |
| **Project** | Dropdown of known project IDs from existing tasks + free text input. |
| **Description** | Auto-expanding textarea. Saves on blur. |
| **Subtasks** | Checklist with add/remove/toggle. See section 3. |
| **Recurrence** | Dropdown: None, Daily, Weekly, Monthly, Custom. Custom shows interval input. |
| **Metadata** | Read-only: created date, updated date, task ID (muted small text). |
| **Actions** | Archive button, Delete button ("Move to trash"). |

### Interactions

- **Close**: Escape key, click outside panel, or explicit close button (X)
- **Auto-save**: All field changes persist immediately via `updateTask()`
- **Keyboard**: Tab navigates between fields

---

## 3. Subtasks

### Behavior

- Each task has a `subtasks: Subtask[]` array (flat, one level only)
- Subtasks display as a checklist in the detail panel
- Each subtask row: checkbox + editable title + delete (x) button
- "Add subtask" input at the bottom of the list
- Progress indicator above the list: "2/5 done"

### Auto-Complete Parent

When all subtasks are marked done:
- Show a toast: "All subtasks done. Complete this task?"
- Toast has "Complete" and "Dismiss" actions
- If confirmed, parent task status is set to "done"
- If the task has recurrence, the recurrence logic triggers (see section 4)

### In Task List

- Task rows show a subtle subtask badge: "2/5" next to the task title when subtasks exist
- Badge uses muted styling so it doesn't dominate

---

## 4. Recurrence

### Configuration

Set via the detail panel's recurrence dropdown:
- **None** (default)
- **Daily** — next due date = current due date + 1 day
- **Weekly** — + 7 days
- **Monthly** — + 1 calendar month
- **Custom** — shows a numeric input for interval in days

### On Completion

When a recurring task's status is set to "done":

1. Clone the task with:
   - New `id` and `createdAt`
   - `status: "todo"`
   - Subtask `done` flags all reset to `false`
   - `deletedAt: null`
   - `dueDate` advanced by recurrence pattern
2. If the original task has no `dueDate`, use today as the base
3. Insert the new task into the task list
4. Show toast: "Next occurrence created for [formatted date]"
5. The completed original stays in the list as "done" for history

### Edge Cases

- **MCP completion**: Recurrence triggers via shared `spawnRecurrence()` in `task-operations.ts` — both UI and MCP tools call the same function
- **Archive**: If a recurring task is archived instead of completed, no new occurrence is created
- **Trash**: If a recurring task is deleted (trashed), no new occurrence is created
- **End-of-month**: Monthly recurrence from Jan 31 → Feb 28 (clamp to last day of month)
- **Idempotency**: `spawnRecurrence()` is called only when status transitions to "done" (not when already "done"). The `completeTask` and `updateTask` functions check previous status before spawning. If a "done" task is set to "in-progress" and back to "done", recurrence triggers again (this is intentional — it represents a new completion cycle)
- **No due date**: If a recurring task has no `dueDate`, today's date is used as the base for calculating the next occurrence

---

## 5. Archive & Trash

### Archive

- **How**: Set `status: "archived"` via detail panel or MCP tool
- **Visibility**: Hidden from default filters. Shown under "Archived" filter tab
- **Restore**: Sets status to "todo" (known tradeoff: previous status before archiving is not preserved)
- Archived tasks do not appear in "Today's Tasks" widget

### Trash (Soft Delete)

- **How**: Click "Delete" on a task → sets `deletedAt` to current ISO timestamp
- **Visibility**: Hidden from all views except "Trash" filter tab
- **Restore**: Clear `deletedAt` from trash view → task returns to its previous status
- **Permanent delete**: Available only from trash view. Removes task from DB entirely
- **Auto-purge**: Tasks in trash > 30 days are permanently deleted on data load

### Trash View

Shown when "Trash" filter is selected:
- List of soft-deleted tasks with `deletedAt` date displayed
- Each row has "Restore" and "Delete Forever" actions
- Banner at top: "Tasks in trash are permanently deleted after 30 days"

### Archive + Trash Interaction

- **Trashing an archived task**: Allowed. Sets `deletedAt` — task moves to Trash view (Trash takes precedence over Archive when `deletedAt` is set)
- **Archiving a trashed task**: Not allowed. Tasks must be restored from trash first
- **Filter precedence**: If `deletedAt !== null`, task appears in Trash regardless of status

---

## 6. Filter & List Updates

### Filter Bar

Current filters: Status (All, Todo, In Progress, Done) + Priority (All, Urgent, High, Med, Low)

**Additions:**
- Status filter gains: **Archived** option (a real `TaskStatus` value)
- New **Trash** toggle — separate from the status filter. When active, shows only tasks with `deletedAt !== null` and ignores status filter. Implemented as a `viewMode: "active" | "trash"` state, not as part of `TaskStatus`.
- New filter: **Project** dropdown — populated from distinct `projectId` values across all active tasks. "All Projects" as default. Only shows if any tasks have a projectId.

### Task List Row Updates

Current row: status icon + title + priority badge + due date + actions (play, delete)

**Additions:**
- **Subtask badge**: "2/5" shown after title when subtasks exist (muted text)
- **Recurrence icon**: Small repeat/refresh icon shown if `recurrence !== null`
- **Project chip**: Colored tag/chip showing project name if `projectId` is set
- **Click handler**: Row click already sets `selectedTask` state — now renders the detail panel in response
- **Status icon**: Currently calls `completeTask` (jumps straight to "done"). Change to cycle: todo → in-progress → done
- **Delete action**: Now soft-deletes (sets `deletedAt`) instead of permanent delete

---

## 7. MCP Tool Updates

### Modified Tools

**`create_task`** — new optional parameters:
- `subtasks`: `Array<{ title: string, done?: boolean }>` — initial subtask checklist
- `recurrence`: `{ pattern: string, intervalDays?: number } | null` — set recurrence at creation

**`update_task`** — new optional parameters:
- `subtasks`: `Array<{ id?: string, title: string, done: boolean }>` — replace subtask list
- `recurrence`: `{ pattern: string, intervalDays?: number } | null` — set or clear
- Note: `project_id` already exists on `update_task`; `status` enum gains `"archived"`. When status changes to "done", shared `spawnRecurrence()` is called.

**`list_tasks`** — new optional parameters:
- Note: `project_id` filter already exists
- `include_archived`: boolean (default false) — include archived tasks
- `include_deleted`: boolean (default false) — include trashed tasks
- Default behavior: excludes archived and trashed tasks (matches current behavior of only showing active tasks)

**`delete_task`** — becomes soft delete by default (sets `deletedAt` via shared `softDelete()`)

### New Tools

**`archive_task`**
- Params: `task_id: string`
- Sets status to "archived"
- Returns: `{ success: boolean, task?: Task, error?: string }`

**`restore_task`**
- Params: `task_id: string`
- If archived: sets status back to "todo"
- If trashed: clears `deletedAt`
- Returns: `{ success: boolean, task?: Task, error?: string }`

**`get_task`**
- Params: `task_id: string`
- Returns full task detail including subtasks, recurrence config, project, and metadata
- Returns: `{ success: boolean, task?: Task, error?: string }`
- Purpose: Lets the assistant inspect a single task's full state without listing all tasks

**`add_subtask`**
- Params: `task_id: string`, `title: string`
- Appends a new subtask to the task's checklist (initially unchecked)
- Returns: `{ success: boolean, task?: Task, error?: string }`
- Purpose: Single-operation subtask creation — avoids read-modify-write of the full subtask array

**`toggle_subtask`**
- Params: `task_id: string`, `subtask_id: string`
- Toggles the `done` flag on a specific subtask
- If all subtasks become done, auto-complete logic triggers (same as UI)
- Returns: `{ success: boolean, task?: Task, allDone?: boolean, error?: string }`
- Purpose: Natural "check off a subtask" action for the assistant

**`remove_subtask`**
- Params: `task_id: string`, `subtask_id: string`
- Removes a subtask from the checklist
- Returns: `{ success: boolean, task?: Task, error?: string }`

### Updated Tool Descriptions

All tool descriptions should be explicit about new capabilities so the LLM can discover them naturally:

- `list_tasks`: *"List tasks with optional filters. By default, excludes archived and trashed tasks. Use include_archived or include_deleted to see those. Supports filtering by status, project, priority, and due date."*
- `delete_task`: *"Soft-delete a task (moves to trash, recoverable for 30 days). Use restore_task to recover. For permanent deletion, use from the UI trash view."*
- `create_task`: *"Create a new task. Optionally include subtasks (checklist items) and recurrence (daily/weekly/monthly/custom) at creation time."*
- `update_task`: *"Update task fields. Can set subtasks (replaces entire list), recurrence, status (including 'archived'), priority, due date, and project. When status changes to 'done' on a recurring task, the next occurrence is auto-created."*

---

## 8. Project Integration

### Data Source

Projects come from two sources:
1. **Radarboard projects** — if the app has a project list, use it as dropdown options
2. **Free text** — user can type a project name directly; stored as `projectId` string on the task

### UI Surfaces

- **Detail panel**: Project field with dropdown + free text input
- **Filter bar**: Project dropdown filter (only shown when tasks have projects)
- **Task list row**: Project shown as a subtle colored chip
- **Create form**: Optional project field added to task creation

### Widget

The "Today's Tasks" widget fetches raw task data from the API. Its `todayTasks` filter must be updated to also exclude `status === "archived"` and `deletedAt !== null` tasks. Project filtering is an overlay-only concern — the widget does not filter by project.

---

## 9. File Changes Summary

| File | Change |
|------|--------|
| `types.ts` | Add `Subtask`, `Recurrence` types. Extend `TaskStatus` to include `"archived"`. Add `subtasks`, `recurrence`, `deletedAt` to `Task`. |
| `task-operations.ts` | **NEW**: Shared pure functions — `normalizeTasks`, `spawnRecurrence`, `advanceDueDate`, `softDelete`, `restoreTask`. Used by both hook and MCP tools. |
| `use-tasks.ts` | Import from `task-operations.ts`. Expand `updateTask` signature to accept `subtasks`, `recurrence`, `deletedAt`. Add `archiveTask`, `restoreTask`, `softDeleteTask` methods. Call `spawnRecurrence` when status transitions to "done". Update `todayTasks` to exclude archived/trashed. New `addTask` accepts optional `subtasks` and `recurrence`. |
| `components/tasks-overlay.tsx` | Render detail panel when `selectedTask` is set. Update layout to flex split view. Add `viewMode` state for trash toggle. |
| `components/task-list.tsx` | Subtask badge, recurrence icon, project chip. Change status icon from `completeTask` to status cycling (todo → in-progress → done). |
| `components/task-filters.tsx` | Add Archived to status filter. Add Trash toggle (separate from status). Add Project dropdown filter. |
| `components/task-form.tsx` | Add optional project field. |
| `components/task-detail-panel.tsx` | **NEW**: Slide-out panel with all editable fields and subtask list. |
| `components/subtask-list.tsx` | **NEW**: Checklist component for subtasks. |
| `mcp-tools.ts` | Import from `task-operations.ts`. Update `create_task`, `update_task`, `list_tasks`, `delete_task`. Add `archive_task`, `restore_task`, `get_task`, `add_subtask`, `toggle_subtask`, `remove_subtask`. Update all tool descriptions for LLM discoverability. |
| `mcp-tools.test.ts` | Tests for all new/modified tools including recurrence spawning, archive, restore, soft delete, subtask operations. |
| `widget.tsx` | Update `todayTasks` filter to exclude `status === "archived"` and `deletedAt !== null`. |
| `index.ts` | Register all new MCP tools (`archive_task`, `restore_task`, `get_task`, `add_subtask`, `toggle_subtask`, `remove_subtask`) in descriptor. |

---

## 10. Testing Strategy

- **MCP tools**: Unit tests for all new and modified tools (archive, restore, recurrence spawning, subtask updates)
- **use-tasks hook**: Test normalization, auto-purge logic, recurrence cloning
- **Components**: Rely on existing pattern — no component tests required initially (matches current codebase convention)
