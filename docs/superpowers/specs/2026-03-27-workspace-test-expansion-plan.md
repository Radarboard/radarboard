# ExecPlan: Workspace Test Expansion

Date: 2026-03-27

This ExecPlan is maintained according to [PLANS.md](/Users/thedaviddias/Projects/radarboard/PLANS.md).

## Purpose / Big Picture

Increase the test surface across under-tested Radarboard workspaces by adding behavior-first package tests and fixing any defects they expose. The observable outcome is that more `packages/*` and `plugins/*` workspaces have runnable package-level tests, and those tests validate public behavior instead of internal implementation details.

## Scope

In scope:
- audit current test coverage across `packages/*` and `plugins/*`
- prioritize workspaces with zero tests or extremely thin test coverage
- add package-level `test` scripts where missing
- add behavior-focused Vitest coverage using red-green-refactor loops
- fix real defects exposed by new tests

Out of scope:
- snapshot-heavy tests that mostly lock markup structure
- large refactors that are not required to support observable test behavior
- trying to force tests into configuration-only workspaces such as `packages/tsconfig`

## Progress
- [x] 2026-03-27 13:47Z: Audited workspace test distribution and identified the zero-test group.
- [x] 2026-03-27 13:47Z: Confirmed this initiative requires an ExecPlan because it spans multiple workspaces.
- [x] 2026-03-27 14:04Z: Added package-level `test` scripts to `packages/utils`, `packages/hooks`, `packages/notifications`, `packages/logger`, `packages/charts`, `packages/devlogs`, and `packages/emails`.
- [x] 2026-03-27 14:04Z: Added 16 new test files across the zero-test code packages, covering public behavior for helpers, accumulators, buffers, parsers, layouts, and email rendering.
- [x] 2026-03-27 14:04Z: Validated each touched workspace with package-level `test`, `typecheck`, and `lint`.
- [x] 2026-03-27 14:11Z: Added real MCP behavior coverage for `plugins/webhook-relay` and `plugins/backup`.
- [x] 2026-03-27 14:38Z: Added registry and dependency-resolution coverage for `packages/integration-sdk`, including a runtime guard against duplicate data source actions.
- [x] 2026-03-27 17:17Z: Added auth and router branch coverage for `packages/mcp-tools`, including a bearer-token whitespace fix.
- [x] 2026-03-27 17:22Z: Added package-local coverage floors and verified `test:coverage` passes for all workspaces touched in this initiative.
- [x] 2026-03-27 17:29Z: Normalized every workspace that already has tests so it now exposes `test`, `test:coverage`, and a local Vitest config.
- [x] 2026-03-27 19:07Z: Added first real unit-test coverage to `apps/marketing`, `apps/storybook`, and the Node sidecar surface in `apps/desktop`, and locked coverage floors for each.
- [x] 2026-03-27 19:07Z: Raised `widgets/analytics` coverage materially with hook and initialization tests, then locked a coverage floor for that widget.
- [x] 2026-03-27 20:06Z: Added focused coverage to `packages/ui` and raised it to a 100% blocked floor for the exercised component surface.
- [x] 2026-03-27 20:15Z: Added OTLP export coverage to `packages/observability` and locked its package floor.
- [x] 2026-03-27 20:15Z: Added new tests and blocked current baselines for `packages/assistant-core`, `packages/assistant-ui`, and `packages/feature-sdk`.
- [x] 2026-03-27 20:19Z: Raised `packages/widget-sdk` with utility and registry tests, then locked its package baseline.
- [x] 2026-03-27 20:19Z: Locked the current package-wide coverage baseline for `packages/plugin-sdk`.
- [x] 2026-03-27 20:39Z: Locked current baselines for `packages/embedding-service`, `packages/llm`, and `packages/llm-adapter-vercel`.
- [x] 2026-03-27 20:51Z: Added or tightened blocked coverage floors for `widgets/builds`, `widgets/commits`, `widgets/deployments`, and `widgets/aso-keywords`.
- [x] 2026-03-27 20:58Z: Added direct hook coverage and blocked floors for `widgets/domains`, and blocked current baselines for more stable widget packages as they were validated.
- [ ] Extend the pass to workspaces that still have no tests, and continue raising or locking coverage floors across the normalized families.

## Surprises & Discoveries

- Observation: test files are heavily concentrated in a few workspaces, while several reusable packages have no tests at all.
  Evidence: `find ... '*.test.ts'` showed zero tests in `packages/utils`, `packages/hooks`, `packages/notifications`, `packages/logger`, `packages/charts`, `packages/devlogs`, and `packages/emails`.
