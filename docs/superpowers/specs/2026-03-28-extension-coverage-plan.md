# Maximize Extension Unit Coverage

This ExecPlan is maintained according to [PLANS.md](/Users/thedaviddias/Projects/radarboard/PLANS.md).

## Purpose / Big Picture

Raise real unit test coverage across Radarboard extension packages so widgets, integrations, and plugins have broader behavioral protection than the current conformance-only baseline. The visible outcome is that extension-focused coverage runs execute against materially more test cases, weak packages gain first-party unit tests, and coverage summaries improve without relying on threshold-only changes.

The work is successful when `pnpm test:coverage --filter='./widgets/*' --filter='./integrations/*' --filter='./plugins/*'` or equivalent targeted coverage runs complete for the changed packages, and the added tests exercise previously untested extension logic in observable ways.

## Scope

In scope:

- Audit current unit test coverage across `widgets/*`, `integrations/*`, and `plugins/*`.
- Add or expand Vitest unit tests in extension packages with the largest obvious gaps.
- Add missing `vitest.config.ts` files where an extension package already has testable source code but no package-local Vitest setup.
- Keep coverage work focused on unit and small component tests that run within the existing Vitest setup.

Out of scope:

- End-to-end coverage work in `apps/e2e`.
- Artificially raising coverage by only lowering exclusions or changing thresholds without new tests.
- Large production refactors that are not required to make extension code testable.
- Migrating every extension to a shared coverage report in a single artifact if package-local reports already work.

## Progress

- [x] 2026-03-28 16:20Z: Audited extension package inventory, Vitest configs, and current test file distribution.
- [x] 2026-03-28 17:05Z: Ranked the weakest packages and selected initial high-yield targets across integrations, widgets, and plugins.
- [x] 2026-03-28 17:35Z: Added missing `vitest.config.ts` files plus new client and data-source tests for `integrations/discord`, `integrations/pagerduty`, `integrations/stripe`, and `integrations/umami`.
- [x] 2026-03-28 17:45Z: Added targeted widget registration and hook tests in `widgets/roadmap`, `widgets/raindrop`, `widgets/shipping`, `widgets/sponsorship`, and `widgets/stars`.
- [x] 2026-03-28 17:55Z: Added targeted plugin helper and intent tests in `plugins/changelog`, `plugins/notes`, and `plugins/tasks`.
- [x] 2026-03-28 18:15Z: Ran targeted coverage commands for all changed integrations and brought those packages above threshold.
- [x] 2026-03-28 19:35Z: Completed a second-wave widget campaign covering resolver modules, hook files, and init renderer wrappers; `widgets/roadmap`, `widgets/raindrop`, `widgets/shipping`, `widgets/sponsorship`, and `widgets/stars` now pass `test:coverage`.
- [x] 2026-03-28 20:10Z: Added a second-wave plugin state-hook campaign for `plugins/notes` and `plugins/tasks`, covering `use-notes`, `use-note-folders`, `use-note-snapshots`, `use-auto-save`, `use-note-search`, `use-tasks`, and `use-task-folders`, plus small UI components like `task-filters` and `pomodoro`.
- [x] 2026-03-28 20:20Z: Added a third-wave plugin UI campaign covering medium-sized components like `note-editor`, `note-history`, `note-list-item`, `template-picker`, `task-detail-panel`, and `task-list`.
- [ ] Run a third-wave plugin campaign focused on large overlay/component files if full per-package coverage threshold compliance is required.

## Surprises & Discoveries

- Observation: Several extension packages have real source code but no package-local Vitest config at all.
  Evidence: `integrations/discord`, `integrations/pagerduty`, `integrations/stripe`, and `integrations/umami` have `package.json` and `src/*` files but no `vitest.config.ts`.

- Observation: A few widgets already have tests but remain obviously under-covered because the test suite is mostly conformance plus one rendering file.
  Evidence: `widgets/roadmap` has 7 non-test source files and only `src/__tests__/conformance.test.ts`; `widgets/review-pulse` has 1 source file and 2 tests, while `widgets/raindrop`, `widgets/revenue`, `widgets/shipping`, `widgets/sponsorship`, and `widgets/stars` each have 8 to 25 source files but only 2 to 3 tests.

