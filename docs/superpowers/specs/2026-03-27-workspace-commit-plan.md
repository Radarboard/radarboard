# Workspace Commit Cleanup

This ExecPlan is maintained according to [PLANS.md](/Users/thedaviddias/Projects/radarboard/PLANS.md).

## Purpose / Big Picture

Land the current workspace changes in one commit after cleaning lint, typecheck, staged-hook, and repo-wide validation issues. The visible outcome is a successful hook-enabled commit covering the current dirty tree, while excluding generated Playwright MCP console logs that do not belong in source control.

## Scope

In scope are the currently modified and untracked repo files shown by `git status --short`, including `.mcp.json`, `apps/app/app/api/config/**`, new tests, package changes, onboarding updates, plugin updates, docs, and the dashboard header change. Out of scope are generated `.playwright-mcp/*.log` artifacts and any unrelated new changes created after this plan started.

## Progress

- [x] 2026-03-27 14:20Z: Audited the dirty tree, hook config, and current repo validation commands.
- [x] 2026-03-27 14:20Z: Confirmed `.playwright-mcp/*.log` is generated output and should be excluded.
- [x] 2026-03-27 14:22Z: Fixed lint issues in the new config routes and database settings UI, and migrated E2E Settings selectors to the dock button.
- [x] 2026-03-27 14:24Z: Staged the intended commit scope explicitly, excluding `.playwright-mcp/*.log`.
- [x] 2026-03-27 14:27Z: Added a changeset, refreshed the onboarding snapshot, and cleared staged-hook-equivalent validation.
- [x] 2026-03-27 14:32Z: Cleared repo-wide lint, typecheck, affected tests, extension/architecture/modularity checks, and the app build warning tied to `/api/e2e/state`.
- [ ] Commit once with hooks enabled.

## Surprises & Discoveries

- Observation: `apps/e2e` still contains multiple tests that open Settings through the old header button even though Settings now lives in the dock.
  Evidence: `rg -n 'getByRole\\(\"button\", \\{ name: \"Settings\" \\}\\)' apps/e2e/tests` returned multiple matches across onboarding, dashboard, credential, layout, and settings tests.
- Observation: `.playwright-mcp/console-2026-03-27T13-39-53-781Z.log` is a generated console log rather than source or config.
  Evidence: The directory contains a timestamped `.log` file and no code.
- Observation: `pnpm test:staged:related` failed on a stale onboarding snapshot before any code regression was reported.
  Evidence: `features/onboarding/src/__tests__/step-snapshots.test.tsx` mismatched on the updated `StepWelcome` output and passed after refreshing `__snapshots__/step-snapshots.test.tsx.snap`.
- Observation: the app build warning came from the E2E state route pulling project-root paths into Turbopack/NFT tracing.
  Evidence: `pnpm turbo run test --affected` warned on `apps/app/app/api/e2e/state/route.ts` until the route/config path helpers were updated with Turbopack ignore hints.

## Decision Log

- Decision: Keep `.mcp.json` in commit scope but exclude generated `.playwright-mcp/*.log`.
  Rationale: `.mcp.json` is stable repo configuration, while the log file is ephemeral tool output.
  Date/Author: 2026-03-27 / Codex
- Decision: Update E2E tests to open Settings from the Plugins dock instead of restoring the old header button.
  Rationale: Tests should match the current product behavior rather than preserving a removed entry point.
  Date/Author: 2026-03-27 / Codex
- Decision: Add an explicit `.gitignore` rule for `.playwright-mcp/` logs even though the directory was already effectively ignored.
  Rationale: The user requested that the ignore change itself be included in the commit, and the explicit rule documents the intended treatment of generated MCP artifacts.
  Date/Author: 2026-03-27 / Codex

## Outcomes & Retrospective

The workspace is ready for a single hook-enabled commit. The final staged set includes the requested repo files plus a changeset and the new `.gitignore` entry, and excludes generated `.playwright-mcp/*.log` artifacts. Validation is clean across lint, typecheck, staged checks, repo audits, and affected tests. The only mid-stream additions to the original plan were refreshing the onboarding snapshot and fixing the `/api/e2e/state` build warning so the final validation run no longer emits the Turbopack NFT warning.