- Observation: some utility-heavy packages expose clean public functions but do not define package-level `test` scripts yet.
  Evidence: their `package.json` files expose only `lint` and `typecheck`.
- Observation: `plugins/webhook-relay` claimed to list the “most recent” webhooks but actually returned raw storage order.
  Evidence: a red test with unsorted stored events returned `["oldest", "newest", "middle"]` before the executor was changed to sort by `receivedAt` descending.
- Observation: `packages/integration-sdk` relied on conformance tests to reject duplicate data source actions, but runtime registration still accepted malformed descriptors and silently overwrote entries in `DATA_SOURCE_REGISTRY`.
  Evidence: a red test registering two `"data"` actions under the same integration succeeded before `registerIntegration()` was updated to throw.
- Observation: `packages/mcp-tools` extracted bearer tokens with trailing whitespace intact, which could cause valid credentials to fail exact-token validation downstream.
  Evidence: a red test using `"Bearer sk-test-token   "` returned `"sk-test-token   "` before `extractBearerToken()` was updated to trim the captured token.
- Observation: shared coverage thresholds existed in `packages/tsconfig/vitest.shared.ts`, but many touched workspaces had no local Vitest config, no `test:coverage` script, or no package-specific floor locked to their current baseline.
  Evidence: newly-covered workspaces such as `packages/utils`, `packages/hooks`, `packages/logger`, and `plugins/status-page` did not have package-local coverage configs before this pass.
- Observation: some workspace families had tests on disk but no package-level entry points at all, especially `widgets/*` and some core packages such as `packages/assistant-core` and `packages/ui`.
  Evidence: the repo-wide audit found test files under those workspaces while `package.json` still lacked `test` and `test:coverage` scripts.
- Observation: after enabling package-level test entry points for previously unmanaged widget packages, at least one suite (`widgets/analytics`) still fails for behavioral reasons unrelated to the coverage plumbing.
  Evidence: `pnpm --filter @radarboard/widget-analytics test` now executes and surfaces two failing assertions against placeholder analytics values.
- Observation: `apps/docs` is content-only documentation and should be treated as exempt from unit-test coverage requirements.
  Evidence: there is no executable application logic surface comparable to the other apps, and the user explicitly exempted it from unit testing.
- Observation: some packages need package-specific coverage scoping rather than the raw shared denominator, otherwise story files or inventory-only assets dominate the percentage and hide the real exercised surface.
  Evidence: `packages/ui` initially reported near-zero coverage until story files were excluded and direct tests were added for `switch.tsx` and `rich-text-viewer/code-highlight.tsx`.
- Observation: some large packages already have broad tests, but their honest package-wide baselines are still low because they contain substantial untested product surface.
  Evidence: `packages/assistant-ui` passed its suite but measured only `6.83 / 6.61 / 4.62 / 7.25`, so the immediate win was to block that current baseline before continuing to raise it in later passes.
- Observation: some shared packages benefit more from a few targeted utility tests before baseline-locking than from immediate threshold capture.
  Evidence: `packages/widget-sdk` improved from `35.56 / 22.97 / 43.28 / 31.28` to `54.12 / 37.83 / 59.7 / 52.14` after adding direct tests for path parsing, selection encoding, route helpers, registries, and debug-event posting.
- Observation: some packages are already strong enough that immediate baseline-locking is the right next move, even if one metric remains slightly below the shared default.
  Evidence: `packages/embedding-service` already measured `100 / 77.77 / 100 / 100`, so blocking that real branch baseline was more efficient than inventing marginal tests before continuing the broader rollout.
- Observation: several widgets share the same coverage-pattern problem as the larger packages did: story files and resolver wiring issues can distort or suppress the actual executable coverage until the tests import the same registration side effects as production.
  Evidence: `widgets/builds` initially failed because its test rendered a template widget without the deployments widget’s `vercel` resolver registration, and `widgets/aso-keywords` initially under-reported because story files dominated the denominator until they were excluded.
- Observation: widget hooks are often the fastest leverage point for raising a widget’s coverage floor because they exercise the real request-key, refresh, and data-shaping paths without requiring brittle UI assertions.
  Evidence: `widgets/builds` and `widgets/domains` both jumped from effectively unusable package coverage to strong blocked baselines once their local `use-builds` and `use-domains` hooks had direct tests.

## Decision Log

