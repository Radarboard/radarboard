# Enforce Shared Form Control Contract

This ExecPlan is maintained according to [PLANS.md](/Users/thedaviddias/Projects/radarboard/PLANS.md).

## Purpose / Big Picture
Radarboard should stop drifting on basic form controls the same way it drifted on modal shells. After this change, the first enforcement pass will route scoped product forms through shared `Input`, `Textarea`, `Select`, and `Label` primitives instead of feature-local raw tags. The result should be visibly consistent fields in settings and shared plugin forms, with a repository check that rejects new raw form controls in the enforced surface area.

The observable outcome is twofold. First, settings and shared package forms render through one consistent set of UI primitives. Second, local hooks and CI reject new raw `input`, `textarea`, `select`, and `label` usage in the enforced scope unless the file is explicitly exempted for a justified case such as a hidden color or checkbox control.

## Scope
In scope:
- Add any missing shared form primitives needed to replace remaining raw controls in the first enforcement area.
- Migrate scoped raw form controls in `apps/app/components/settings/**` and `packages/plugin-sdk/src/**`.
- Add a form-control contract script and hook wiring.

Out of scope:
- A blanket ban on all raw `<button>` usage.
- Migrating every raw control in plugins, widgets, and editor-like surfaces in one pass.
- Reworking server-rendered HTML inputs under `apps/app/app/api/**`.

## Progress
- [x] 2026-03-27 19:58Z: Audited remaining raw control usage and identified form controls as the next high-value enforcement target after dialogs.
- [x] 2026-03-27 20:05Z: Created this ExecPlan and narrowed the first enforcement scope to settings and shared plugin form surfaces.
- [x] 2026-03-27 20:19Z: Added shared native select support and updated shared plugin-sdk form helpers to use UI primitives.
- [x] 2026-03-27 20:23Z: Migrated the remaining scoped raw settings controls that were not intentional hidden color/checkbox affordances.
- [x] 2026-03-27 20:31Z: Added `check-form-controls-contract` and verified the scoped contract with contract, Biome, and targeted typecheck runs.
- [x] 2026-03-27 20:52Z: Expanded the enforced surface into selected plugin and widget form files (notes, tasks, expenses, changelog, rss-reader, embeddings, widget picker, and ASO store selector) and re-verified the widened contract.
- [x] 2026-03-27 21:05Z: Expanded the enforced surface again into task kanban, expense tag/budget editors, notes template manager, widget log filters, and assistant chat search.
- [x] 2026-03-27 21:18Z: Expanded the enforced surface into subtask entry, expense list sorting, and widget-engine filter/search controls.
- [x] 2026-03-27 21:24Z: Folded the assistant chat composer file-picker path into the contract as an explicit exception, leaving no normal raw form controls in the audited product surfaces.

## Surprises & Discoveries
- Observation: raw form controls are concentrated in plugin editors and a smaller number of settings files, while shared UI usage is already high for `Input`, `Textarea`, `Select`, and `Label`.
  Evidence: `rg '<(input|textarea|select|label)\\b' ...` and `rg 'from "@radarboard/ui/(input|textarea|select|label)"' ...`.
- Observation: some remaining settings raw controls are intentional hidden `color` or `checkbox` inputs wrapped by labels for picker/toggle affordances.
  Evidence: `apps/app/components/settings/settings-projects/project-list-panel.tsx`, `apps/app/components/settings/settings-projects/project-detail-panel.tsx`, and `apps/app/components/settings/settings-integrations/components/service-card.tsx`.

## Decision Log
- Decision: enforce shared form controls before tackling buttons.
  Rationale: the form-control drift is lower-volume, more mechanical, and already close to standardized, while raw buttons still mix true action buttons with structural row and icon triggers.
  Date/Author: 2026-03-27 / Codex
- Decision: the first enforcement pass will target `apps/app/components/settings/**` and `packages/plugin-sdk/src/**`, with explicit exceptions for justified hidden color/checkbox controls.
  Rationale: this captures the most user-visible form drift without turning plugin and widget editors into a monolithic migration.
  Date/Author: 2026-03-27 / Codex

## Outcomes & Retrospective
The first enforced form-controls pass shipped and then expanded into a second ring of product forms. Shared plugin form helpers now render through `@radarboard/ui` primitives, the scoped settings/forms surface no longer uses raw text inputs for normal cases, and selected plugin/widget form files were migrated to the same shared primitives. New raw `input`, `textarea`, `select`, and `label` tags inside the enforced scope are blocked by `scripts/check-form-controls-contract.ts`.