## Context and Orientation

The root `lefthook.yml` defines the commands that must pass for a normal commit and push. The current dirty tree spans `apps/app`, `apps/e2e`, `features/onboarding`, several shared packages, and plugins, so this work is not a single-package cleanup. The dashboard header change removed the old `TopBar` Settings button, and the current Settings entry point now lives in `apps/app/components/plugins/plugin-dock/index.tsx`, which renders a dock button inside the `Plugins` navigation region. The new config import/export endpoints live under `apps/app/app/api/config/`, and the database settings UI that triggers config export lives in `apps/app/components/settings/settings-database/index.tsx`.

## Plan of Work

Start by fixing the known lint failures and the obvious E2E fallout from the Settings-button move so the first validation pass measures real remaining issues instead of already-known breakage. Then stage the intended commit scope explicitly, excluding generated logs, and run the same checks that `lefthook` would execute for a commit. If staged package changes require release metadata, add a single changeset that covers the staged workspace changes. After staged checks pass, run the broader repo validation commands, fix any failures or warnings they surface, and only then create the single commit.

## Concrete Steps

From `/Users/thedaviddias/Projects/radarboard`:

1. Fix lint and behavior mismatches in:
   - `apps/app/app/api/config/export/route.ts`
   - `apps/app/app/api/config/import/route.ts`
   - `apps/app/components/settings/settings-database/index.tsx`
   - `apps/e2e/tests/*.spec.ts` files that still use the old header Settings button
2. Run `pnpm lint` and resolve all surfaced issues.
3. Stage the repo files from the current dirty tree, excluding `.playwright-mcp/*.log`, then confirm scope with `git diff --cached --name-only`.
4. Run the staged validation commands listed in the user-approved plan.
5. If `pnpm exec tsx scripts/check-changesets.ts --staged` fails, add one changeset and re-run staged validation.
6. Run repo-wide validation commands from the user-approved plan.
7. Commit with `git commit -m "chore: commit workspace changes"`.

## Validation and Acceptance

Acceptance requires all of the following:

- `git diff --cached --name-only` includes the intended source/config/docs/test files and excludes `.playwright-mcp/*.log`.
- `pnpm lint` exits successfully with no formatter or lint diagnostics.
- `pnpm typecheck` exits successfully across the workspace.
- The staged validation command set exits successfully.
- Repo-wide validation commands from the approved plan exit successfully.
- `git commit -m "chore: commit workspace changes"` succeeds with hooks enabled.
- Final `git status --short` is clean except for intentionally untracked generated logs, if any remain.

## Idempotence and Recovery

The validation commands are safe to re-run. If staged validation fails, keep the existing staged set and patch only the reported files; do not use `git reset`, `--no-verify`, or `LEFTHOOK=0`. If a generated log reappears under `.playwright-mcp/`, leave it unstaged and continue. If a commit hook reveals additional failures, fix them in place and retry the same commit command.

## Artifacts and Notes

- Initial lint run surfaced formatting issues in the new config routes and two E2E specs, plus a `lint/complexity/noVoid` finding in `apps/app/components/settings/settings-database/index.tsx`.
- `pnpm typecheck` completed successfully before implementation started.
- `pnpm test:staged:related` passed after refreshing `features/onboarding/src/__tests__/__snapshots__/step-snapshots.test.tsx.snap`.
- `pnpm --filter @radarboard/app build` and the final `pnpm turbo run test --affected` run both completed without the earlier NFT warning for `/api/e2e/state`.

## Interfaces and Dependencies

This work uses `pnpm`, `turbo`, `biome`, `lefthook`, Vitest-related staged tests, and the repo validation scripts in `scripts/`. The main interface change already present in the dirty tree is the Settings entry point moving from the top bar to the dock, which means E2E selectors must target the `Plugins` navigation region rather than the removed header control.
