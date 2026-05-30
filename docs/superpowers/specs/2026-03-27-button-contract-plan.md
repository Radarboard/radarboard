# Enforce Shared Button Contract

This ExecPlan is maintained according to [PLANS.md](/Users/thedaviddias/Projects/radarboard/PLANS.md).

## Purpose / Big Picture
Radarboard should start treating shared action buttons the same way it now treats modal shells and form controls: a small, explicit contract enforced in high-signal surfaces first. After this pass, obvious action buttons in shared plugin-sdk components and a few dialog-style plugin/settings files will render through `@radarboard/ui/button`, and a repository check will fail if those files regress to raw `<button>` usage.

The visible outcome is more consistent call-to-action, cancel, menu action, and icon action styling in shared plugin UI and selected dialogs. The maintainer-visible outcome is a first button policy that distinguishes action buttons from structural click targets instead of attempting a blanket ban.

## Scope
In scope:
- Shared action-button surfaces in `packages/plugin-sdk/src/components/**`.
- Selected dialog/action files with obvious CTA buttons:
  - `plugins/notes/src/components/template-manager.tsx`
  - `plugins/expenses/src/components/budget-editor.tsx`
  - `plugins/changelog/src/components/changelog-overlay/changelog-actions-dialog.tsx`
  - `apps/app/components/settings/extension-installer.tsx`
- A scoped button contract script that enforces `@radarboard/ui/button` in those files.

Out of scope:
- A repo-wide ban on raw `<button>`.
- Structural row triggers, drag handles, tab-like toggles, disclosure controls, and composite interaction wrappers.
- Refactoring every plugin and widget action surface in one pass.

## Progress
- [x] 2026-03-27 21:36Z: Audited remaining raw button usage and isolated the first high-confidence action-button surfaces.
- [x] 2026-03-27 21:47Z: Migrated the initial shared/action batch to `@radarboard/ui/button`.
- [x] 2026-03-27 21:54Z: Added `check-button-contract` and verified the scoped contract with Biome and targeted typecheck runs.
- [x] 2026-03-27 22:07Z: Expanded the scoped button contract into template-picker, changelog release actions, settings sidebar preview action, and layout preset toggles/cards.
- [x] 2026-03-27 22:18Z: Expanded the scoped button contract into task list actions and both note/task folder sidebars.
- [x] 2026-03-27 22:24Z: Added note folder sidebar to the enforced set and re-verified the task/note button surfaces.
- [x] 2026-03-27 22:36Z: Expanded the scoped button contract into chat-search actions, widget empty/configure actions, widget log toolbar actions, commits tabs, and shared plugin list tabs.
- [x] 2026-03-27 22:49Z: Expanded the scoped button contract into changelog detail, expense detail, status page, RSS reader, and embeddings action surfaces.
- [x] 2026-03-27 23:44Z: Strengthened the contract from an enforced-file allowlist to a repo-wide scan with explicit exceptions for remaining structural and legacy button surfaces.

## Surprises & Discoveries
- Observation: raw buttons remain numerous across the repo, but many are structural or behavior-specific rather than generic action buttons.
  Evidence: `raw buttons: 221` versus `shared Button imports: 68`, plus the audit of row triggers, menu toggles, and icon-only controls in widgets/plugins.
- Observation: the first safe enforcement zone is the shared plugin-sdk layer and obvious dialog/action files, not the entire app.
  Evidence: the selected enforced files could be fully converted without exceptions, while broader product areas still mix row/button semantics.

## Decision Log
- Decision: enforce `Button` only for explicit action-button surfaces first.
  Rationale: a blanket raw `<button>` ban would incorrectly target structural click targets and worsen the codebase instead of improving consistency.
  Date/Author: 2026-03-27 / Codex

## Outcomes & Retrospective
The first button-contract pass shipped. Shared plugin-sdk action surfaces and a small set of plugin/settings dialog files now use `@radarboard/ui/button`, and `scripts/check-button-contract.ts` guards those files against regression.

This started narrower than the modal and form-control contracts so the migration could be done safely. After the obvious action surfaces were migrated, the contract was strengthened into a repo-wide scan across product code with an explicit exception table for the remaining structural and legacy surfaces. That turns the previous migration work into an actual guardrail instead of a best-effort cleanup while preserving room to reduce the exception list incrementally.

