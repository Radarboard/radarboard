# Enforce Interactive Tooltip Contract

This ExecPlan is maintained according to [PLANS.md](/Users/thedaviddias/Projects/radarboard/PLANS.md).

## Purpose / Big Picture
Radarboard should stop relying on native browser `title` bubbles for interactive controls and instead use the shared `@radarboard/ui/tooltip` primitives everywhere that users hover or focus an actionable control. After this pass, icon actions, truncated tab buttons, segmented dialog controls, select triggers, and other audited interactive handles will show the same fast shadcn/Radix tooltip treatment instead of the slower browser tooltip.

The maintainer-visible outcome is a new tooltip contract check that fails when interactive controls regress back to native `title` attributes. The user-visible outcome is consistent hover and keyboard-focus affordances across shared UI, widget-engine chrome, settings, assistant surfaces, and audited plugin actions.

## Scope
In scope:
- Interactive controls that still use native `title`, including literal `<button>`/`<Button>` elements, shared select-style triggers, and native interactive handles.
- Shared/high-leverage surfaces in `packages/ui`, `packages/widget-engine`, and settings helpers where one fix removes multiple downstream occurrences.
- Audited feature-local button surfaces in app, assistant UI, and plugins that still attach `title` to actionable controls.
- A dedicated `check:tooltip-contract` script that guards this rule separately from the existing raw-button contract.

Out of scope:
- Passive, non-interactive `title` usage on charts, table cells, status dots, and similar read-only affordances.
- Copy rewrites for tooltip text. Existing `title` strings should move over as-is unless a component already has better tooltip copy.
- Refactoring all tooltip usage into a new monolithic primitive. Existing tooltip primitives and local wrappers are sufficient.

## Progress
- [x] 2026-03-28 01:26Z: Audited current `title` usage and separated interactive controls from passive hover labels.
- [x] 2026-03-28 01:58Z: Migrated shared UI and widget-engine controls to tooltip primitives, including local providers for shared/tested surfaces.
- [x] 2026-03-28 02:02Z: Migrated app, assistant-ui, and plugin action controls away from native `title`.
- [x] 2026-03-28 02:06Z: Added `scripts/check-tooltip-contract.ts` and wired `pnpm check:tooltip-contract`.
- [x] 2026-03-28 02:17Z: Verified tooltip contract, existing button contract, targeted Biome checks, targeted workspace typechecks, and `packages/widget-engine` tests.

## Surprises & Discoveries
- Observation: the remaining native `title` usage is concentrated in a finite set of interactive surfaces rather than spread randomly across the repo.
  Evidence: the audit isolated a stable list of shared controls and action buttons, plus one native resize handle and a small number of select triggers.
- Observation: a few local wrappers already use tooltips correctly but still name the prop `title`, which makes future regressions more likely.
  Evidence: `MiniTrackButton` in `apps/app/components/settings/settings-layouts/layout-detail-panel.tsx` renders `TooltipContent` already, while `ToolbarButton` in `packages/ui/src/rich-text-composer/index.tsx` still forwards native `title`.
- Observation: `packages/widget-engine/src/chrome/top-bar.tsx` is a legacy story-only duplicate of the exported `packages/widget-engine/src/chrome/top-bar/index.tsx`, but it still needs to stay contract-compliant unless removed.
  Evidence: package exports point at `./src/chrome/top-bar/index.tsx`, while older scaffold stories still import `./top-bar`.
- Observation: shared tooltip usage in exported package components must be self-contained for tests and Storybook.
  Evidence: `packages/widget-engine` tests failed with `Tooltip must be used within TooltipProvider` until local `TooltipProvider` wrappers were added around shared components that now render tooltips.

## Decision Log
- Decision: keep the base `Button` primitive unchanged and migrate call sites with explicit tooltip composition or existing local wrappers.
  Rationale: adding a tooltip prop to `Button` would bloat a low-level primitive and still would not solve non-button controls like `SelectTrigger` or resize handles.
  Date/Author: 2026-03-28 / Codex
- Decision: create a dedicated tooltip contract check instead of extending `check-button-contract`.
  Rationale: the raw-button rule and the native-title rule guard different behaviors and need different scan logic.
  Date/Author: 2026-03-28 / Codex

## Outcomes & Retrospective
Interactive controls in the audited shared surfaces and leaf action files no longer rely on native browser `title` bubbles. Shared UI, widget-engine chrome, settings helpers, assistant thread titles, and the audited plugin action buttons now render through `@radarboard/ui/tooltip`.

