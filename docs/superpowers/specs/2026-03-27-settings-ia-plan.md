# Refactor Settings Information Architecture For Reusable Page Patterns

This ExecPlan is maintained according to [PLANS.md](/Users/thedaviddias/Projects/radarboard/PLANS.md).

## Purpose / Big Picture

Radarboard settings should feel internally consistent without forcing every page into the same navigation control. After this work, maintainers should be able to build or update a settings page by choosing one of a small number of reusable page patterns instead of hand-rolling tabs, filters, and list-detail shells.

The visible result is that settings pages fall into predictable shapes:

- catalog pages use a shared top filter/index bar,
- list-detail pages use a shared secondary panel,
- flat settings pages use reusable section indexes or stacked sections instead of ad hoc tab rows.

The maintainability result is that new settings pages can be assembled from shared primitives in `apps/app/components/settings/` rather than duplicating layout and navigation logic.

## Scope

In scope:

- define and implement reusable settings page-pattern primitives,
- migrate the current settings pages to the approved pattern map,
- remove page-level tab usage where it conflicts with discoverability or hierarchy,
- keep object-level modal tabs where they are still the correct interaction,
- update current settings pages only as needed to align with the shared patterns.

Out of scope:

- changing the top-level settings section list in the main sidebar,
- redesigning plugin detail modal internals beyond aligning them with shared object-editor patterns,
- changing unrelated dashboard, widget, or plugin behavior,
- broad copywriting rewrites that do not support the settings IA work.

## Progress

- [x] 2026-03-27 23:39Z: Audited current settings pages and grouped them into catalog, list-detail, and flat-section page types.
- [x] 2026-03-27 23:45Z: Recorded the approved direction: favor reusable page patterns over a global second left panel.
- [x] 2026-03-28 00:04Z: Implemented a reusable `SettingsSectionNav` primitive and rewired `SettingsCategoryTabs` to use it instead of tabs.
- [x] 2026-03-28 00:10Z: Migrated Notifications to a reusable subsection panel and Shortcuts to a reusable filter bar; changed Appearance to default to the full stacked page instead of restoring a hidden subsection.
- [x] 2026-03-28 00:13Z: Ran `pnpm --filter @radarboard/app typecheck` successfully.
- [x] 2026-03-28 00:29Z: Added reusable `SettingsPanel`, `SettingsStatCard`, and `SettingsPageToolbar` helpers and migrated Database, About, Routing, Integrations, Widgets, and Plugins onto the shared settings-system primitives.
- [x] 2026-03-28 00:31Z: Re-ran `pnpm --filter @radarboard/app typecheck` successfully after the broader migration.
- [x] 2026-03-28 00:32Z: Updated this ExecPlan with the broader migration outcomes.

## Surprises & Discoveries

- Observation: The worktree already contains unrelated in-progress changes in multiple settings files.
  Evidence: `git status --short` on 2026-03-27 shows modified settings files including `apps/app/components/settings/settings-appearance/index.tsx`, `apps/app/components/settings/settings-modal/index.tsx`, `apps/app/components/settings/settings-plugins/index.tsx`, and `apps/app/components/settings/settings-sidebar/index.tsx`.

- Observation: The current settings surface already contains multiple implicit page patterns.
  Evidence: `settings-projects`, `settings-layouts`, `settings-mcp-servers`, and `settings-workflows` already render dual-pane list-detail UIs; `settings-integrations`, `settings-widgets`, and `settings-plugins` render searchable catalogs; `settings-appearance`, `settings-notifications`, and `settings-shortcuts` use page-local tabs or pseudo-tabs.

- Observation: Not all tabs are equivalent.
  Evidence: page-level tabs in `settings-appearance` and `settings-notifications` act as subsection navigation, while plugin detail modal tabs in `settings-plugins` are object-level editor tabs inside a dialog.

- Observation: `settings-shortcuts/index.tsx` is currently untracked in the worktree, so changes there must be treated as edits on top of in-progress local work rather than a clean migration from `HEAD`.
  Evidence: `git status --short -- apps/app/components/settings/settings-shortcuts/index.tsx` returns `??` on 2026-03-28.

- Observation: the list-detail pages were already sharing the correct underlying interaction model before this refactor.
  Evidence: `settings-projects`, `settings-layouts`, `settings-mcp-servers`, and `settings-workflows` already use `CollapsibleListPanel` or equivalent persistent list-detail composition.

