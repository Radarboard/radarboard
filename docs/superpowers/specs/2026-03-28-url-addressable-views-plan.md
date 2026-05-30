# Enforce URL-Addressable Settings Views And Dialog State

This ExecPlan is maintained according to [PLANS.md](/Users/thedaviddias/Projects/radarboard/PLANS.md).

## Purpose / Big Picture

Radarboard should never show a settings subsection, settings-owned modal, or other app-level overlay state that cannot be represented directly in the URL. After this change, opening a settings page subsection, launching a settings detail dialog, or switching object-level tabs inside those dialogs will always update the URL, and loading that URL again will restore the same visible view.

The working outcome is visible in two ways. First, deep-linking to a settings subsection or dialog should open the exact same surface after a refresh. Second, closing a dialog or leaving a section should clear stale query params so the URL always describes the current visible state instead of dead UI history.

## Scope

In scope:

- convert settings subsection state from local-only state or localStorage-only state to query params,
- make settings-owned dialogs and object-level dialog tabs URL-addressable,
- align assistant settings dialogs that live inside the settings modal with the same URL contract,
- add one shared query-key surface and shared cleanup logic so the contract is consistent,
- add automated coverage for settings deep links and URL sync behavior,
- update at least the dashboard command palette open state so the top-level app overlay contract is not settings-only.

Out of scope:

- redesigning dialog content, settings information architecture, or unrelated widget/plugin workflows,
- replacing route-based project/page navigation with query params,
- making transient tooltip, popover, or dropdown state URL-addressable,
- broad plugin-package overlay migrations that are not launched from the main settings surface unless they are needed to keep the shared contract coherent.

## Progress

- [x] 2026-03-29 01:18Z: Audited current settings URL state, existing deep-link tests, and dialog ownership across `apps/app` and `packages/assistant-ui`.
- [x] 2026-03-29 01:18Z: Confirmed the current contract is mixed: top-level settings section and some detail dialogs already use query params, while settings subsections and many settings dialogs still rely on local component state or localStorage.
- [ ] Add a shared query-key surface and dashboard-level cleanup for settings-owned URL state.
- [ ] Convert settings subsection state in Appearance, Notifications, and Shortcuts to query params.
- [ ] Convert settings-owned dialogs and dialog tabs in Integrations, Plugins, Layouts, Projects, Widgets, and assistant settings to URL-backed state.
- [ ] Convert the dashboard command palette open state to URL-backed state.
- [ ] Add or expand automated tests proving deep-link restore and param cleanup.
- [ ] Update this ExecPlan with shipped outcomes and validation evidence.

## Surprises & Discoveries

- Observation: the dashboard already has a URL-backed controller for the top-level settings modal and some detail views.
  Evidence: `apps/app/components/dashboard/dashboard/index.tsx` already syncs `settings`, `project`, `ai`, `service`, `settingsPlugin`, and `widget-config`.

- Observation: the current repo uses three different persistence styles for settings views.
  Evidence: `settings-integrations`, `settings-widgets`, `settings-projects`, `settings-layouts`, and `settings-plugins` use `nuqs`; `settings-notifications` uses localStorage-backed subsection state; `settings-appearance` and `settings-shortcuts` currently rely on local component state for subsection selection.

- Observation: settings-owned object editors inside dialogs still keep their inner tabs local.
  Evidence: `apps/app/components/settings/settings-integrations/components/detail-modal.tsx` stores `activeTab` in `useState`, and `apps/app/components/settings/settings-plugins/index.tsx` stores the plugin detail modal tab in local state.

- Observation: assistant settings already depend on `nuqs`, so they can join the contract without app-only imports.
  Evidence: `packages/assistant-ui/src/settings/settings-ai.tsx` already uses `useQueryState` for the `ai` section and OAuth banners.

- Observation: package-boundary dialogs outside `apps/app` do not all have direct access to app-local helpers.
  Evidence: settings-owned dialogs live partly in `packages/assistant-ui`, while non-settings plugin dialogs live in plugin packages with no current `nuqs` dependency.

## Decision Log

- Decision: keep the existing flat query-param style instead of introducing one encoded “modal state” blob.
  Rationale: the dashboard already uses readable params like `settings`, `service`, `settingsPlugin`, `layout`, and `widget-config`, and extending that pattern minimizes migration risk and makes shared URLs easier to inspect manually.
  Date/Author: 2026-03-29 / Codex