The latest expansions also reached into `packages/assistant-ui`, `packages/widget-engine`, widgets, and several plugin detail/overlay surfaces where the buttons are still plainly action-oriented rather than structural wrappers. The remaining raw-button tail is now tracked as explicit exceptions instead of being left invisible.

## Context and Orientation
Radarboard’s shared button primitive lives in `packages/ui/src/button/index.tsx`. It already supports the variants needed for this pass: standard CTA, outline, ghost, icon, active, and secondary. The problem was not missing capability; it was that shared/action surfaces were still hand-rolling buttons with local utility classes.

The selected enforcement files are high-confidence action surfaces where raw buttons represent real CTAs, cancel actions, context-menu commands, or icon actions, not structural wrappers.

## Plan of Work
First, migrate the selected files to `@radarboard/ui/button`. Preserve their behavior, labels, icon usage, and semantics while mapping each raw button to the nearest shared variant.

Second, add a contract script that scans product code for raw `<button>` usage outside an explicit exception table. Wire it into local hooks and pre-push checks so button consistency is enforced by default while the remaining structural/legacy surfaces are migrated over time.

## Concrete Steps
1. Working directory: `/Users/thedaviddias/Projects/radarboard`
   Command: `pnpm check:button-contract`
   Expected: the scoped button contract passes with no raw `<button>` in the enforced files.

2. Working directory: `/Users/thedaviddias/Projects/radarboard`
   Command: `pnpm biome check packages/plugin-sdk/src/components/form-dialog.tsx packages/plugin-sdk/src/components/plugin-empty.tsx packages/plugin-sdk/src/components/sidebar/sidebar/context-menu.tsx packages/plugin-sdk/src/components/filter-bar.tsx packages/plugin-sdk/src/components/list-header.tsx packages/plugin-sdk/src/components/detail-shell.tsx plugins/notes/src/components/template-manager.tsx plugins/expenses/src/components/budget-editor.tsx plugins/changelog/src/components/changelog-overlay/changelog-actions-dialog.tsx apps/app/components/settings/extension-installer.tsx scripts/check-button-contract.ts`
   Expected: formatting and lint pass.

3. Working directory: `/Users/thedaviddias/Projects/radarboard`
   Command: `pnpm --filter @radarboard/plugin-sdk typecheck && pnpm --filter @radarboard/plugin-notes typecheck && pnpm --filter @radarboard/plugin-expenses typecheck && pnpm --filter @radarboard/plugin-changelog typecheck && pnpm --filter @radarboard/app typecheck`
   Expected: all touched packages typecheck successfully.

## Validation and Acceptance
Automated acceptance:
- `pnpm check:button-contract` succeeds.
- Targeted Biome check succeeds.
- Targeted package/app typecheck succeeds.

Manual acceptance:
- Shared plugin form dialogs, empty states, context menus, list headers, and detail-panel close actions use consistent shared button styling.
- The selected plugin/settings dialogs keep the same behavior but no longer hand-roll CTA and cancel buttons.

## Idempotence and Recovery
This pass is safe to repeat. Re-running the contract script and Biome should only confirm the state. If a migrated button needs bespoke behavior later, the recovery path is to move that file out of the enforced set or add a richer shared button variant rather than reverting to raw `<button>` silently.

## Artifacts and Notes
- Contract script: `scripts/check-button-contract.ts`
- Shared primitive: `packages/ui/src/button/index.tsx`

## Interfaces and Dependencies
Key files:
- `packages/ui/src/button/index.tsx`
- `packages/plugin-sdk/src/components/form-dialog.tsx`
- `packages/plugin-sdk/src/components/plugin-empty.tsx`
- `packages/plugin-sdk/src/components/sidebar/sidebar/context-menu.tsx`
- `packages/plugin-sdk/src/components/filter-bar.tsx`
- `packages/plugin-sdk/src/components/list-header.tsx`
- `packages/plugin-sdk/src/components/detail-shell.tsx`
- `plugins/notes/src/components/template-manager.tsx`
- `plugins/expenses/src/components/budget-editor.tsx`
- `plugins/changelog/src/components/changelog-overlay/changelog-actions-dialog.tsx`
- `apps/app/components/settings/extension-installer.tsx`
- `scripts/check-button-contract.ts`

## Revision Notes
- 2026-03-27: Initial ExecPlan created after implementing the first scoped button-contract pass.