- Decision: start breadth-first with zero-test workspaces before deepening already-tested packages.
  Rationale: this raises the repo-wide floor faster and exposes missing package test infrastructure early.
  Date/Author: 2026-03-27 / Codex
- Decision: prefer pure-function and service packages first (`utils`, `notifications`, `logger`, `devlogs`, `emails`) before UI-heavy packages such as `charts`.
  Rationale: they are faster to cover well with behavior tests and lower risk of writing brittle implementation-coupled tests.
  Date/Author: 2026-03-27 / Codex

## Outcomes & Retrospective

The zero-test code package wave is complete. Seven workspaces that previously had no tests now have package-level `test` scripts and behavior-focused Vitest coverage:

- `packages/utils`
- `packages/hooks`
- `packages/notifications`
- `packages/logger`
- `packages/charts`
- `packages/devlogs`
- `packages/emails`

The next breadth-first wave has started. `plugins/webhook-relay` now has MCP behavior tests and a bug fix for recent-event ordering, `plugins/backup` now has MCP export coverage, `packages/integration-sdk` now covers registry and dependency-resolution behavior with a runtime fix for duplicate data source actions, and `packages/mcp-tools` now covers bearer-token parsing and disabled-tool filtering with a whitespace-trimming fix in auth parsing. The work also produced one earlier bug fix in `plugins/status-page`, where JSON health endpoints were incorrectly downgraded to `unknown` on thrown fetch failures. Coverage floors are now enforced for every workspace touched in this initiative, and every workspace that already has tests now also exposes `test` and `test:coverage` entry points plus a local Vitest config. New app-level coverage now exists for `apps/marketing`, `apps/storybook`, and the Node sidecar surface in `apps/desktop`; widget-specific floors now exist for `widgets/analytics`, `widgets/builds`, `widgets/commits`, `widgets/deployments`, `widgets/domains`, and `widgets/aso-keywords`; `packages/ui` now has a 100% blocked floor for its exercised non-story component surface; `packages/observability` now blocks at `100 / 89.28 / 100 / 100`; `packages/assistant-core`, `packages/assistant-ui`, `packages/feature-sdk`, `packages/widget-sdk`, `packages/plugin-sdk`, `packages/embedding-service`, `packages/llm`, and `packages/llm-adapter-vercel` are now all blocked at current package baselines. The remaining follow-up is to add real tests to currently uncovered executable workspaces, keep excluding `apps/docs` from unit-test scope, and then baseline or raise thresholds for the rest of the normalized families.

## Context and Orientation

Radarboard is a pnpm monorepo with reusable logic spread across `packages/*` and plugin implementations in `plugins/*`. Many packages already expose stable public APIs through `src/*.ts` modules, but only a subset currently has package-level tests. This initiative focuses first on workspaces where public behavior is easy to exercise:

- `packages/utils`: small formatting, routing, crypto, timezone, and project helper utilities.
- `packages/notifications`: in-memory event bus, stream hub, and digest accumulator primitives.
- `packages/logger`: structured logger, in-memory ring buffer, and request-logging middleware.
- `packages/devlogs`: CLI argument parsing, path generation, log cleaning, and tail resolution helpers.
- `packages/emails`: email render wrapper and waitlist welcome template.
- `packages/hooks`: some files are React hooks, but others are pure helpers and can be tested without a full app runtime.
- `plugins/webhook-relay`: currently has conformance coverage only, so MCP tools and overlay logic are likely candidates after the zero-test packages.

The main constraint is to keep tests behavior-oriented and package-local. If a test exposes a real bug, the fix should be minimal and validated immediately before moving to the next package.

## Plan of Work

Start by adding missing `test` scripts and Vitest dev dependencies to the first wave of zero-test workspaces. For each workspace, choose public behavior that matters to callers: formatting output, filtering semantics, routing rule evaluation, path derivation, log accumulation, or rendering output. Add one failing test at a time where feasible, run the package test command, then patch the implementation only if the new test exposes a real bug.

After the first wave is green, move to thinly tested packages such as `packages/hooks` and `plugins/webhook-relay`, targeting pure helper modules or public tool behavior instead of internal state. Avoid UI snapshot churn and prefer assertions that describe observable output, returned objects, thrown errors, or persisted values.

## Concrete Steps

Working directory for all commands: `/Users/thedaviddias/Projects/radarboard`

1. Audit test presence:
   `find packages plugins \( -name '*.test.ts' -o -name '*.test.tsx' -o -name '*.spec.ts' -o -name '*.spec.tsx' \)`
   Expected: identifies the zero-test and low-test workspaces.