- Decision: URL state will be the source of truth for settings subsection selection and settings-owned dialog visibility, with optional fallback defaults only when a param is absent.
  Rationale: the user requirement is explicit that visible views must always have a direct URL, which means localStorage-only state cannot remain the sole controller.
  Date/Author: 2026-03-29 / Codex

- Decision: dashboard-level settings close and section-switch handlers must clear stale child params.
  Rationale: a shareable URL contract is broken if closed dialogs or inactive sections leave unrelated params behind.
  Date/Author: 2026-03-29 / Codex

## Outcomes & Retrospective

This section will be updated after implementation completes. The intended shipped result is a restart-safe URL contract for settings subsections, settings-owned dialogs, settings object-editor tabs, assistant settings dialogs, and the dashboard command palette.

## Context and Orientation

The dashboard shell lives in `apps/app/components/dashboard/dashboard/index.tsx`. That file already owns the top-level `?settings=` modal state and a handful of settings-related detail params. The settings modal itself lives in `apps/app/components/settings/settings-modal/index.tsx` and mounts the page components for each settings section.

The current settings subsection surfaces are split across `apps/app/components/settings/settings-appearance/index.tsx`, `apps/app/components/settings/settings-notifications/index.tsx`, and `apps/app/components/settings/settings-shortcuts/index.tsx`. Catalog-style settings pages like `settings-integrations`, `settings-widgets`, and `settings-plugins` already use some query params, but their auxiliary dialogs and inner object-editor tabs are not fully URL-backed yet.

The current settings-owned dialog surfaces include:

- `apps/app/components/settings/settings-integrations/index.tsx` and `components/detail-modal.tsx`
- `apps/app/components/settings/settings-plugins/index.tsx`
- `apps/app/components/settings/settings-widgets/index.tsx`
- `apps/app/components/settings/settings-layouts/index.tsx`
- `apps/app/components/settings/settings-projects/index.tsx` and `project-detail-panel.tsx`
- `packages/assistant-ui/src/settings/settings-ai.tsx`

Existing automated coverage already proves some deep-link behavior in `apps/e2e/tests/settings/service-deep-link.spec.ts` and `apps/e2e/tests/settings/plugin-deep-link.spec.ts`. Those tests should be expanded rather than replaced.

For this plan, “URL-addressable” means all of the following are true:

- the visible subsection or dialog state is represented by query params,
- loading that URL restores the same visible surface,
- switching views updates the URL immediately,
- closing the view clears the relevant params.

## Plan of Work

First, add one shared query-key surface for the settings/view contract and update the dashboard controller in `apps/app/components/dashboard/dashboard/index.tsx` to clear child params consistently when settings closes or the active section changes. This step establishes the canonical param names and prevents each page from inventing its own cleanup behavior.

Next, migrate the remaining settings subsection selectors to URL state. Appearance, Notifications, and Shortcuts should all derive their active subsection from query params, write those params on first render when absent, and snap invalid or hidden selections back to a valid subsection so refreshes and filtered views remain shareable.

Then migrate settings-owned dialogs and object-level dialog tabs. Integrations and Plugins already expose top-level modal IDs in the URL, so they should add URL-backed inner tabs and URL-backed auxiliary dialogs such as the extension installer and webhook relay. Layouts and Projects should move their currently local dialog visibility to query-param-driven state keyed off the already-selected layout or project/page context. Assistant settings should do the same for the skill editor dialog flows because they are mounted inside the same settings modal and already have `nuqs` available.

After that, convert the dashboard command palette to query-backed open state so the contract is not limited to settings alone. Reuse the same close-on-clear behavior as the settings modal so manual URL editing, browser refresh, and user interaction all converge on the same visible state.

Finally, expand automated coverage. Extend the existing deep-link tests for integrations and plugins, add tests for settings subsection params, and add coverage for at least one auxiliary settings dialog and the command palette open-state contract. Validation must prove not only that direct URLs open the expected view, but also that closing or switching views removes stale params.

## Concrete Steps

1. Working directory: `/Users/thedaviddias/Projects/radarboard`
   Command: `rg -n 'useQueryState\\(|readStoredSettings|writeStoredSettings|onOpenChange=' apps/app/components/settings packages/assistant-ui/src/settings apps/app/components/dashboard`
   Expected result: a complete inventory of settings subsection state, current query-backed surfaces, and local-only dialog open state.