## Decision Log

- Decision: Standardize the settings system around three page patterns rather than one universal secondary panel.
  Rationale: a global secondary panel would duplicate hierarchy next to the existing main settings rail and would make simple pages heavier without improving clarity.
  Date/Author: 2026-03-27 / Codex

- Decision: Keep secondary left panels only for list-detail pages.
  Rationale: pages with persistent selection and detail editing need stable context and selection state; flat settings and catalogs do not.
  Date/Author: 2026-03-27 / Codex

- Decision: Convert pages with small peer subsections away from tab-looking page navigation when discoverability is more important than strict mode separation.
  Rationale: page-level tabs in settings are visually too close to app-level navigation and obscure the full contents of pages like Appearance and Notifications.
  Date/Author: 2026-03-27 / Codex

- Decision: Preserve object-level tabs inside plugin detail dialogs.
  Rationale: those tabs organize one plugin record and do not compete with the main settings hierarchy.
  Date/Author: 2026-03-27 / Codex

- Decision: Make the shared page-local navigator orientation-aware so the same primitive can serve catalog filters, flat-section indexes, and vertical subsection panels.
  Rationale: this keeps the settings IA reusable without exploding the component surface into one helper per page.
  Date/Author: 2026-03-28 / Codex

- Decision: Stop restoring the last Appearance subsection from local storage.
  Rationale: sticky subsection state directly undermines the discoverability goal by reopening the page in a filtered state that hides most settings.
  Date/Author: 2026-03-28 / Codex

- Decision: Expand the shared settings helper surface beyond navigation to include reusable panels, stat cards, and catalog toolbars.
  Rationale: a settings-wide migration needs shared chrome as well as shared navigation; otherwise pages still drift visually even when the IA is aligned.
  Date/Author: 2026-03-28 / Codex

## Outcomes & Retrospective

Implemented a reusable `SettingsSectionNav` in `apps/app/components/settings/section-nav/index.tsx` and made `settings-category-tabs/index.tsx` a thin wrapper around it. That shifts category and subsection controls away from the tab visual language without forcing every page into a second left rail.

`settings-notifications/index.tsx` now uses the shared navigator as a visible vertical subsection panel inside the page content. `settings-shortcuts/index.tsx` now uses the same primitive as a horizontal filter bar. `settings-appearance/index.tsx` now opens to the full stacked page instead of restoring a previously filtered subsection.

The broader pass added shared `SettingsPanel`, `SettingsStatCard`, and `SettingsPageToolbar` helpers in `apps/app/components/settings/settings-page-layout/index.tsx`. Those are now used to normalize flat pages like `settings-about/index.tsx` and `settings-database/index.tsx`, stat-heavy pages like `settings-routing/index.tsx`, and catalog pages like `settings-integrations/index.tsx`, `settings-widgets/index.tsx`, and `settings-plugins/index.tsx`.

The remaining list-detail pages did not need structural migration because they were already on the correct pattern. The settings area is now aligned around shared primitives across all three approved page types.

## Context and Orientation

The settings modal lives in `apps/app/components/settings/settings-modal/index.tsx`. It renders the main left sidebar from `apps/app/components/settings/settings-sidebar/index.tsx` and swaps the right-hand content based on the active top-level settings section.

The common layout wrapper for standard settings pages is `apps/app/components/settings/settings-page-layout/index.tsx`. It currently provides the page header, optional status text, optional search input, and helper components `SettingsGrid` and `SettingsCardSection`.

Current page shapes:

- List-detail pages:
  `apps/app/components/settings/settings-projects/index.tsx`
  `apps/app/components/settings/settings-layouts/index.tsx`
  `apps/app/components/settings/settings-mcp-servers/index.tsx`
  `apps/app/components/settings/settings-workflows/index.tsx`

- Catalog pages:
  `apps/app/components/settings/settings-integrations/index.tsx`
  `apps/app/components/settings/settings-widgets/index.tsx`
  `apps/app/components/settings/settings-plugins/index.tsx`

- Flat settings pages:
  `apps/app/components/settings/settings-appearance/index.tsx`
  `apps/app/components/settings/settings-notifications/index.tsx`
  `apps/app/components/settings/settings-shortcuts/index.tsx`
  `apps/app/components/settings/settings-routing/index.tsx`
  `apps/app/components/settings/settings-features/index.tsx`
  `apps/app/components/settings/settings-debug/index.tsx`
  `apps/app/components/settings/settings-about/index.tsx`
  `apps/app/components/settings/settings-database/index.tsx`

