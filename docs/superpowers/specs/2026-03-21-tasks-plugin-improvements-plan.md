# Upgrade The Tasks Plugin Into A Practical Daily Workflow Workspace

This ExecPlan is maintained according to [PLANS.md](/Users/thedaviddias/Projects/radarboard/PLANS.md). It is written so a new contributor can resume the work using only this file and the current repository state.

## Purpose / Big Picture

The `tasks` plugin currently behaves like a lightweight task tracker. After this change, it should behave more like a daily workflow tool: tasks can have subtasks, recurring tasks can automatically spawn their next occurrence, archived and trashed tasks are managed as separate lifecycle states, and users can inspect and edit tasks through a proper detail panel instead of relying only on compact list interactions. The outcome is observable when the tasks plugin supports archive/trash behavior, recurrence, and subtasks in both the UI and MCP tools, and when the plugin UI exposes the richer task state through filters, a detail panel, and consistent widget behavior.

## Scope

In scope:
- Extend the task data model with subtasks, recurrence, and soft-delete state.
- Create a shared pure operations module used by both the React hook and MCP tools.
- Update `use-tasks.ts`, `mcp-tools.ts`, and related tests to support the richer model.
- Update task filters and task list rows for archive, trash, project, recurrence, and subtask display.
- Add a task detail panel and standalone subtask checklist component.
- Add project support to the task creation flow and keep the widget aligned with active-task semantics.
- Run validation and clean up dead code from the old implementation paths.

Out of scope:
- Pomodoro improvements.
- Drag-and-drop reordering.
- Real-time widget updates through WebSockets.
- Multi-level subtask nesting.

## Progress

- [ ] 2026-03-26 00:00Z: Rewrite the existing tasks implementation plan into a compliant ExecPlan.
- [ ] Implement Milestone 1: extend task types and create the shared operations module.
- [ ] Implement Milestone 2: wire shared operations into the hook and MCP tools.
- [ ] Implement Milestone 3: update list and filter UI for archive, trash, recurrence, and project display.
- [ ] Implement Milestone 4: add the detail panel and subtask list components.
- [ ] Implement Milestone 5: update the task form and widget for project and lifecycle consistency.
- [ ] Implement Milestone 6: run validation, remove dead code, and document outcomes.

## Surprises & Discoveries

- Observation: The current task row click plumbing already sets `selectedTask`, but no detail panel is rendered in response.
  Evidence: The design explicitly notes that the `selectedTask` state in `tasks-overlay.tsx` already wires `onSelect` through to `TaskList`, but there is no rendered panel consuming that state.

- Observation: Recurrence, archive, and trash behavior must stay consistent across both the UI and MCP tools.
  Evidence: The design calls for a shared `task-operations.ts` module used by both `use-tasks.ts` and `mcp-tools.ts`.

- Observation: “Trash” is not a real `TaskStatus`; it is a separate filter mode driven by `deletedAt`.
  Evidence: The design explicitly distinguishes `archived` as a true status value while “Trash” is handled via `deletedAt !== null`.

## Decision Log

- Decision: Keep the shared task lifecycle rules in one pure operations module.
  Rationale: Archive, restore, recurrence spawn, and purge rules should not diverge between the hook and MCP execution paths.
  Date/Author: 2026-03-26 / Codex

- Decision: Preserve archive and trash as distinct concepts.
  Rationale: The design makes a clear product distinction between a recoverable task state (`archived`) and soft deletion (`deletedAt`-driven trash).
  Date/Author: 2026-03-26 / Codex

- Decision: Treat the detail panel as the main editing surface for the richer task model.
  Rationale: Subtasks, recurrence, and project editing are too dense to fit comfortably into the current compact list row pattern.
  Date/Author: 2026-03-26 / Codex

## Outcomes & Retrospective

No implementation work has been completed from this plan yet. When work progresses, this section must summarize what shipped, what changed from the original intent, and what remains.

## Context and Orientation

