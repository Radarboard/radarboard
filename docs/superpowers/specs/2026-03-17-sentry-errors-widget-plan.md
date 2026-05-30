# Connect The Sentry Errors Widget To Live Data And Project Selection

This ExecPlan is maintained according to [PLANS.md](/Users/thedaviddias/Projects/radarboard/PLANS.md). It is written so a new contributor can resume the work using only this file and the current repository state.

## Purpose / Big Picture

The Sentry errors widget should work correctly both when the user is viewing “All projects” and when they are viewing an individual project, and Sentry project selection in settings should stop relying on a raw slug text field. After this change, the “All” tab should aggregate live unresolved issues and trend data across configured projects, and the project settings UI should offer a dropdown populated from the authenticated Sentry organization’s project list. The result is visible when the widget shows real combined data in the “All” view and when Sentry project configuration becomes a proper select control instead of a free-text input.

## Scope

In scope:
- Fix the Sentry fetcher behavior for the “All projects” tab.
- Add an API route that returns the authenticated Sentry organization’s project list.
- Add a reusable hook for Sentry project options.
- Replace the settings text input for Sentry project slug with a dropdown.
- Add any required route constants and focused validation for the new flow.

Out of scope:
- Reworking the widget UI beyond the data it receives.
- KPI strip changes.
- Pagination beyond the existing issue cap.
- New visualization or badge treatments for aggregated issue rows.

## Progress

- [ ] 2026-03-26 00:00Z: Create a compliant ExecPlan from the approved Sentry widget design.
- [ ] Implement Milestone 1: fix “All” tab aggregation in the Sentry fetcher.
- [ ] Implement Milestone 2: add the Sentry projects API route and hook.
- [ ] Implement Milestone 3: replace the settings slug input with a dropdown.
- [ ] Implement Milestone 4: validate aggregated widget behavior and settings UX.
- [ ] Implement Milestone 5: document outcomes and any remaining follow-up work.

## Surprises & Discoveries

- Observation: The project-tab path already works; the main data gap is only in the “All” tab branch.
  Evidence: The design says the all-tab fetcher currently returns `{ configured: true, sentry: null }`, while the project-tab path already fetches unresolved issues for the configured project.

- Observation: The organization project lookup capability already exists inside the Sentry API package but is not exposed through an HTTP route.
  Evidence: The design explicitly calls out that `getProjects()` in `@radarboard/api/sentry` is already implemented.

## Decision Log

- Decision: Keep the widget UI itself out of scope and focus on fetcher correctness plus configuration UX.
  Rationale: The design already states that the current widget UI can consume the richer data without a new component redesign.
  Date/Author: 2026-03-26 / Codex

- Decision: Treat the settings dropdown as a hook-and-route problem, not a local component-only change.
  Rationale: The right long-term fix is to expose the organization project list through the app API and a reusable hook rather than embedding fetch logic in the settings component.
  Date/Author: 2026-03-26 / Codex

## Outcomes & Retrospective

No implementation work has been completed from this plan yet. When the work is done, this section must summarize what shipped, what changed from the original intent, and what remains.

## Context and Orientation

This work spans the app fetcher layer, a new app API route, a reusable hooks package, and the project settings UI. The design doc at [2026-03-17-sentry-errors-widget-design.md](/Users/thedaviddias/Projects/radarboard/docs/superpowers/specs/2026-03-17-sentry-errors-widget-design.md) already defines the required behavior.

Relevant areas:

- `apps/app/lib/fetchers.ts`
  This contains `fetchSentryData()`, which currently behaves differently depending on whether the widget is in “All” mode or project-specific mode. The “All” branch is the broken one and must aggregate data across configured projects.

- `apps/app/app/api/sentry/projects/route.ts`
  This route does not exist yet and must expose the Sentry project list through the app server layer.

- `packages/hooks/src/use-sentry-projects.ts`
  This new hook should provide Sentry project options to the settings UI using the same SWR pattern already used elsewhere in the hooks package.