The repo now has a dedicated `check:tooltip-contract` guardrail in addition to the older raw-button contract. During implementation, the only regression discovered by verification was that shared exported components needed their own `TooltipProvider` to stay testable outside the app shell; that follow-up was applied and `packages/widget-engine` tests are now green again.

## Context and Orientation
Radarboard’s tooltip primitives live in `packages/ui/src/tooltip/index.tsx`. The app shell already provides `TooltipProvider` in `apps/app/app/layout.tsx`, and many current surfaces already compose `Tooltip`, `TooltipTrigger`, and `TooltipContent` directly. The problem is that a remaining set of interactive controls still uses native browser `title` attributes.

The highest-leverage shared surfaces are:
- `packages/ui/src/app-dialog/index.tsx` for dialog size toggles.
- `packages/ui/src/rich-text-composer/index.tsx` for toolbar buttons.
- `packages/widget-engine/src/chrome/top-bar/index.tsx`, `packages/widget-engine/src/chrome/page-tabs/index.tsx`, and `packages/widget-engine/src/chrome/project-tabs/index.tsx` for dashboard chrome.
- `apps/app/components/settings/settings-list-panel/index.tsx` and `apps/app/components/settings/projects/context-editor/index.tsx` for reusable settings helpers.
- `packages/widget-engine/src/components/widget-table/index.tsx` for the interactive column resize handle.

The audited leaf surfaces still using native `title` on interactive controls are:
- `apps/app/components/settings/settings-layouts/layout-detail-panel.tsx`
- `apps/app/components/settings/settings-mcp-servers/server-list-panel.tsx`
- `apps/app/components/settings/settings-project-widgets/index.tsx`
- `apps/app/components/widgets/github-repo-multi-picker/index.tsx`
- `packages/assistant-ui/src/chat/chat-sidebar.tsx`
- `plugins/bookmarks/src/components/bookmarks-overlay.tsx`
- `plugins/changelog/src/components/changelog-overlay/changelog-sidebar.tsx`
- `plugins/changelog/src/components/changelog-overlay/release-list-item.tsx`
- `plugins/expenses/src/components/expense-sidebar.tsx`
- `plugins/notes/src/components/note-editor.tsx`
- `plugins/notes/src/components/template-manager.tsx`
- `plugins/tasks/src/components/task-list.tsx`

## Plan of Work
First, migrate the shared surfaces that fan out across the product. `DialogSizeToggle`, the rich-text toolbar, widget-engine chrome, and settings helpers should all stop attaching `title` directly to actionable controls. Where a control is already button-like, wrap the existing trigger in `Tooltip` composition. Where a local wrapper already exists, change its API from `title` to `tooltip` so future regressions become a type error in that file instead of a silent browser fallback.

Second, migrate the remaining leaf action controls in app, assistant UI, and plugin overlays. Preserve their current click behavior, stop-propagation behavior, `aria-label`s, and visual styling. For truncated text buttons like project/page tabs and chat thread titles, keep the visible label unchanged and use the tooltip as the full-text hover/focus affordance that replaces the native title bubble.

Third, add `scripts/check-tooltip-contract.ts`. The script should scan product code for interactive controls that still use native `title` and fail with clear remediation text. It should cover literal `<button>`/`<Button>`, shared trigger components like `SelectTrigger`, and native HTML elements that are interactive because they carry click/pointer/resize/button-like handlers or roles.

Finally, run targeted checks, record what passed, and update this plan’s progress and outcomes.

## Concrete Steps
1. Working directory: `/Users/thedaviddias/Projects/radarboard`
   Command: `pnpm exec tsx scripts/check-tooltip-contract.ts`
   Expected: once the script exists and the migration is complete, it prints a success message and no violating paths.

2. Working directory: `/Users/thedaviddias/Projects/radarboard`
   Command: `pnpm check:button-contract`
   Expected: the existing raw-button contract still passes after the tooltip work.

3. Working directory: `/Users/thedaviddias/Projects/radarboard`
   Command: `pnpm biome check packages/ui/src/app-dialog/index.tsx packages/ui/src/rich-text-composer/index.tsx packages/widget-engine/src/chrome/top-bar/index.tsx packages/widget-engine/src/chrome/top-bar.tsx packages/widget-engine/src/chrome/page-tabs/index.tsx packages/widget-engine/src/chrome/project-tabs/index.tsx packages/widget-engine/src/components/widget-table/index.tsx apps/app/components/settings/settings-list-panel/index.tsx apps/app/components/settings/projects/context-editor/index.tsx apps/app/components/settings/settings-layouts/layout-detail-panel.tsx apps/app/components/settings/settings-mcp-servers/server-list-panel.tsx apps/app/components/settings/settings-project-widgets/index.tsx apps/app/components/widgets/github-repo-multi-picker/index.tsx packages/assistant-ui/src/chat/chat-sidebar.tsx plugins/bookmarks/src/components/bookmarks-overlay.tsx plugins/changelog/src/components/changelog-overlay/changelog-sidebar.tsx plugins/changelog/src/components/changelog-overlay/release-list-item.tsx plugins/expenses/src/components/expense-sidebar.tsx plugins/notes/src/components/note-editor.tsx plugins/notes/src/components/template-manager.tsx plugins/tasks/src/components/task-list.tsx scripts/check-tooltip-contract.ts`
   Expected: formatting and lint pass on touched files.