The tasks plugin lives under `packages/plugins/src/plugins/tasks/`. The design doc at [2026-03-21-tasks-plugin-improvements-design.md](/Users/thedaviddias/Projects/radarboard/docs/superpowers/specs/2026-03-21-tasks-plugin-improvements-design.md) is the source of truth for the feature set and lifecycle rules.

Relevant code areas:

- `packages/plugins/src/plugins/tasks/types.ts`
  This defines the task model and must expand to include subtasks, recurrence, and `deletedAt`.

- `packages/plugins/src/plugins/tasks/use-tasks.ts`
  This is the React hook that loads, mutates, and persists task state for the plugin UI.

- `packages/plugins/src/plugins/tasks/mcp-tools.ts`
  This exposes task behavior through MCP tools and must stay behaviorally aligned with the React hook.

- `packages/plugins/src/plugins/tasks/components/*`
  This contains filters, list UI, overlay UI, form UI, and the new detail-panel and subtask components to be added.

- `packages/plugins/src/plugins/tasks/widget.tsx`
  This smaller surface must stay aligned with active-task semantics even though it does not need the full editor UI.

Important terms:

- `archived`
  A real task status that hides a task from the default active view but still preserves it as an intentional historical item.

- `trash`
  A separate view mode driven by `deletedAt !== null`. Tasks in trash are soft-deleted and may be restored or permanently deleted.

- `recurrence`
  A repeat rule that creates the next task occurrence only when a task transitions into the `"done"` state.

- `auto-purge`
  Tasks soft-deleted more than 30 days ago are removed on data load.

## Plan of Work

Begin by extending the data model and extracting shared lifecycle logic into `task-operations.ts`. This is the dependency anchor for everything else: normalization, recurrence spawning, soft delete, restore, and purge behavior should all be implemented once and reused.

Once the shared logic exists, wire it into both `use-tasks.ts` and `mcp-tools.ts`. This is the most important consistency layer because the plugin must behave the same whether a task is completed, archived, restored, or updated through the UI or a tool call.

After the core logic is in place, update the visible task-management surfaces. First improve filtering and list rows so archive, trash, recurrence, projects, and subtask progress are visible. Then add the detail panel and subtask checklist so the richer task model has a practical editing surface. Only after the main plugin surfaces are aligned should the create form and widget be updated to keep smaller entry points consistent.

Finish by running tests, lint, and typecheck, removing dead code, and updating the living sections of this plan.

## Milestones

## Milestone 1: Extend The Task Data Model And Shared Operations

At the end of this milestone, the repository should contain the expanded task types and a shared pure operations module that both the UI and MCP layers can depend on.

Implementation guidance:
- Update `packages/plugins/src/plugins/tasks/types.ts` to add `Subtask`, `RecurrencePattern`, `Recurrence`, `deletedAt`, and the `"archived"` task status.
- Create `packages/plugins/src/plugins/tasks/task-operations.ts` with shared helpers for ID generation, timestamps, normalization, recurrence date advancement, recurrence spawning, soft delete, and restore behavior.
- Create `packages/plugins/src/plugins/tasks/task-operations.test.ts` with coverage for migration defaults, recurrence date math, recurrence spawning, soft delete, restore, and purge logic.

Acceptance:
- Legacy tasks missing the new fields are normalized safely.
- Auto-purge removes soft-deleted tasks older than 30 days during normalization.
- Recurrence helpers correctly handle daily, weekly, monthly, and custom schedules.
- Shared lifecycle logic is covered by tests.

## Milestone 2: Wire Shared Operations Into The Hook And MCP Tools

At the end of this milestone, the React hook and MCP tools should both operate on the richer task model and share the same lifecycle semantics.

Implementation guidance:
- Update `packages/plugins/src/plugins/tasks/use-tasks.ts` to import the shared operations module, normalize on load, add subtask and recurrence support, introduce soft delete and restore operations, and compute active-task views.
- Update `packages/plugins/src/plugins/tasks/mcp-tools.ts` to import the shared operations module, expose the new task fields, add archive/restore/subtask tools, and make delete perform soft delete.
- Update `packages/plugins/src/plugins/tasks/index.ts` if needed so the new tool array is exported consistently.
- Update `packages/plugins/src/plugins/tasks/mcp-tools.test.ts` to cover recurrence, archive, restore, delete, subtasks, and the richer list behavior.