- Observation: Plugin coverage is uneven; some plugins with larger implementation surfaces still have only two or three tests.
  Evidence: `plugins/changelog` has 23 non-test source files and 2 tests, `plugins/notes` has 19 non-test source files and 2 tests, and `plugins/tasks` has 18 non-test source files and 3 tests.

- Observation: The default shared coverage glob counts widget story scaffold files unless each package overrides the exclusion list.
  Evidence: `widgets/roadmap`, `widgets/raindrop`, `widgets/shipping`, `widgets/sponsorship`, and `widgets/stars` initially reported story scaffolds as uncovered production lines until package-local `coverage.exclude` was added.

- Observation: Integrations with smaller, mostly pure API layers could be raised above threshold in one pass, but larger widget and plugin packages remain far below threshold because their untested surface is dominated by resolver modules, hooks, and UI overlays rather than simple helpers.
  Evidence: After the first wave, `integrations/discord`, `integrations/pagerduty`, `integrations/stripe`, and `integrations/umami` passed `test:coverage`, while changed widget/plugin packages still reported 10% to 54% statement coverage due to large untested files.

- Observation: After the widget second wave, the remaining plugin coverage gap is overwhelmingly in large UI modules rather than data or state logic.
  Evidence: `plugins/notes` now reports 90%+ coverage across core `src/*.ts` state modules and 83%+ across the new hook tests, but package totals remain at 53.56% statements because `components/notes-overlay.tsx`, `components/note-editor.tsx`, `components/note-folder-sidebar.tsx`, and related UI files are still mostly untested. `plugins/tasks` shows the same pattern, with `src/*.ts` at 83.37% statements while the package total remains 39.11% because `components/tasks-overlay.tsx`, `components/task-kanban.tsx`, `components/task-detail-panel.tsx`, and related UI files dominate the remaining uncovered surface.

## Decision Log

- Decision: Prioritize test additions by obvious coverage opportunity instead of touching every extension uniformly.
  Rationale: Repo-wide coverage increases fastest when the weakest packages gain real tests first, especially packages with no Vitest setup or with only conformance coverage.
  Date/Author: 2026-03-28 / Codex

- Decision: Prefer behavior-level unit tests over threshold tuning.
  Rationale: The request is to add maximum unit test coverage, which implies increasing measured exercised code rather than reclassifying or hiding uncovered files.
  Date/Author: 2026-03-28 / Codex

## Outcomes & Retrospective

The first implementation wave is complete.

What shipped:

- Missing Vitest setup plus new unit coverage for four previously unconfigured integrations.
- New widget tests covering registration modules and the `useRoadmap` hook.
- New plugin tests covering changelog utilities, notes operations and templates, and tasks folder and intent helpers.
- Widget coverage config updates to exclude scaffold story files from measurement in touched widget packages.

What changed from the original intent:

- The integration goal was fully achieved for the targeted packages: the changed integration packages now pass their coverage thresholds.
- The widget and plugin goal is only partially complete. Real coverage increased, but the changed packages still do not meet the shared 80% threshold because many large production files remain untested.

Follow-up work:

- Add UI-focused tests for `plugins/changelog`, `plugins/notes`, and `plugins/tasks`, especially their overlay modules and persistent state hooks.

Second-wave widget outcomes:

- `@radarboard/widget-roadmap` now passes coverage at 92.59% statements and 86.36% branches.
- `@radarboard/widget-raindrop` now passes coverage at 100% statements and 95% branches.
- `@radarboard/widget-shipping` now passes coverage at 100% across all metrics.
- `@radarboard/widget-sponsorship` now passes coverage at 96.29% statements and 83.46% branches.
- `@radarboard/widget-stars` now passes coverage at 92.85% statements and 81.75% branches.

Second-wave plugin outcomes so far:

- `@radarboard/plugin-notes` improved from 37.59% to 53.56% statements, with `src/*.ts` state modules now at 90.44% statements.
- `@radarboard/plugin-tasks` improved from 36.91% to 39.11% statements, with `src/*.ts` state modules now at 83.37% statements.
- Neither plugin passes package-level coverage yet because the large overlay and detail components remain mostly untested.

Third-wave plugin outcomes so far:

- `@radarboard/plugin-notes` improved again to 64.51% statements and 52.31% branches.
- `@radarboard/plugin-tasks` improved again to 46.97% statements and 34.21% branches.
- The remaining coverage debt is now concentrated in a short list of large component files:
  `plugins/notes/src/components/notes-overlay.tsx`
  `plugins/notes/src/components/note-folder-sidebar.tsx`
  `plugins/notes/src/components/template-manager.tsx`
  `plugins/tasks/src/components/tasks-overlay.tsx`
  `plugins/tasks/src/components/task-folder-sidebar.tsx`
  `plugins/tasks/src/components/task-form.tsx`
  `plugins/tasks/src/components/task-kanban.tsx`

## Context and Orientation

Radarboard is a pnpm and Turborepo monorepo. Extension packages are split across three top-level directories:

- `widgets/*`: dashboard cards that render data and often export widget initialization or MCP helpers.
- `integrations/*`: external service adapters that provide clients, data sources, and MCP tools.
- `plugins/*`: richer extension modules with overlay UI, operations, MCP tools, and sometimes widget contributions.

The root `package.json` already exposes `pnpm test:coverage`, which delegates to `turbo run test:coverage`. Most extension packages already define `"test": "vitest run"` and `"test:coverage": "vitest run --coverage"` in their local `package.json`.

Shared Vitest defaults live in `packages/tsconfig/vitest.shared.ts`. That file sets the V8 coverage provider, reporters, source include globs, and default thresholds. Each extension package with a `vitest.config.ts` typically merges that shared config via `mergeConfig(sharedConfig, defineConfig(...))`.

The current extension landscape is mixed:

- Many extensions already have conformance and targeted tests.
- Some widgets and plugins have only a thin layer of tests relative to their source area.
- Some integrations have source code but no package-level Vitest config, which blocks local `test` and `test:coverage` scripts from existing.

Relevant files for this initiative:

- `package.json`
- `packages/tsconfig/vitest.shared.ts`
- `widgets/*/package.json`
- `widgets/*/vitest.config.ts`
- `widgets/*/src/**/*`
- `integrations/*/package.json`
- `integrations/*/vitest.config.ts`
- `integrations/*/src/**/*`
- `plugins/*/package.json`
- `plugins/*/vitest.config.ts`
- `plugins/*/src/**/*`

## Plan of Work

First, rank candidate packages by weak apparent coverage. Use the current audit as the starting point: packages with no Vitest config, packages with only conformance tests, and packages with large source surfaces but only a couple of tests move to the front of the queue.

Next, add the minimum configuration needed for testable but currently unconfigured integration packages. If a package already follows the standard extension scripts pattern, add `vitest.config.ts` by matching the established package-local shape used elsewhere in the same extension type.

Then add targeted tests package by package. For widgets, focus on render logic, empty and error states, data formatting, configuration mapping, and MCP helpers where present. For integrations, focus on client utilities, data source transformations, and MCP tools. For plugins, focus on reducers, CRUD helpers, operations, overlay behavior, and any pure transformation logic that is easy to verify without broad refactors. The order matters because config gaps must be solved before those packages can participate in coverage runs.

After the first round of tests lands, run targeted coverage on the changed packages. Use failures and coverage summaries to decide whether a second pass is better spent adding more tests to the same packages or moving to the next weakest group. Continue until marginal coverage gains become too expensive relative to the time available in this session.

## Concrete Steps

1. Audit the weakest extension packages.
   Working directory: `/Users/thedaviddias/Projects/radarboard`
   Command:

   ```sh
   find widgets integrations plugins -type f \( -name '*.test.ts' -o -name '*.test.tsx' \) | sort
   ```

   Expected result: existing extension test files are listed, making shallowly covered packages easy to spot.