The current page-level category control is `apps/app/components/settings/settings-category-tabs/index.tsx`, which wraps the shared `@radarboard/ui/tabs` primitives. This component is currently used by `settings-appearance`, `settings-integrations`, and `settings-widgets`, and notifications also uses `@radarboard/ui/tabs` directly for page-level navigation.

For this plan:

- a "catalog page" means a searchable page that shows many peer items grouped by category;
- a "list-detail page" means a page with a persistent left-hand list or navigator and a right-hand detail editor;
- a "flat settings page" means a page that should show sections directly in the page flow rather than hiding them behind persistent item selection.

Approved page map:

- Keep list-detail: Projects, Layouts, MCP Servers, Workflows.
- Keep catalog: Integrations, Widgets, Plugins.
- Convert to flat-section/index pages: Appearance, Notifications, Shortcuts, Routing, Features, Debug, About, Database, and likely AI.
- Keep object-level tabs in the Plugin detail dialog.

## Plan of Work

First, define a small reusable primitive surface inside `apps/app/components/settings/` that matches the three page types already present in the product. The goal is to stop treating tabs as the default answer for page-local organization and instead expose reusable navigation controls that make the hierarchy legible.

Next, update the existing shared page-layout layer so it can host these new controls without every page assembling its own `headerSlot` composition. This may include a reusable top index/filter bar for catalog pages and a reusable section-index component for flat-section pages.

Then, migrate the settings pages that currently use page-level tabs or ad hoc filter controls. `settings-appearance` should become a stacked sections page with a reusable section index or jump links. `settings-notifications` should become a stronger subsection-navigation page, likely with a reusable secondary section navigator because it has several dense subsections. `settings-shortcuts` should stop looking like tab navigation and instead use a reusable filter bar.

After that, align catalog pages like Integrations and Widgets to the shared catalog header primitive so they read consistently without implying a second hierarchy level. Plugins should remain a searchable catalog grid, while the plugin detail dialog keeps its internal tabs.

Finally, run targeted validation for the settings pages and update this ExecPlan so another contributor can pick up the work with no hidden context.

## Concrete Steps

1. Inspect the current shared settings layout and category controls.
   Working directory: `/Users/thedaviddias/Projects/radarboard`
   Command: `sed -n '1,260p' apps/app/components/settings/settings-page-layout/index.tsx`
   Expected result: current header, search, grid, and section helper structure.

2. Inspect current settings pages to confirm which pattern each page needs.
   Working directory: `/Users/thedaviddias/Projects/radarboard`
   Command: `sed -n '1,320p' apps/app/components/settings/settings-appearance/index.tsx`
   Command: `sed -n '1,280p' apps/app/components/settings/settings-integrations/index.tsx`
   Command: `sed -n '1,280p' apps/app/components/settings/settings-widgets/index.tsx`
   Command: `sed -n '1,260p' apps/app/components/settings/settings-projects/index.tsx`
   Expected result: enough context to distinguish flat-section, catalog, and list-detail patterns.

3. Implement shared primitives under `apps/app/components/settings/`.
   Working directory: `/Users/thedaviddias/Projects/radarboard`
   Command: edit files with `apply_patch`
   Expected result: reusable components for section index / filter bar / catalog header and any necessary layout updates.

4. Migrate pages to the new primitives.
   Working directory: `/Users/thedaviddias/Projects/radarboard`
   Command: edit files with `apply_patch`
   Expected result: page-specific IA aligns with the approved page map while keeping existing behavior.

5. Run targeted validation.
   Working directory: `/Users/thedaviddias/Projects/radarboard`
   Command: `pnpm --filter @radarboard/app test -- --runInBand`
   Command: `pnpm --filter @radarboard/app typecheck`
   Expected result: passing or documented failures relevant to pre-existing tree state.

6. Review changed files and update this plan.
   Working directory: `/Users/thedaviddias/Projects/radarboard`
   Command: `git diff -- apps/app/components/settings docs/superpowers/specs/2026-03-27-settings-ia-plan.md`
   Expected result: concise summary of the reusable settings-system refactor.

## Validation and Acceptance

Automated validation:

- run targeted app tests or page-level tests covering the affected settings components when those tests exist,
- run app typechecking to ensure the new shared settings primitives are wired correctly.