4. Working directory: `/Users/thedaviddias/Projects/radarboard`
   Command: `pnpm typecheck`
   Expected: all touched workspaces typecheck cleanly.

## Validation and Acceptance
Automated acceptance:
- `pnpm check:tooltip-contract` succeeds.
- `pnpm check:button-contract` succeeds.
- Targeted Biome check succeeds.
- `pnpm typecheck` succeeds.
- `packages/widget-engine` tests succeed.

Manual acceptance:
- Hovering or keyboard-focusing migrated controls shows the shared tooltip UI instead of a native browser `title` bubble.
- This is visibly correct for dialog size toggles, the rich-text toolbar, dashboard page/project tabs, settings add/remove controls, chat thread buttons, plugin action buttons, and the widget-table resize handle.
- Existing `aria-label`s and click behaviors remain unchanged.

## Idempotence and Recovery
The migration is safe to repeat. Re-running the contract scripts, Biome, and typecheck should only confirm the state. If a specific control needs bespoke hover copy later, update the tooltip content in that component or wrapper rather than reintroducing native `title`.

If a migration step causes a tooltip placement problem, the recovery path is to keep the tooltip wrapper and adjust `TooltipContent` side/offset classes locally. Do not back out to native `title`.

## Artifacts and Notes
- Contract script to add: `scripts/check-tooltip-contract.ts`
- Existing tooltip primitives: `packages/ui/src/tooltip/index.tsx`
- Existing related contract: `scripts/check-button-contract.ts`
- Verification completed:
  - `pnpm check:tooltip-contract`
  - `pnpm check:button-contract`
  - `pnpm biome check packages/ui/src/app-dialog/index.tsx packages/ui/src/rich-text-composer/index.tsx packages/widget-engine/src/chrome/page-tabs/index.tsx packages/widget-engine/src/chrome/project-tabs/index.tsx packages/widget-engine/src/chrome/top-bar/index.tsx packages/widget-engine/src/chrome/top-bar.tsx packages/widget-engine/src/components/widget-table/index.tsx apps/app/components/settings/settings-list-panel/index.tsx apps/app/components/settings/projects/context-editor/index.tsx apps/app/components/settings/settings-layouts/layout-detail-panel.tsx apps/app/components/settings/settings-mcp-servers/server-list-panel.tsx apps/app/components/settings/settings-project-widgets/index.tsx apps/app/components/widgets/github-repo-multi-picker/index.tsx packages/assistant-ui/src/chat/chat-sidebar.tsx plugins/bookmarks/src/components/bookmarks-overlay.tsx plugins/changelog/src/components/changelog-overlay/changelog-sidebar.tsx plugins/changelog/src/components/changelog-overlay/release-list-item.tsx plugins/expenses/src/components/expense-sidebar.tsx plugins/notes/src/components/note-editor.tsx plugins/notes/src/components/template-manager.tsx plugins/tasks/src/components/task-list.tsx scripts/check-tooltip-contract.ts docs/superpowers/specs/2026-03-27-interactive-tooltip-contract-plan.md package.json`
  - `pnpm typecheck` in `packages/ui`, `packages/widget-engine`, `packages/assistant-ui`, `apps/app`, `plugins/bookmarks`, `plugins/changelog`, `plugins/expenses`, `plugins/notes`, and `plugins/tasks`
  - `pnpm test` in `packages/widget-engine`

## Interfaces and Dependencies
Libraries and internal modules involved:
- `@radarboard/ui/tooltip`
- `@radarboard/ui/button`
- `@radarboard/ui/select`
- `@radarboard/widget-engine`
- `packages/ui`, `packages/assistant-ui`, `apps/app`, and the affected plugin packages

Interface expectations after completion:
- Interactive controls no longer rely on native `title` for hover/focus messaging.
- Local wrappers that mean “tooltip text” should expose that intent explicitly instead of forwarding `title`.
- A repo-level tooltip contract exists and is runnable from the root with `pnpm check:tooltip-contract`.