2. Inspect package-local source and existing tests before editing.
   Working directory: `/Users/thedaviddias/Projects/radarboard`
   Command pattern:

   ```sh
   rg --files widgets/<name>/src integrations/<name>/src plugins/<name>/src
   ```

   Expected result: a concise source inventory for each target package.

3. Run package-local coverage while iterating on a target package.
   Working directory: `/Users/thedaviddias/Projects/radarboard/<extension-path>`
   Command:

   ```sh
   pnpm test:coverage
   ```

   Expected result: Vitest passes and emits a local `coverage/` summary for that package.

4. Run a final targeted extension coverage pass for the packages changed in this initiative.
   Working directory: `/Users/thedaviddias/Projects/radarboard`
   Command pattern:

   ```sh
   pnpm --filter <package-name> test:coverage
   ```

   Expected result: each changed package reports passing tests and updated coverage output.

## Validation and Acceptance

Validation is complete when all changed extension packages pass `pnpm test:coverage` from their package directory or via `pnpm --filter <package-name> test:coverage` from the repo root.

Acceptance criteria:

- Newly added tests fail if the underlying behavior is broken, proving they cover real logic rather than snapshots of incidental markup.
- Packages that previously lacked package-local Vitest setup can now run their local coverage command if they were brought into scope.
- Coverage output for the changed packages includes non-test source files that were previously unexercised.
- No unrelated package scripts are changed to bypass verification or lower the quality bar.

## Idempotence and Recovery

Most steps in this plan are safe to repeat. Running `pnpm test:coverage` repeatedly is expected during iteration. Re-reading source inventories and re-running coverage after each test batch is also safe.

If a new test exposes production behavior that is currently hard to isolate, prefer narrowing the test target or using existing package testing helpers instead of broad refactors. If a package proves too coupled for efficient unit testing in this session, record that in this plan and move to the next highest-yield target rather than forcing a risky redesign.

If coverage output creates large generated artifacts, they can be removed by deleting the package-local `coverage/` directory without affecting source files.

## Artifacts and Notes

Initial audit snapshot from 2026-03-28:

- Widgets with especially thin apparent coverage: `roadmap`, `raindrop`, `revenue`, `shipping`, `sponsorship`, `stars`.
- Integrations with no Vitest config: `discord`, `pagerduty`, `stripe`, `umami`.
- Plugins with large source surfaces and thin tests: `changelog`, `notes`, `tasks`.

## Interfaces and Dependencies

This work depends on:

- `vitest`
- `@vitest/coverage-v8`
- `packages/tsconfig/vitest.shared.ts`
- Existing extension test helpers exposed by `@radarboard/widget-sdk`, `@radarboard/widget-engine`, `@radarboard/integration-sdk`, and `@radarboard/plugin-sdk` where relevant

Interfaces that must remain intact:

- Each changed extension package must still support its existing `test` and `test:coverage` scripts.
- Shared Vitest defaults in `packages/tsconfig/vitest.shared.ts` remain the baseline unless a package needs local overrides.
- Extension exports in `src/index.ts`, `src/init.tsx`, `src/data-resolver.tsx`, and `src/mcp/*` must remain production-compatible after test additions.

## Milestones

### Milestone 1: Coverage Targets Ranked

A concrete target list exists for widgets, integrations, and plugins, with the weakest packages identified and ready for focused test additions.

### Milestone 2: Missing Test Entrypoints Added

At least the in-scope unconfigured packages have package-local Vitest setup so they can participate in coverage runs.

### Milestone 3: High-Yield Tests Added

The weakest extension packages now have targeted unit tests covering real behaviors beyond conformance checks.

### Milestone 4: Coverage Verified

All changed packages pass targeted coverage runs, and the plan records what improved plus any remaining high-cost gaps.

Revision note: 2026-03-28. Initial ExecPlan created after auditing extension package coverage surface and identifying the first high-yield targets.
Revision note: 2026-03-28. Updated after the first implementation wave to record shipped tests, passing integration coverage runs, and the remaining large widget/plugin gaps.