The next rings now also include `plugins/tasks/src/components/task-kanban.tsx`, `plugins/tasks/src/components/subtask-list.tsx`, `plugins/expenses/src/components/tag-input.tsx`, `plugins/expenses/src/components/budget-editor.tsx`, `plugins/expenses/src/components/expense-list.tsx`, `plugins/notes/src/components/template-manager.tsx`, `widgets/logs/src/components/log-filters/index.tsx`, `packages/assistant-ui/src/chat/chat-search.tsx`, and the widget-engine filter/search surfaces in `packages/widget-engine/src/templates/sections/filter-bar-section/index.tsx`, `packages/widget-engine/src/templates/sections/stream-list-section/index.tsx`, and `packages/widget-engine/src/templates/sections/card-list-section/index.tsx`.

The only intentional raw-control exception in the broadened product surface is the hidden file input inside `packages/assistant-ui/src/chat/chat-composer.tsx`, which remains raw because file selection should stay browser-native.

The intentional exceptions are limited to the hidden browser-native affordances that still make sense as raw controls in settings: color inputs and checkbox-backed selection cards. Buttons were intentionally left out of this enforcement pass because they need a narrower action-versus-structure contract.

## Context and Orientation
Radarboard already has shared UI primitives in `packages/ui/src/input/index.tsx`, `packages/ui/src/textarea/index.tsx`, `packages/ui/src/label/index.tsx`, and `packages/ui/src/select/index.tsx`. Despite that, several settings and shared plugin form surfaces still render raw `input`, `textarea`, `select`, and `label` tags with local styling. This is especially visible in plugin shared form helpers and a few settings-side forms.

Shared plugin form helpers live in `packages/plugin-sdk/src/components/form-dialog.tsx`, `packages/plugin-sdk/src/components/plugin-search.tsx`, and `packages/plugin-sdk/src/components/sidebar/sidebar/inline-input.tsx`. The first enforcement scope inside the app is `apps/app/components/settings/**`, where most forms already use shared primitives but a few files still bypass them.

## Plan of Work
First, extend or add any shared primitive missing for simple native select usage in the UI package. Then update the shared plugin-sdk helpers to render through the shared UI primitives instead of raw tags.

Second, migrate the remaining scoped settings-side raw controls to the same primitives, leaving only justified exceptions such as hidden color and checkbox inputs that are acting as browser-native affordances.

Third, add a scoped repository check for raw form controls. Wire that check into hooks and CI so new raw form controls in the enforced surface are blocked unless they are in the explicit exception list.

## Concrete Steps
1. Working directory: `/Users/thedaviddias/Projects/radarboard`
   Command: `rg -n --glob '!**/node_modules/**' --glob '!**/*.test.*' --glob '!**/*.stories.*' --glob '!**/*.scaffold.*' '<(input|textarea|select|label)\\b' apps/app/components/settings packages/plugin-sdk/src`
   Expected: a short, reviewable set of remaining raw form controls in the scoped enforcement area.

2. Working directory: `/Users/thedaviddias/Projects/radarboard`
   Command: `pnpm exec tsx scripts/check-form-controls-contract.ts`
   Expected after implementation: the scoped contract passes with only explicit exceptions.

3. Working directory: `/Users/thedaviddias/Projects/radarboard`
   Command: `pnpm biome check apps/app/components/settings packages/plugin-sdk/src packages/ui/src`
   Expected: touched settings, plugin-sdk, and UI primitive files pass formatting and lint.

## Validation and Acceptance
Automated acceptance:
- `pnpm exec tsx scripts/check-form-controls-contract.ts` succeeds.
- `pnpm biome check ...` succeeds for touched files.

Manual acceptance:
- Shared plugin search and form fields look visually aligned with the app’s existing shared inputs.
- Settings surfaces in the scoped migration use the same shared input, textarea, select, and label styling instead of one-off field chrome.
- Hidden color and checkbox affordances that remain exempt continue to work as before.

## Idempotence and Recovery
The migration is safe to repeat. Re-running the contract script should only confirm the current state. If a raw control conversion causes regressions, the recovery path is to switch that file back temporarily and add it to the explicit exception list until a shared primitive variant exists.

## Artifacts and Notes
- Initial scoped audit command:
  - `rg -n --glob '!**/node_modules/**' --glob '!**/*.test.*' --glob '!**/*.stories.*' --glob '!**/*.scaffold.*' '<(input|textarea|select|label)\\b' apps/app/components/settings packages/plugin-sdk/src`

## Interfaces and Dependencies
Key files:
- `packages/ui/src/input/index.tsx`
- `packages/ui/src/textarea/index.tsx`
- `packages/ui/src/label/index.tsx`
- `packages/ui/src/select/index.tsx`
- `packages/plugin-sdk/src/components/form-dialog.tsx`
- `scripts/check-form-controls-contract.ts`

The end-state contract is simple: scoped product forms should use shared UI form primitives, and the enforcement script should define the narrow exception list for raw controls that are intentionally browser-native affordances.

## Revision Notes
- 2026-03-27: Initial ExecPlan created for the first enforced form-control contract pass.
- 2026-03-27: Updated after implementation to record the shipped primitive changes, scoped exceptions, and successful verification.