- `apps/app/components/settings-projects.tsx`
  This is the user-facing project settings surface where the raw Sentry slug input should become a dropdown.

In this repo, “All projects” means the widget is aggregating over every configured project entry in the platform configuration rather than querying Sentry with one specific project slug. “Configured” in the API route means Sentry credentials exist in storage and the app can resolve them successfully.

## Plan of Work

Begin with `fetchSentryData()` because the widget’s broken behavior is the user-facing defect. Implement the “All projects” aggregation branch by iterating the configured Sentry projects, fetching unresolved issues and project stats for each, then merging counts, issue lists, and trend data into a single `SentryOverview`.

Once aggregation logic exists, expose the Sentry organization’s project list through a dedicated app route and a reusable hook. This separates external API access from the settings component and makes the project list available to any future UI that needs it.

After the route and hook are in place, replace the raw slug field in project settings with a dropdown that uses the hook and follows the same integration-field pattern already used for other service-backed selects. Finish by validating the “All” tab widget behavior and the project settings UX together.

## Milestones

## Milestone 1: Fix All-Projects Aggregation In `fetchSentryData`

At the end of this milestone, the “All” Sentry widget view should return real combined data rather than `null`.

Implementation guidance:
- Update `apps/app/lib/fetchers.ts` inside `fetchSentryData()`.
- When `projectSlug` is `null`, identify all configured projects that contain Sentry configuration.
- For each project, fetch unresolved issues and project stats in parallel using `Promise.allSettled`.
- Merge unresolved issue counts, merge trend series, annotate issues with project metadata, sort by issue count descending, and cap the list at 25.
- Keep project-specific behavior unchanged when `projectSlug` is set.

Acceptance:
- The “All” branch returns aggregated unresolved count, merged trend data, and a capped issue list.
- The project-specific branch remains unchanged.
- Partial failures do not collapse the whole “All” branch unnecessarily.

## Milestone 2: Add The Sentry Projects Route And Hook

At the end of this milestone, the app should expose Sentry project options through a route and reusable hook.

Implementation guidance:
- Add `apps/app/app/api/sentry/projects/route.ts`.
- Have the route call Sentry config resolution and `getProjects(config)`.
- Return `{ configured: false }` when Sentry credentials are unavailable.
- Add `packages/hooks/src/use-sentry-projects.ts` using the existing hooks package conventions and a ten-minute refresh interval.
- Add or update route constants in `packages/types/src/api-routes.ts` if that package is the app’s canonical route constants location.

Acceptance:
- The route returns `configured: true` with project objects when credentials are available.
- The route returns `configured: false` without throwing when credentials are unavailable.
- The hook exposes project slugs and loading state in the expected shape.

## Milestone 3: Replace The Sentry Slug Input With A Dropdown

At the end of this milestone, project settings should no longer require manual Sentry slug entry.

Implementation guidance:
- Update `apps/app/components/settings-projects.tsx`.
- Call `useSentryProjects()` unconditionally in the same part of the render tree where similar hooks are already used.
- Extend the integration field rendering path so `integrationKey === "sentry"` and `field.key === "projectSlug"` render a `SelectField`-style dropdown.
- Preserve the existing empty state when credentials are not configured by allowing the dropdown options to be empty.

Acceptance:
- The Sentry settings field becomes a dropdown populated from the hook.
- The settings UI remains stable when Sentry is not yet configured.
- No other integration field behavior regresses.

## Milestone 4: Validation And Cleanup

At the end of this milestone, the touched code should pass static checks and the plan should reflect the actual implementation outcome.

Implementation guidance:
- Add or update focused tests for the fetcher aggregation, route response shape, hook behavior where appropriate, and settings field rendering.
- Confirm route constants and imports remain consistent.
- Update the living-document sections of this plan with implementation outcomes.

Acceptance:
- The touched files pass lint and typecheck.
- Relevant fetcher or settings tests pass.
- The plan records the final implemented outcome and any follow-up work.

