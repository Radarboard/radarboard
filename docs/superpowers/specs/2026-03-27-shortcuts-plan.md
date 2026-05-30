# Unified Shortcuts Settings And Runtime

This ExecPlan is maintained according to [PLANS.md](/Users/thedaviddias/Projects/radarboard/PLANS.md).

## Purpose / Big Picture

Radarboard should expose one dedicated `Shortcuts` settings page that manages core app shortcuts and plugin shortcuts from a single place, while still separating them clearly in the UI. After this change, users should be able to open Settings, navigate to `Shortcuts`, inspect all bindings, edit a single binding per action, see conflicts immediately, and understand whether a binding works on the web, in focused Tauri windows, or as a desktop-global shortcut where Tauri supports it.

The change must also consolidate the existing shortcut implementation. Today, core app shortcuts are hardcoded across multiple UI components, while plugin shortcuts live in plugin config state. After the work is complete, shortcut definitions should come from one shared registry and all focused-window shortcut handling should continue to use `@tanstack/react-hotkeys`. Desktop-global shortcuts should be layered on top only in Tauri, with explicit capability-aware fallback when global registration is unavailable or fails.

## Scope

In scope:

- Add a new `Shortcuts` section to Settings.
- Build a unified shortcuts settings UI with `All`, `App`, and `Plugins` views.
- Create a shared shortcut registry for app actions and plugin actions.
- Persist user shortcut bindings in settings storage and expose them through the existing settings API.
- Replace hardcoded app shortcut strings with registry-backed values.
- Continue using `@tanstack/react-hotkeys` for web and focused-window shortcuts.
- Add a Tauri desktop shortcut bridge that can register global OS shortcuts when possible.
- Show platform-aware shortcut labels and per-row desktop/global capability state.
- Remove inline plugin shortcut editing from the Plugins settings page and replace it with a pointer back to the Shortcuts page.

Out of scope:

- Multiple shortcuts per action.
- Chorded shortcuts such as `Ctrl+K Ctrl+S`.
- A separate desktop-only shortcuts page or a separate plugin-only settings page.
- Reworking assistant-internal shortcuts in `packages/assistant-ui` beyond integrating them into the shared registry when they are exposed as app actions.

## Progress

- [x] 2026-03-27 23:31Z: Audited current shortcut usage, settings page patterns, and repository planning requirements.
- [x] 2026-03-27 23:52Z: Added shared shortcut types, app shortcut registry, and persistence under `widgetLayout.preferences.shortcuts`.
- [x] 2026-03-27 23:55Z: Added `Settings > Shortcuts` with `All`, `App`, and `Plugins` views plus recorder/conflict UI.
- [x] 2026-03-27 23:57Z: Migrated top-bar, notifications, dashboard, and command palette shortcut display/binding paths to the shared registry.
- [x] 2026-03-27 23:58Z: Added a Tauri global shortcut bridge using the existing `global-shortcut` plugin API and custom runtime dispatch.
- [x] 2026-03-27 23:59Z: Added registry tests and reran focused verification (`tsc`, `biome`, `vitest`).

## Surprises & Discoveries

- Observation: Core app shortcuts are currently hardcoded in multiple places, including dashboard shell, notifications, top bar tooltip copy, and plugin launcher.
  Evidence: `apps/app/components/dashboard/dashboard/index.tsx`, `apps/app/components/notifications/notification-center/index.tsx`, and `apps/app/components/plugins/plugin-launcher/index.tsx` each define their own strings or bindings.

- Observation: Plugin shortcuts already have editable config in the Plugins settings page, but app shortcuts do not share that storage path.
  Evidence: `apps/app/components/settings/settings-plugins/index.tsx` renders a plugin shortcut input backed by `PluginUserConfig.shortcut`.

