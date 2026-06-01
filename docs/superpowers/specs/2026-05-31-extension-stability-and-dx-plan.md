# Stabilize Community Extensions And Extension Authoring

This ExecPlan is maintained according to [PLANS.md](/Users/thedaviddias/Projects/radarboard/PLANS.md).

## Purpose / Big Picture

Radarboard should be stable after moving provider extensions to `/Users/thedaviddias/Projects/community-extensions`, and it should be straightforward for a user or contributor to create a new integration, widget, or plugin without learning hidden repository conventions.

The observable outcome is that core validation passes, community extension validation passes, onboarding can be exercised reliably, and the extension authoring path has clear commands, templates, validation, and failure messages.

## Scope

In scope:

Run an extensive validation matrix across Radarboard and `community-extensions`; triage and fix migration-related onboarding, demo, runtime, and extension catalog failures; audit the authoring workflow for integrations/widgets/plugins; and propose a developer experience path for new extension authors.

Out of scope:

Adding a new provider integration, redesigning the public extension SDK, or publishing packages to npm. If community package installability requires replacing `workspace:*` dependencies, this plan will identify the work and only implement it if it is a clearly bounded manifest/tooling change.

## Progress

- [x] 2026-05-31 21:05Z: Created this stabilization ExecPlan.
- [x] 2026-05-31: Ran the core Radarboard validation matrix.
- [x] 2026-05-31: Ran the community extension validation matrix after workspace manifest fixes.
- [x] 2026-05-31: Reproduced, triaged, and fixed onboarding/demo E2E failures caused by provider-extension decoupling.
- [x] 2026-05-31: Audited extension authoring scripts, templates, validation, and docs.
- [x] 2026-05-31: Captured the recommended extension authoring DX direction.
- [x] 2026-05-31: Implemented the first community-first authoring pass: unified create command, core proxy, scoped validation, doctor improvements, standalone package metadata, and updated authoring skills.
- [x] 2026-05-31: Restored demo showcase coverage for provider/community widgets while keeping fake data deterministic.

## Surprises & Discoveries

- Observation: During the provider migration, `pnpm test:e2e -- --grep @onboarding` initially stalled because Playwright polls the legacy `/api/database/config` readiness URL while the app now uses `/api/system/database/config`.
  Evidence: Adding a registered legacy alias let the E2E suite start.
- Observation: The onboarding E2E suite then started 138 tests but timed out on preview/demo pages that remained on the dashboard skeleton/project-not-found child during the test window.
  Evidence: `apps/e2e/test-results/**/error-context.md` shows missing onboarding text such as `Preview mode` and `Start fresh`.
- Observation: `pnpm install` in `community-extensions` initially failed because migrated packages still referenced Radarboard `workspace:*` dependencies that were not present in that repository.
  Evidence: Early run returned `ERR_PNPM_WORKSPACE_PKG_NOT_FOUND` for packages such as `@radarboard/tsconfig`; after manifest fixes, `pnpm install` passed.
- Observation: Onboarding tests that selected buttons by visible text became ambiguous after migration because the accessible tree contained both button labels and hidden legends with the same text.
  Evidence: Playwright strict locator failures for labels such as `Development`, `Product & Business`, `Start fresh`, and `Start with demo data`.
- Observation: Demo-mode should showcase provider/community widgets, but those widgets must never render disconnected states during the demo.
  Evidence: The demo layout now prefers provider/community widgets such as `npm-downloads`, `app-reviews`, `github-stars`, and `vercel-domains`, with core fallbacks when packages are absent; `/api/dev/demo/seed` seeds fake payloads for the corresponding integration routes, and the integration route prefers seeded demo cache keys over stale `configured:false` entries.
- Observation: Some runtime surfaces still assumed moved plugins were present.
  Evidence: The bottom ticker polled `status-page` and `rss-reader` routes until it was gated on the registered plugin registry.
- Observation: The current authoring flow is discoverable for core contributors but not community-first extension authors.
  Evidence: `package.json` exposes `create-widget`, `create-integration`, `create-plugin`, `generate:extensions`, `check:extensions`, `scaffold:extension-repo`, `catalog:generate`, and `test:extensions`; `packages/create-extension` exposes `create-radarboard-extension`, `radarboard-extension`, `radarboard-extension-dev`, and `radarboard-extension-build`; repo skills still describe adding packages to core `radarboard.config.ts`.
- Observation: The community tooling already had the correct templates and validation base, so the most useful change was to make it the default path instead of creating another scaffolder in core.
  Evidence: `community-extensions` now exposes `pnpm create-extension <name> --integration|--plugin|--widget`, and Radarboard core proxies `pnpm create-extension` to that repo when present.