## Concrete Steps

Run commands from the repository root unless another directory is specified.

For app-side validation:

    cd /Users/thedaviddias/Projects/radarboard/apps/app
    pnpm vitest run --reporter=verbose
    pnpm tsc --noEmit

For hooks and shared type validation:

    cd /Users/thedaviddias/Projects/radarboard
    pnpm --filter @radarboard/hooks exec tsc --noEmit
    pnpm --filter @radarboard/types exec tsc --noEmit

For focused formatting and lint checks:

    cd /Users/thedaviddias/Projects/radarboard
    pnpm --filter @radarboard/app exec biome check apps/app/lib/fetchers.ts apps/app/app/api/sentry/projects/route.ts apps/app/components/settings-projects.tsx
    pnpm --filter @radarboard/hooks exec biome check packages/hooks/src/use-sentry-projects.ts
    pnpm --filter @radarboard/types exec biome check packages/types/src/api-routes.ts

If current package names or scripts differ from these commands, update this section before implementation continues.

## Validation and Acceptance

Validation is complete only when all of the following are true:

- The Sentry widget shows real aggregated data in the “All projects” view.
- The project-specific Sentry path still works.
- The new `/api/sentry/projects` route returns the expected configured and unconfigured shapes.
- The settings project field uses a dropdown rather than a free-text slug input.
- The dropdown is populated when credentials exist and remains empty-but-stable when they do not.
- The touched app, hooks, and types paths pass lint and typecheck.
- Relevant fetcher, route, or settings tests pass.

Manual verification should include:

    1. Open the Sentry widget in the “All” tab and verify unresolved count and issue list are populated.
    2. Open a project-specific Sentry view and verify it still works.
    3. Open project settings and verify the Sentry field renders as a dropdown.
    4. Confirm the dropdown options match the authenticated Sentry organization project list.
    5. Verify the settings UI stays stable when Sentry credentials are missing.

## Idempotence and Recovery

Most of this work is safe to repeat. Aggregation logic can be refined and re-run through tests, and the route and hook can be revalidated independently. The main risk is accidentally regressing the currently working project-specific fetch path while fixing the “All” branch.

Recovery guidance:
- Keep the project-specific branch unchanged while building the new all-projects aggregation logic.
- Validate the fetcher with focused tests before wiring the settings dropdown.
- Land the route and hook before replacing the settings field so the UI never depends on an unavailable source.
- If the all-projects aggregation proves unstable, preserve the existing project-specific behavior and temporarily gate the aggregated branch behind a safer fallback instead of breaking the widget entirely.

## Artifacts and Notes

Primary source files for this work:
- [2026-03-17-sentry-errors-widget-design.md](/Users/thedaviddias/Projects/radarboard/docs/superpowers/specs/2026-03-17-sentry-errors-widget-design.md)
- `apps/app/lib/fetchers.ts`
- `apps/app/app/api/sentry/projects/route.ts`
- `packages/hooks/src/use-sentry-projects.ts`
- `apps/app/components/settings-projects.tsx`
- `packages/types/src/api-routes.ts`

The existing design explicitly says the widget UI already has enough surface to display aggregated issues. The main value of this work is fixing the data path and making configuration safer.

## Interfaces and Dependencies

Internal dependencies:
- `fetchSentryData()` must continue to return the `SentryOverview` shape expected by the widget.
- The new route must return a stable `configured` shape suitable for the hook.
- The new hook must match the repository’s SWR hook patterns.
- The project settings component must render the dropdown through the same integration field system it already uses for other service-backed inputs.

External dependencies:
- `@radarboard/api/sentry` must continue to provide `resolveSentryConfig()`, `getProjects()`, `getUnresolvedIssues()`, and `getProjectStats()`.
- The widget depends on configured project metadata already stored in the repo’s platform configuration.

Revision note: 2026-03-26. Created this ExecPlan from the approved Sentry widget design to test the `PLANS.md` standard against widget-oriented work.