Acceptance:
- UI and MCP flows both respect the same archive, trash, recurrence, and restore rules.
- Completing a recurring task through either path spawns the next occurrence.
- Listing behavior excludes archived and trashed tasks by default unless explicitly requested.

## Milestone 3: Update Filters And Task List UI

At the end of this milestone, the plugin list surface should visibly support archive, trash, recurrence, project association, and subtask progress.

Implementation guidance:
- Update `packages/plugins/src/plugins/tasks/components/task-filters.tsx` to add archive status support, project filtering, and a separate trash view mode.
- Update `packages/plugins/src/plugins/tasks/components/task-list.tsx` to render subtask progress badges, recurrence indicators, project chips, and a status-cycle interaction instead of a one-step complete shortcut.
- Update `packages/plugins/src/plugins/tasks/components/tasks-overlay.tsx` to manage `viewMode`, `projectFilter`, filtered task sets, and status cycling.

Acceptance:
- The user can switch between active and trash task views.
- Archived tasks are filterable separately from trashed tasks.
- List rows show recurrence and subtask progress when applicable.
- Project filtering works for tasks with `projectId`.

## Milestone 4: Add The Detail Panel And Subtask Checklist

At the end of this milestone, clicking a task should open a detail panel that exposes the full task model for editing.

Implementation guidance:
- Add `packages/plugins/src/plugins/tasks/components/subtask-list.tsx`.
- Add `packages/plugins/src/plugins/tasks/components/task-detail-panel.tsx`.
- Update `packages/plugins/src/plugins/tasks/components/tasks-overlay.tsx` to render the detail panel when `selectedTask` is set and keep selected-task state synchronized with task updates.
- Ensure the panel supports inline editing, status changes, recurrence editing, project editing, subtask editing, archive, and move-to-trash actions.

Acceptance:
- Selecting a task opens a right-side detail panel.
- Subtasks can be added, removed, edited, and toggled from the panel.
- Task fields auto-save through the existing hook-driven mutation path.
- The panel can be closed safely without breaking the overlay.

## Milestone 5: Update The Task Form And Widget

At the end of this milestone, the smaller task entry and summary surfaces should remain compatible with the richer model.

Implementation guidance:
- Update `packages/plugins/src/plugins/tasks/components/task-form.tsx` to support an optional project field.
- Update `packages/plugins/src/plugins/tasks/widget.tsx` so it excludes archived and trashed tasks and remains aligned with the active-task semantics introduced earlier.

Acceptance:
- New tasks can include an optional project value at creation time.
- The widget no longer shows archived or trashed tasks.

## Milestone 6: Validation, Cleanup, And Retrospective

At the end of this milestone, the touched code should pass relevant validation and the plan should reflect the final outcome.

Implementation guidance:
- Run tests, typecheck, and any build or lint commands relevant to the touched plugin paths.
- Remove duplicate helper code that was superseded by `task-operations.ts`.
- Confirm DB key usage remains consistent between the hook and MCP tools.
- Update the living-document sections of this plan with implementation outcomes.

Acceptance:
- The touched tasks plugin paths pass lint, typecheck, and relevant tests.
- Dead code from the previous implementation path is removed.
- The final state of the work is recorded in this plan.

## Concrete Steps

Run commands from the repository root unless another directory is specified.

For tasks plugin tests:

    cd /Users/thedaviddias/Projects/radarboard/packages/plugins
    pnpm vitest run --reporter=verbose src/plugins/tasks

For plugin package typechecking:

    cd /Users/thedaviddias/Projects/radarboard/packages/plugins
    pnpm tsc --noEmit

For focused lint checks:

    cd /Users/thedaviddias/Projects/radarboard
    pnpm --filter @radarboard/plugins exec biome check packages/plugins/src/plugins/tasks

For broader plugin package build validation if needed:

    cd /Users/thedaviddias/Projects/radarboard
    pnpm exec turbo build --filter=@radarboard/plugins