2. Working directory: `/Users/thedaviddias/Projects/radarboard`
   Command: edit `apps/app/components/dashboard/dashboard/index.tsx` plus the touched settings components with `apply_patch`
   Expected result: subsection state, dialog visibility, and dialog-tab state all read from and write to query params.

3. Working directory: `/Users/thedaviddias/Projects/radarboard`
   Command: edit `packages/assistant-ui/src/settings/settings-ai.tsx` with `apply_patch`
   Expected result: assistant skill-editor dialog flows become URL-addressable inside the settings modal.

4. Working directory: `/Users/thedaviddias/Projects/radarboard`
   Command: edit `apps/e2e/tests/settings/*.spec.ts` and add any new targeted tests with `apply_patch`
   Expected result: direct-link open, URL mutation on interaction, and param cleanup on close are covered for the migrated settings surfaces.

5. Working directory: `/Users/thedaviddias/Projects/radarboard`
   Command: `pnpm exec biome check apps/app/components/dashboard/dashboard/index.tsx apps/app/components/settings packages/assistant-ui/src/settings apps/e2e/tests/settings`
   Expected result: touched files pass formatting and lint checks.

6. Working directory: `/Users/thedaviddias/Projects/radarboard`
   Command: `pnpm --filter @radarboard/app typecheck`
   Expected result: app typecheck passes or any unrelated existing failures are documented explicitly in this ExecPlan.

7. Working directory: `/Users/thedaviddias/Projects/radarboard`
   Command: `pnpm --filter @radarboard/app exec playwright test apps/e2e/tests/settings/service-deep-link.spec.ts apps/e2e/tests/settings/plugin-deep-link.spec.ts`
   Expected result: existing and expanded settings deep-link tests pass.

## Validation and Acceptance

Automated acceptance:

- Biome passes on all touched dashboard, settings, assistant settings, and settings test files.
- `pnpm --filter @radarboard/app typecheck` passes, or any unrelated existing failures are documented by exact file and error.
- Settings deep-link E2E coverage passes for integrations and plugins after the migration.
- New or expanded tests prove subsection URL sync and parameter cleanup on close.

Manual acceptance:

- Opening `?settings=appearance&appearanceSection=<section>` shows the requested Appearance subsection after a refresh.
- Opening `?settings=notifications&notificationsTab=<tab>` shows that Notifications tab after a refresh.
- Opening a service or plugin detail URL with an inner-tab param restores the same detail tab.
- Closing a settings dialog or leaving a settings section removes irrelevant params instead of leaving dead state in the URL.
- Opening the command palette updates the URL, and closing it clears that param.

## Idempotence and Recovery

The migration is safe to apply incrementally because query-param-backed views can coexist with existing defaults while each surface is converted. Re-running the validation commands should only confirm the contract.

If a specific dialog migration proves too invasive, recover by keeping the old local state only until its URL-backed source of truth is in place, then remove the duplicate state in the same file before moving on. Do not leave a dialog half-controlled by local state and half-controlled by the URL.

If typecheck or E2E failures come from unrelated pre-existing issues, record them in this plan with the exact command output summary and continue isolating the URL-state changes from those failures.

## Artifacts and Notes

Useful existing evidence:

- `apps/e2e/tests/settings/service-deep-link.spec.ts`
- `apps/e2e/tests/settings/plugin-deep-link.spec.ts`
- `apps/app/components/dashboard/dashboard/index.tsx`
- `apps/app/components/settings/settings-integrations/index.tsx`
- `apps/app/components/settings/settings-plugins/index.tsx`
- `packages/assistant-ui/src/settings/settings-ai.tsx`

## Interfaces and Dependencies

Key modules and contracts involved:

- `nuqs` remains the query-state mechanism for app and assistant settings surfaces that already depend on it.
- `apps/app/components/dashboard/dashboard/index.tsx` owns top-level settings open/close behavior and must remain the central cleanup point.
- `apps/app/components/settings/settings-modal/index.tsx` remains the settings shell and should receive only URL-derived section state.
- `packages/assistant-ui/src/settings/settings-ai.tsx` must stay compatible with the settings modal while exposing URL-backed skill editor dialogs.
- Existing direct-link tests under `apps/e2e/tests/settings/` are the baseline acceptance harness for the new contract.

## Revision Notes

- 2026-03-29: Initial ExecPlan created for the URL-addressable settings and dialog-state migration.