- Observation: The demo E2E helper was hiding the real demo data path by mocking provider routes as disconnected.
  Evidence: The demo test now skips the disconnected provider route mocks, uses the real demo seed/API flow, and asserts that no `not connected`, `not configured`, install-provider, or no-trend messages appear across the 9 rendered widget cards.

## Decision Log

- Decision: Separate stabilization from the provider migration ExecPlan.
  Rationale: The migration is mostly structural and package-boundary work; this pass needs a broader validation and developer-experience focus.
  Date/Author: 2026-05-31 / Codex.

## Outcomes & Retrospective

Completed for the desktop-chrome automated path and package-level validation.

Core validation passed:

- `pnpm generate:extensions`
- `pnpm check:extensions`
- `pnpm typecheck`
- `pnpm --filter @radarboard/feature-onboarding test`
- `pnpm --filter @radarboard/widget-engine test`
- `pnpm --filter @radarboard/widget-bookmarks test`
- `pnpm --filter @radarboard/app test`

Community validation passed from `/Users/thedaviddias/Projects/community-extensions`:

- `pnpm install`
- `pnpm validate` with 35 extensions, 538 passed checks, 1 warning for `rss-reader` external dependency count, and 0 errors
- `pnpm catalog:generate`
- `pnpm test`

Onboarding and demo E2E passed on `desktop-chrome`:

- Focused demo badge tests passed.
- Focused demo dashboard test passed with 9 widget cards and no disconnected/no-data messages.
- Focused normal onboarding dashboard test passed after making the helper step-state driven.
- Focused backup/demo flow grep passed with 8 tests.
- Focused profile and plugin layout grep passed with 4 tests.
- Full `@onboarding` desktop-chrome run passed with 31 passed and 15 skipped.

The remaining validation gap is full cross-browser and mobile/tablet E2E coverage after the desktop-chrome stabilization. Existing mobile and tablet snapshots were updated where the provider-neutral onboarding flow changed, but the complete multi-project matrix was not rerun in this pass.

Authoring DX implementation passed:

- `pnpm create-extension --help` from Radarboard core
- `pnpm create-extension demo-dx --integration --target package --out /private/tmp/radarboard-extension-dx-test` from `community-extensions`
- `pnpm validate --extension integration/stripe` from `community-extensions`
- `pnpm validate` from `community-extensions`
- `pnpm test` from `community-extensions`
- `pnpm typecheck` from Radarboard core

Latest demo-specific verification also passed:

- `pnpm --filter @radarboard/widget-bookmarks test`
- `pnpm --filter @radarboard/widget-revenue test`
- `pnpm --filter @radarboard/widget-roadmap test`
- `pnpm --filter @radarboard/widget-sponsorship test`
- `pnpm --filter @radarboard/app test -- --run apps/app/modules/demo-shell apps/app/modules/integration-shell`
- `pnpm --filter @radarboard/feature-onboarding test`
- `RADARBOARD_E2E=1 pnpm --filter @radarboard/e2e exec playwright test --project=desktop-chrome --grep "demo mode dashboard shows demo badge and widgets" --workers=1 --reporter=line`
- `RADARBOARD_E2E=1 pnpm --filter @radarboard/e2e exec playwright test --project=desktop-chrome --grep "normal mode dashboard shows edit button" --workers=1 --reporter=line`

## Context and Orientation

Radarboard core lives in `/Users/thedaviddias/Projects/radarboard`. The community extension catalog lives in `/Users/thedaviddias/Projects/community-extensions`.

Core extension registration starts in `radarboard.config.ts` and generates runtime files under `apps/app/lib/extensions/runtime/`. Extension quality checks run from scripts such as `scripts/check-extensions-quality.ts`. Onboarding UI is split between `apps/app/components/onboarding/`, `features/onboarding/`, and `apps/app/components/dashboard/dashboard/index.tsx`. Playwright onboarding tests live in `apps/e2e/tests/onboarding/`.

Extension authoring currently uses repo-local skills and scaffolders:

- `skills/create-integration/SKILL.md`
- `skills/create-plugin/SKILL.md`
- `skills/create-widget/SKILL.md`
- likely package scripts such as `pnpm create-integration`, `pnpm create-plugin`, and `pnpm create-widget`

The community extension repo contains the moved official provider packages under `integrations/`, `plugins/`, and `widgets/`, plus `catalog.json`.

## Plan of Work

First, run the automated validation matrix that should be green after the migration. Capture exact failures instead of assuming they are migration-related. Then reproduce onboarding in a smaller, debuggable way so failures distinguish between cold Next startup, route readiness, actual UI regressions, and missing provider assumptions.