2. Add package test support and new test files with `apply_patch`.
   Expected: each touched package gains a `test` script and at least one behavior-focused test file.

3. Validate each touched package individually:
   `pnpm --filter <package-name> test`
   Expected: package test suite passes with no failures.

4. Validate static checks for touched packages:
   `pnpm --filter <package-name> typecheck`
   `pnpm --filter <package-name> lint`
   Expected: no type errors and no lint errors.

## Validation and Acceptance

Acceptance criteria:
- each touched workspace has a runnable package-level test command
- new tests cover public behavior, not private implementation details
- any defects exposed by new tests are fixed in the same workspace
- targeted package `test`, `typecheck`, and `lint` commands pass after changes

Proof should come from observable behavior such as:
- route helpers returning the expected paths
- digest windows flushing with correct grouping and channels
- logger and buffer behavior honoring filtering and limits
- devlogs parsers returning the correct structured arguments and paths
- email rendering including expected copy and target links

## Idempotence and Recovery

This plan is safe to repeat. Re-running audits and targeted package tests is non-destructive. If a test addition exposes a defect but the fix becomes unclear, leave the failing test in place only while actively working; before pausing, either complete the fix or revert that unfinished test change so the workspace stays green. Package-level validation commands can be re-run at any time.

## Artifacts and Notes

- Audit command showed zero tests in:
  `packages/charts`, `packages/devlogs`, `packages/emails`, `packages/hooks`, `packages/logger`, `packages/notifications`, `packages/tsconfig`, `packages/utils`
- `packages/tsconfig` is configuration-only and not a meaningful target for behavior tests.

## Interfaces and Dependencies

- Test runner: `vitest`
- Shared repo tooling: `pnpm`, `biome`, `typescript`
- Public interfaces under test:
  - `packages/utils/src/*.ts`
  - `packages/notifications/src/*.ts`
  - `packages/logger/src/*.ts`
  - `packages/devlogs/src/*.ts`
  - `packages/emails/src/render.ts`
  - `packages/emails/src/templates/waitlist-welcome.tsx`
  - selected pure helper modules in `packages/hooks/src`
  - selected public plugin interfaces in `plugins/webhook-relay/src`

## Milestones

### Milestone 1: Zero-Test Service Packages Covered

The zero-test utility and service packages have package-level test commands and initial public-behavior coverage, with any exposed bugs fixed.

### Milestone 2: Thinly Tested UI and Plugin Packages Deepened

Selected hook and plugin packages gain additional behavior tests around helper logic and public tool contracts.

Revision note: 2026-03-27. Initial plan created after auditing workspace test distribution and choosing a breadth-first TDD rollout.

Revision note: 2026-03-27 14:04Z. Updated progress and outcomes after completing the zero-test code package wave and validating all touched workspaces.
Revision note: 2026-03-27 14:11Z. Updated progress after extending the second wave into `plugins/webhook-relay` and `plugins/backup`.
Revision note: 2026-03-27 14:38Z. Updated progress after extending the second wave into `packages/integration-sdk`.
Revision note: 2026-03-27 17:17Z. Updated progress after extending the second wave into `packages/mcp-tools`.
Revision note: 2026-03-27 17:22Z. Updated progress after adding and validating package-local coverage floors for all touched workspaces.
Revision note: 2026-03-27 17:29Z. Updated progress after normalizing coverage entry points and Vitest configs for every workspace that already had tests.
Revision note: 2026-03-27 19:07Z. Updated progress after adding first app-level coverage to marketing/storybook/desktop, raising coverage for `widgets/analytics`, and recording the docs exemption.
Revision note: 2026-03-27 20:06Z. Updated progress after adding a scoped blocked floor for `packages/ui`.
Revision note: 2026-03-27 20:15Z. Updated progress after blocking `packages/observability`, `packages/assistant-core`, `packages/assistant-ui`, and `packages/feature-sdk`.
Revision note: 2026-03-27 20:19Z. Updated progress after blocking `packages/widget-sdk` and `packages/plugin-sdk`.
Revision note: 2026-03-27 20:39Z. Updated progress after blocking `packages/embedding-service`, `packages/llm`, and `packages/llm-adapter-vercel`.
Revision note: 2026-03-27 20:51Z. Updated progress after blocking additional widget families: builds, commits, deployments, and ASO keywords.
Revision note: 2026-03-27 20:58Z. Updated progress after blocking the domains widget and recording the latest widget-family pattern.