- Observation: The existing settings API already persists `widgetLayout` preferences and other user settings, making it the cleanest place to store unified shortcut state without adding a new dedicated settings repository surface first.
  Evidence: `apps/app/app/api/settings/route.ts` already reads and writes `widgetLayout` via `repo.getWidgetLayout()` / `repo.setWidgetLayout()`.

- Observation: First-party plugin defaults already collided with proposed core app shortcuts (`Notes` vs Notifications, `Expenses` vs Edit).
  Evidence: `plugins/notes/src/index.ts` and `plugins/expenses/src/index.ts` both used the same `Mod+Shift+<key>` combinations as new core actions.

- Observation: Tauri global shortcut registration did not require new Rust commands because the existing desktop capability set already exposed the plugin’s runtime register/unregister API to the frontend.
  Evidence: `apps/desktop/src-tauri/capabilities/default.json` includes `global-shortcut:default`, and the crate’s guest JS exposes `plugin:global-shortcut|register` / `unregister_all`.

## Decision Log

- Decision: Use a single `Shortcuts` settings page with `All`, `App`, and `Plugins` filters instead of separate pages.
  Rationale: This follows the user’s requested unified model while still separating app and plugin actions in a familiar way.
  Date/Author: 2026-03-27 / Codex

- Decision: Keep `Desktop` as inline row metadata or toggles rather than a primary top-level filter.
  Rationale: Desktop/global support is a capability, not a content category. This matches how users reason about actions and avoids duplicate views.
  Date/Author: 2026-03-27 / Codex

- Decision: Support exactly one shortcut per action, with immediate conflict feedback and prevention of unresolved duplicates from applying.
  Rationale: This matches the user requirement and typical editor/app behavior.
  Date/Author: 2026-03-27 / Codex

- Decision: Use one shared binding by default across web and desktop, with optional desktop-global enablement where Tauri supports it.
  Rationale: Shared bindings preserve muscle memory. Desktop-global behavior should be additive, not a parallel shortcut system.
  Date/Author: 2026-03-27 / Codex

- Decision: Keep plugin shortcut persistence in plugin user config and aggregate it into the unified page instead of migrating plugin shortcut storage into the settings repository.
  Rationale: This preserves existing plugin config semantics and avoids a risky persistence migration in the first pass.
  Date/Author: 2026-03-27 / Codex

- Decision: Change first-party plugin defaults to remove built-in conflicts with core app actions.
  Rationale: A unified shortcut system should not boot into an immediate conflict state for first-party defaults.
  Date/Author: 2026-03-27 / Codex

## Outcomes & Retrospective

Radarboard now has a dedicated `Shortcuts` settings section. Core app actions and plugin launch shortcuts are shown in one page with `All`, `App`, and `Plugins` filters, immediate recorder-based editing, inline desktop-global toggles, and conflict prevention at write time. App shortcut overrides persist in `widgetLayout.preferences.shortcuts`, while plugin shortcut overrides continue to persist in plugin config and are aggregated into the unified UI.

Focused-window shortcut registration now flows through the shared registry and runtime bridge instead of scattered hardcoded handlers. The desktop-global path uses the existing Tauri global shortcut plugin from the frontend, so no new Rust command API was required in this pass. First-party plugin defaults were adjusted to remove immediate collisions with new core app defaults.

Remaining gap: this implementation has compile-time and focused automated verification, but it still needs manual desktop exercise inside the Tauri shell to confirm global registration behavior and window-focus interactions end to end.

## Context and Orientation

Radarboard’s dashboard shell lives in `apps/app/components/dashboard/dashboard/index.tsx`. That file currently binds core app shortcuts using `@tanstack/react-hotkeys`, including chat toggle and edit toggle, and it also registers plugin shortcuts through TanStack’s hotkey manager. The top bar component at `packages/widget-engine/src/chrome/top-bar/index.tsx` renders action buttons and currently formats shortcut text for tooltips. Notifications have their own trigger in `apps/app/components/notifications/notification-center/index.tsx`, where a new shortcut was recently added directly in that component.