Next, audit extension authoring from the perspective of a new user: what command they run, what files appear, what metadata they must fill in, what validation catches, and how they publish or install locally. The result should be a short design for improving the flow, approved before implementing behavior changes.

Finally, implement only the fixes that are directly supported by failing tests or the approved authoring design, and rerun the relevant checks.

The concrete migration fixes implemented in this pass were limited to failing stability paths: onboarding defaults, demo/E2E seed data, stale database clients in E2E resets, provider route mocks, moved-plugin polling guards, bookmarks no-provider data guards, and Playwright locator/snapshot updates. Broader authoring behavior changes should be a follow-up.

## Concrete Steps

Run from `/Users/thedaviddias/Projects/radarboard` unless stated otherwise.

1. Confirm generated core extension files are current:

```bash
pnpm generate:extensions
pnpm check:extensions
```

2. Run core validation:

```bash
pnpm typecheck
pnpm --filter @radarboard/feature-onboarding test
pnpm --filter @radarboard/widget-engine test
pnpm --filter @radarboard/app test
```

3. Reproduce onboarding E2E:

```bash
pnpm test:e2e -- --grep @onboarding
```

If the full grep is too broad to debug, run the smallest failing onboarding spec directly from `apps/e2e` and capture the failing locator, page snapshot, console errors, and network status.

4. Run community validation from `/Users/thedaviddias/Projects/community-extensions`:

```bash
pnpm validate
pnpm catalog:generate
pnpm test
pnpm install
```

5. Audit authoring workflow:

```bash
rg "create-(integration|plugin|widget)|catalog:generate|validate" package.json scripts skills apps packages
```

## Validation and Acceptance

Automated acceptance:

- Radarboard core typechecks and app/unit extension checks pass.
- Community extension validation, catalog generation, and tests pass.
- Any remaining `pnpm install` or E2E failures are documented with exact error output and an implementation plan.
- Static imports from moved provider packages do not return in core source paths.

Manual acceptance:

- Fresh onboarding can be opened and completed without selecting provider integrations.
- Demo mode renders without missing widget/provider crashes.
- Settings surfaces show core extensions and community catalog entries.
- A new integration author can discover one command to scaffold, fill in metadata, run validation, and understand how to test or publish the extension.

## Extension Authoring DX Recommendation

The default extension-authoring path should become community-first:

- Provide one public entry point, such as `pnpm create-extension` locally and `pnpm create radarboard-extension` or `create-radarboard-extension` publicly.
- Ask for extension kind (`integration`, `plugin`, or `widget`) and target (`community` or `core`), with `community` as the default for concrete provider integrations and SaaS-specific widgets.
- Generate the package, README, CHANGELOG, catalog metadata, conformance test, local demo fixture, and minimal provider-neutral fallback state in one command.
- Add an `extension:doctor <path>` command that validates metadata, package boundaries, required exports, catalog readiness, installability, and whether the extension accidentally depends on core workspace-only packages.
- Add extension-scoped validation, such as `pnpm validate --extension stripe`, so authors do not need to run the entire community catalog on every small change.
- Add a local smoke harness that temporarily installs a community extension into Radarboard, runs `generate:extensions`, and verifies the extension appears in settings without changing core `radarboard.config.ts` permanently.
- Update `skills/create-integration`, `skills/create-plugin`, and `skills/create-widget` so provider integrations and provider-specific widgets default to `/Users/thedaviddias/Projects/community-extensions`, while core authoring is an explicit advanced path.

The implemented portion covers the local entry point, community default, README/CHANGELOG generation for standalone packages, scoped validation, a stronger doctor command, and skill updates. The remaining follow-up is the full local smoke harness that temporarily installs a community extension into a Radarboard checkout and verifies app settings.

## Idempotence and Recovery

All validation commands are safe to repeat. `pnpm generate:extensions` is safe to repeat after `radarboard.config.ts` changes. Do not use `git reset`; recover specific mistakes with normal file edits or by inspecting `git diff`.

For E2E commands, make sure no dedicated test server remains running on port `1365` after a failed or interrupted run.

## Artifacts and Notes

The provider migration plan is recorded at `docs/superpowers/specs/2026-05-31-provider-extension-migration-plan.md`.

## Interfaces and Dependencies

The stabilization pass touches the extension registry contracts in `@radarboard/integration-sdk`, `@radarboard/plugin-sdk`, `@radarboard/widget-sdk`, generated app runtime files, the community extension catalog schema, and Playwright onboarding tests.