Current validation evidence:

- `pnpm --filter @radarboard/app typecheck` completed successfully on 2026-03-28 after introducing `SettingsSectionNav` and migrating the first pages.
- `pnpm --filter @radarboard/app typecheck` completed successfully again on 2026-03-28 after adding shared panels/stat cards/toolbars and migrating the broader settings surface.

Manual acceptance:

- opening Settings still shows the same top-level sidebar groups and sections,
- list-detail pages retain a persistent secondary panel with selection on the left and content on the right,
- catalog pages show search plus a consistent top filter/index control rather than a second left panel,
- Appearance no longer hides most of its content behind page-level tabs,
- Notifications no longer feels like a hidden multi-page flow behind a tab strip,
- Shortcuts uses a filter control that reads as filtering, not navigation,
- plugin detail modal tabs still work inside the dialog,
- new settings pages can be built by composing shared settings layout primitives instead of copying tab/filter scaffolding.

Acceptance should be judged by visible behavior in the settings modal, not by whether a specific internal component name exists.

## Idempotence and Recovery

This work is safe to repeat in small increments because it is a UI refactor with no schema migration or destructive data step.

If a migration of one page proves too invasive because of concurrent dirty-tree changes, leave that page on the old implementation temporarily, record the reason in this plan, and continue with the shared primitives plus pages that can be migrated safely.

If validation fails because of unrelated pre-existing work in the tree, document the failure precisely in this plan and distinguish it from regressions introduced by this refactor.

Do not use `git reset`, `--no-verify`, or environment-variable bypasses prohibited by `AGENTS.md`.

## Artifacts and Notes

Initial evidence used to create this plan:

- `apps/app/components/settings/settings-sidebar/index.tsx` shows the global top-level settings hierarchy already lives in a primary left rail.
- `apps/app/components/settings/settings-appearance/index.tsx` uses `SettingsCategoryTabs` for only three local subsections.
- `apps/app/components/settings/settings-notifications/index.tsx` uses five page-level tabs for dense notification configuration.
- `apps/app/components/settings/settings-projects/index.tsx`, `settings-layouts/index.tsx`, `settings-mcp-servers/index.tsx`, and `settings-workflows/index.tsx` already prove the list-detail pattern.

Implementation artifacts added in this pass:

- `apps/app/components/settings/section-nav/index.tsx`
- updates in `apps/app/components/settings/settings-category-tabs/index.tsx`
- updates in `apps/app/components/settings/settings-notifications/index.tsx`
- updates in `apps/app/components/settings/settings-shortcuts/index.tsx`
- updates in `apps/app/components/settings/settings-appearance/index.tsx`
- updates in `apps/app/components/settings/settings-page-layout/index.tsx`
- updates in `apps/app/components/settings/settings-about/index.tsx`
- updates in `apps/app/components/settings/settings-database/index.tsx`
- updates in `apps/app/components/settings/settings-routing/index.tsx`
- updates in `apps/app/components/settings/settings-integrations/index.tsx`
- updates in `apps/app/components/settings/settings-widgets/index.tsx`
- updates in `apps/app/components/settings/settings-plugins/index.tsx`

## Interfaces and Dependencies

Internal modules involved:

- `apps/app/components/settings/settings-page-layout/index.tsx`
- `apps/app/components/settings/settings-category-tabs/index.tsx`
- `apps/app/components/settings/settings-modal/index.tsx`
- the individual settings page components under `apps/app/components/settings/`

Shared UI dependencies:

- `@radarboard/ui/button`
- `@radarboard/ui/input`
- `@radarboard/ui/tabs`
- `@radarboard/ui/switch`
- `@radarboard/ui/empty-state`

Important contracts:

- top-level settings section IDs remain defined by `apps/app/components/settings/settings-sections.ts`,
- page-level reusable primitives must support search, optional counts/status, and filter/index state without forcing a second left rail,
- migrations must preserve current query-state or local-storage state where that behavior materially affects the page.

## Revision Notes

- 2026-03-27 / Codex: Created initial ExecPlan after reviewing the current settings pages and agreeing on a reusable page-pattern strategy instead of a universal second left panel.
- 2026-03-28 / Codex: Updated the plan after implementing the shared page-local navigation primitive and migrating the first settings pages.
- 2026-03-28 / Codex: Updated the plan after broadening the migration to shared settings panels, stat cards, and catalog toolbars across the remaining settings pages.