Settings UI patterns live under `apps/app/components/settings/`. The canonical page wrapper is `apps/app/components/settings/settings-page-layout/index.tsx`. Settings section navigation is defined in `apps/app/components/settings/settings-sidebar/index.tsx` and rendered through `apps/app/components/settings/settings-modal/index.tsx`. Plugin-specific shortcut editing currently lives inside `apps/app/components/settings/settings-plugins/index.tsx`.

User settings are loaded through `apps/app/app/api/settings/route.ts`, stored in `apps/app/hooks/settings-store.ts`, and persisted through repository implementations such as `apps/app/db/sqlite-settings.ts`, `apps/app/db/turso-settings.ts`, `apps/app/db/supabase-settings.ts`, and `apps/app/db/planetscale-settings.ts`. `packages/types/src/database.ts` defines the persisted shape of dashboard/widget preferences. Plugin-specific user config is separate and exposed through plugin config hooks and types in `packages/plugin-sdk/src/types.ts`.

The app shell already provides `HotkeysProvider` via `apps/app/app/providers.tsx`, and the repository standard requires `@tanstack/react-hotkeys` for shortcut handling. Tauri runtime detection lives in `apps/app/lib/platform.ts`. The app already talks to Tauri-specific plugins for notifications, updater, tray sync, and process APIs, but there is currently no desktop-global shortcut bridge.

## Plan of Work

First, extend the persisted settings model so there is an explicit place for app shortcut bindings and desktop-global preferences without overloading plugin config. The likely shape is a new shortcut config nested under `widgetLayout.preferences` or another existing persisted settings branch already round-tripped through the settings API and repositories. This step also requires a shared registry module that defines every editable app action with stable IDs, default bindings, scope metadata, labels, and whether desktop-global registration is allowed.

Second, replace the current hardcoded app shortcut strings with registry-backed values. `apps/app/components/dashboard/dashboard/index.tsx` should stop embedding shortcut literals for search, assistant, edit, and notifications. `apps/app/components/notifications/notification-center/index.tsx` and `packages/widget-engine/src/chrome/top-bar/index.tsx` should consume the same registry-backed values for bindings and tooltip labels. Plugin launcher formatting should also reuse the shared shortcut label formatter instead of carrying its own copy.

Third, add a new `Shortcuts` settings section using the standard settings page layout. The page should show a single searchable list with `All`, `App`, and `Plugins` filters. In the `All` view, rows should still be grouped with app actions first and plugin actions second. Each row should render the action label, current binding, source/category, conflict status, and desktop/global support state. Editing should use a focused recorder interaction and immediate validation, with one binding per action.

Fourth, add a desktop shortcut bridge for Tauri. Focused shortcuts should continue to use TanStack, but the bridge should attempt to register desktop-global bindings for rows where the user has enabled that behavior and the action is declared global-capable. When registration fails or the environment is not Tauri, the UI must show that the action remains focused-window only instead of silently pretending the shortcut is global.

Finally, remove inline editing of plugin shortcuts from `Settings > Plugins` and replace it with a compact summary plus a link or CTA into the unified `Shortcuts` page. That keeps plugin settings lightweight and preserves one source of truth.

## Concrete Steps

1. Working directory: `/Users/thedaviddias/Projects/radarboard`
   Command: inspect `packages/types/src/database.ts`, `apps/app/app/api/settings/route.ts`, and the settings repositories to add persisted shortcut config support.
   Expected result: one explicit shared settings shape for shortcut bindings and desktop-global options.

2. Working directory: `/Users/thedaviddias/Projects/radarboard`
   Command: add a shared registry module for app shortcuts and helper utilities for label formatting, conflict detection, and filtered views.
   Expected result: all editable actions have stable IDs and defaults in one place.

3. Working directory: `/Users/thedaviddias/Projects/radarboard`
   Command: add `Settings > Shortcuts` UI and hook it into the settings sidebar and modal.
   Expected result: a new settings page appears with search and `All/App/Plugins` filters.