If package names or scripts differ in the current working tree, update this section before continuing so the next contributor does not need to rediscover the correct commands.

## Validation and Acceptance

Validation is complete only when all of the following are true:

- Tasks support subtasks, recurrence, archive, and trash state in both UI and MCP flows.
- Recurring tasks spawn the next occurrence only when they transition to `"done"`.
- Archive and trash behavior are distinct and visible to the user.
- The filter bar supports archived tasks, project filtering, and trash mode.
- Selecting a task opens a detail panel that exposes the richer editing surface.
- The widget excludes archived and trashed tasks.
- The touched tasks plugin paths pass lint, typecheck, and relevant tests.

Manual verification should include:

    1. Create a task with subtasks and verify subtask progress is shown in the list.
    2. Configure recurrence and mark the task done to verify the next occurrence is spawned.
    3. Archive a task and confirm it disappears from the default active view but appears under the archive filter.
    4. Move a task to trash and confirm it appears only in trash mode with restore and permanent-delete actions.
    5. Open the detail panel, edit task fields, and verify changes persist.
    6. Confirm the widget only shows active tasks.

## Idempotence and Recovery

Most of this work is additive and safe to repeat if validation fails. Shared operations, list UI updates, and detail-panel wiring can all be retried after a failing test or lint pass.

Risky areas:
- Recurrence logic can accidentally double-spawn tasks if status-transition checks are wrong.
- Archive and trash flows can become inconsistent if the hook and MCP tools diverge.
- The new detail panel can desynchronize from list state if selected-task updates are not derived from the canonical tasks array.

Recovery guidance:
- Keep recurrence spawning inside the shared operations and use transition checks before invoking it.
- Validate hook and MCP behavior with parallel tests before polishing UI details.
- Keep selected-task state derived from the current tasks array rather than mutating a stale copy.
- If the detail panel introduces regressions, land the underlying data-model and list/filter changes first and reintroduce the panel afterward.

## Artifacts and Notes

Primary source files for this work:
- [2026-03-21-tasks-plugin-improvements-design.md](/Users/thedaviddias/Projects/radarboard/docs/superpowers/specs/2026-03-21-tasks-plugin-improvements-design.md)
- `packages/plugins/src/plugins/tasks/types.ts`
- `packages/plugins/src/plugins/tasks/task-operations.ts`
- `packages/plugins/src/plugins/tasks/use-tasks.ts`
- `packages/plugins/src/plugins/tasks/mcp-tools.ts`
- `packages/plugins/src/plugins/tasks/index.ts`
- `packages/plugins/src/plugins/tasks/components/task-filters.tsx`
- `packages/plugins/src/plugins/tasks/components/task-list.tsx`
- `packages/plugins/src/plugins/tasks/components/tasks-overlay.tsx`
- `packages/plugins/src/plugins/tasks/components/task-detail-panel.tsx`
- `packages/plugins/src/plugins/tasks/components/subtask-list.tsx`
- `packages/plugins/src/plugins/tasks/components/task-form.tsx`
- `packages/plugins/src/plugins/tasks/widget.tsx`

This work is the tasks-plugin counterpart to the richer expenses plugin planning slice: both rely on shared pure operations, lifecycle-aware MCP tools, and more capable full-plugin editing surfaces.

## Interfaces and Dependencies

Internal dependencies:
- `types.ts` must define the richer task model and the `"archived"` status.
- `task-operations.ts` must be the shared source of truth for normalization, recurrence, delete, and restore behavior.
- `use-tasks.ts` must remain the canonical persisted-state hook for the task UI.
- `mcp-tools.ts` must remain behaviorally aligned with the hook.
- The plugin UI under `components/` must consume the richer task model without re-implementing lifecycle logic locally.

User-visible interfaces that must exist by the end:
- Active and trash task views.
- Archive support as a separate status-driven filter.
- Detail-panel editing for the richer task model.
- Subtask editing and recurrence behavior.

Revision note: 2026-03-26. Rewrote this legacy implementation plan into a compliant ExecPlan so the repo has a second plugin example that follows the `PLANS.md` standard.