4. Working directory: `/Users/thedaviddias/Projects/radarboard`
   Command: migrate current dashboard, top bar, notification, and plugin launcher bindings to the shared registry.
   Expected result: tooltips and actual bindings are driven from the same stored shortcut values.

5. Working directory: `/Users/thedaviddias/Projects/radarboard`
   Command: implement the Tauri global-shortcut bridge and capability-aware row state.
   Expected result: desktop users can enable global behavior for supported actions, while web and unsupported cases degrade cleanly.

6. Working directory: `/Users/thedaviddias/Projects/radarboard`
   Command: run targeted verification commands and manual checks.
   Expected result: focused-window shortcuts still work on web, desktop rows expose global capability state, and settings persist.

## Validation and Acceptance

Automated checks:

- Working directory: `/Users/thedaviddias/Projects/radarboard`
  Command: `pnpm exec tsc -p apps/app/tsconfig.json --noEmit`
  Expected result: completes with exit code 0.

- Working directory: `/Users/thedaviddias/Projects/radarboard`
  Command: `pnpm vitest packages/widget-engine/src/chrome/top-bar/top-bar.test.ts --run`
  Expected result: passes.

- Working directory: `/Users/thedaviddias/Projects/radarboard`
  Command: targeted tests for any new shortcut registry, settings page utilities, or Tauri bridge logic added during implementation.
  Expected result: conflict detection, filtering, and platform capability behavior are covered.

Manual acceptance:

- Open Settings and confirm a `Shortcuts` section exists.
- In `All`, verify `App shortcuts` appear before `Plugin shortcuts`.
- Edit the Search shortcut and confirm the top-bar tooltip and actual keybinding update together.
- Create a conflict and verify the page shows both conflicting rows and prevents unresolved application.
- In web mode, verify shortcuts still work while the app window is focused.
- In Tauri, verify supported rows can opt into global desktop registration and clearly indicate fallback when global registration is unavailable.
- In `Settings > Plugins`, verify plugin shortcut editing has been replaced with a pointer back to `Shortcuts`.

## Idempotence and Recovery

Most code-edit steps are safe to repeat. Re-running the typecheck and lint/test commands is always safe. If the settings shape changes mid-implementation, update the repositories and the API route together before testing; partial updates here will cause silent settings loss or runtime decode failures.

If Tauri global shortcut support proves impossible with the currently installed desktop plugins, keep the registry and settings UI intact, but mark global support as unavailable and do not attempt fake registration. That fallback is acceptable as long as focused-window shortcuts still work and the UI communicates the limitation clearly.

## Artifacts and Notes

- Existing plugin shortcut editing lives in `apps/app/components/settings/settings-plugins/index.tsx`.
- Existing app shortcut bindings live in `apps/app/components/dashboard/dashboard/index.tsx`, `apps/app/components/notifications/notification-center/index.tsx`, and `apps/app/components/plugins/plugin-launcher/index.tsx`.
- The app already uses `HotkeysProvider` in `apps/app/app/providers.tsx`, so no additional provider plumbing should be necessary for focused-window handling.

## Interfaces and Dependencies

- `@tanstack/react-hotkeys` remains the canonical focused-window shortcut system for web and Tauri window focus.
- `packages/plugin-sdk/src/types.ts` currently carries plugin shortcut fields and must remain compatible with the new unified view.
- `packages/types/src/database.ts` will need a persisted shortcut config contract if a new settings branch is introduced.
- `apps/app/app/api/settings/route.ts` and the settings repositories must be updated in lockstep for persistence.
- `apps/app/lib/platform.ts` and future Tauri bridge code will determine whether desktop-global support can be registered at runtime.

## Revision Notes

- 2026-03-27 / Codex: Initial ExecPlan created after shortcut/settings audit and before implementation.
- 2026-03-27 / Codex: Updated progress, discoveries, decisions, and outcomes after the first implementation pass landed.
