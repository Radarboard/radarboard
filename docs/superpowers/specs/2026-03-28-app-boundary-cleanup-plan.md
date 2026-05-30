# App Boundary Cleanup

This ExecPlan is maintained according to [PLANS.md](/Users/thedaviddias/Projects/radarboard/PLANS.md).

## Purpose / Big Picture

`apps/app` should act as the Radarboard shell, not as a second home for integration, widget, feature, and plugin implementation details. After this refactor, GitHub stars persistence lives with the GitHub integration, stars widget configuration UI lives with the stars widget, notifications UI lives with the notifications feature, and plugin-specific runtime pollers live with their plugins.

Maintainers should be able to see the new ownership model working by verifying that `apps/app/data/github-stars` is gone, `apps/app/components/notifications` is gone, plugin-specific pollers are no longer implemented in `apps/app`, and a dedicated ownership check fails when code regresses back into the app shell.

## Scope

In scope:

- Move GitHub stars persistence, migration fragments, and backfill orchestration out of `apps/app` and into `integrations/github`.
- Move stars widget repo-picker helpers out of `apps/app` and into `widgets/stars`.
- Move notification UI out of `apps/app` and into `features/notifications`.
- Move plugin-specific pollers into their plugin packages.
- Add ownership enforcement on top of the existing app-structure checks.

Out of scope:

- Re-architecting every existing tech-debt item already tracked in `scripts/check-modularity.ts`.
- Replacing the generated integration/plugin/widget init flow.
- General visual redesign of the moved UI.

## Progress

- [x] 2026-03-28 00:00Z: Reviewed the approved boundary plan and confirmed the working tree was clean.
- [x] 2026-03-28 00:00Z: Audited current owners for GitHub stars, notifications, plugin pollers, and widget repo-picking.
- [x] 2026-03-28 00:00Z: Extracted GitHub stars persistence, migration fragments, schema, and backfill implementation to `integrations/github` and removed `apps/app/data/github-stars`.
- [x] 2026-03-28 00:00Z: Moved notification UI to `features/notifications` with an app-shell adapter in `apps/app/modules/provider-shell`.
- [x] 2026-03-28 00:00Z: Moved plugin pollers and stars widget config helpers to their package owners; generic plugin host views now live in `packages/plugin-sdk` with app-shell adapters.
- [x] 2026-03-28 00:00Z: Added `scripts/check-app-ownership.ts`, wired repo hooks/scripts, and passed validation.

## Surprises & Discoveries

- Observation: `integrations/github` already owns star-history sync logic in `integrations/github/src/api/star-history.ts`, but persistence adapters and migration SQL still live in `apps/app`.
  Evidence: `integrations/github/src/api/star-history.ts` depends on `ctx.getGitHubStarHistoryRepo?.()`, while `apps/app/data/core/repository.ts` constructs the repository from app-local classes.

- Observation: The generic plugin host UI in `apps/app/components/plugins/*` is not pure today. It still depends on app hooks such as `useDisabledPlugins`, app shortcut presentation, and one status-page-specific issue-state fetch.
  Evidence: `apps/app/components/plugins/plugin-dock/index.tsx`, `plugin-launcher/index.tsx`, and `plugin-overlay/index.tsx`.

- Observation: `features/notifications` exists only as a descriptor package today, so moving the UI there requires expanding the package surface rather than simply changing imports.
  Evidence: `features/notifications/src/index.ts`.

## Decision Log

- Decision: GitHub stars persistence moves into `integrations/github`, not a new shared package.
  Rationale: The capability only exists when the GitHub integration is present and primarily serves the stars widget. A separate shared package would create a fake cross-product domain.
  Date/Author: 2026-03-28 / Codex

- Decision: Keep `apps/app/modules` minimal instead of creating new modules for extracted code.
  Rationale: `modules` is reserved for app-shell orchestration that has no better owner. Adding more modules would recreate the original catch-all problem.
  Date/Author: 2026-03-28 / Codex

## Outcomes & Retrospective

The approved boundary cleanup is implemented and verified. `apps/app` no longer owns GitHub-stars persistence, notification UI, plugin-specific pollers, or stars widget repo-picking helpers. The app shell now composes package-owned surfaces from `integrations/github`, `features/notifications`, `widgets/stars`, `plugins/*`, and `packages/plugin-sdk`.

One refinement from the original plan was necessary: generic plugin host UI moved into `packages/plugin-sdk`, but thin app-shell adapters remain in `apps/app/modules/provider-shell` to supply app-only shortcut, disabled-plugin, and status-page-derived state. This matches the `modules` policy because the adapters are orchestration only, not reusable feature or plugin logic.

## Context and Orientation

The current app shell lives in `apps/app`. It still contains integration-specific persistence in `apps/app/data/github-stars`, widget-specific repo-picker UI in `apps/app/components/widgets`, notification UI in `apps/app/components/notifications`, and plugin-specific pollers in `apps/app/components/plugins` plus `apps/app/components/webhook-relay-poller`.

The real package owners already exist:

- `integrations/github` contains GitHub API data sources, webhook handling, and star-history sync logic.
- `widgets/stars` contains the stars widget descriptor, hooks, data resolver, and detail renderer.
- `features/notifications` contains the notifications feature descriptor but not the UI yet.
- `plugins/rss-reader`, `plugins/status-page`, and `plugins/webhook-relay` contain the relevant plugin descriptors and plugin-owned logic.
- `packages/plugin-sdk` contains the shared plugin host runtime and generic plugin component primitives.

The enforcement scripts already present are `scripts/check-app-structure.ts` and `scripts/check-modularity.ts`. This initiative adds a separate ownership-focused check instead of overloading the existing folder-shape rule.

## Plan of Work

Start with GitHub stars because it is the highest-risk boundary leak and has the deepest dependency chain. Create integration-owned stars exports in `integrations/github` for repository adapters, migration SQL fragments, schema definitions, and backfill orchestration. Update `apps/app/data/core/repository.ts`, `apps/app/data/core/client.ts`, `apps/app/data/providers/sqlite/sqlite-migrate.ts`, and `apps/app/app/api/database/migrate/route.ts` to consume those public exports. Remove `apps/app/data/github-stars` after the app uses only integration-owned exports.

Then move widget-owned GitHub repo-picker helpers from `apps/app/components/widgets` into `widgets/stars`, exporting a public surface that the app’s widget config panel can consume without app-local stars helpers.

After the stars extraction, expand `features/notifications` to own the notification item, dropdown, panel, and center UI. The app shell should keep only any small app-specific adapter code that cannot live in the package without importing back into `apps/app`.

Next, move plugin-specific pollers into `plugins/rss-reader`, `plugins/status-page`, and `plugins/webhook-relay`. For the generic plugin host UI, move the reusable presentation components into `packages/plugin-sdk` and pass app-specific state through props rather than importing app hooks inside the package.

Finish by adding `scripts/check-app-ownership.ts`, wiring it into the root scripts, and tightening `scripts/check-modularity.ts` and `scripts/check-app-structure.ts` where the new boundaries make older exceptions obsolete.

## Concrete Steps

Working directory for all commands below: `/Users/thedaviddias/Projects/radarboard`

1. `pnpm check:app-structure`
   Expected: current folder-shape rules pass before the boundary cleanup starts.

2. `pnpm --filter @radarboard/integration-github test`
   Expected: baseline for the GitHub integration before moving persistence exports.

3. `pnpm --filter @radarboard/widget-stars test`
   Expected: baseline for the stars widget before moving repo-picker helpers.

4. `pnpm --filter @radarboard/app typecheck`
   Expected: current shell typecheck passes before edits.

5. After implementation, rerun:
   - `pnpm check:app-structure`
   - `pnpm check:app-ownership`
   - `pnpm --filter @radarboard/integration-github test`
   - `pnpm --filter @radarboard/widget-stars test`
   - `pnpm --filter @radarboard/feature-notifications typecheck`
   - `pnpm --filter @radarboard/plugin-rss-reader test`
   - `pnpm --filter @radarboard/plugin-status-page test`
   - `pnpm --filter @radarboard/plugin-webhook-relay test`
   - `pnpm --filter @radarboard/app typecheck`

## Validation and Acceptance

Acceptance is based on observable ownership outcomes:

- `apps/app/data/github-stars` no longer exists.
- `apps/app/components/notifications` no longer exists.
- `apps/app` imports GitHub stars persistence only through public `@radarboard/integration-github` exports.
- Stars widget repo selection helpers are exported from `@radarboard/widget-stars` and consumed from there.
- RSS reader, status page, and webhook relay pollers render from their plugin packages, not app-local components.
- `pnpm check:app-ownership` fails when forbidden package-specific code is reintroduced under `apps/app`.
- All listed typechecks and focused tests pass.

## Idempotence and Recovery

The file moves and import rewrites are safe to repeat as long as ownership is checked after each slice. Validation commands can be rerun at any time.

If a package extraction partially fails, recover by restoring the public export surface first, then updating the app shell imports, and only then deleting the old app-local implementation. Do not remove the old owner before the new package export compiles.

## Artifacts and Notes

- Approved architecture reference: the revised `apps/app` boundary cleanup plan from this thread.
- Existing related plan: `docs/superpowers/specs/2026-03-28-app-structure-plan.md`.
- Validation completed successfully:
  - `pnpm check:app-structure`
  - `pnpm check:app-ownership`
  - `pnpm --filter @radarboard/app typecheck`
  - `pnpm --filter @radarboard/integration-github test`
  - `pnpm --filter @radarboard/widget-stars test`
  - `pnpm --filter @radarboard/feature-notifications typecheck`
  - `pnpm --filter @radarboard/plugin-rss-reader test`
  - `pnpm --filter @radarboard/plugin-status-page test`
  - `pnpm --filter @radarboard/plugin-webhook-relay test`
  - `pnpm --filter @radarboard/plugin-sdk typecheck`

## Interfaces and Dependencies

Important end-state interfaces:

- `@radarboard/integration-github` exports public stars-specific repository, schema, migrations, and backfill surfaces.
- `@radarboard/widget-stars` exports stars widget repo-picker types and helpers used by app config UI.
- `@radarboard/feature-notifications` exports the app-facing notification UI components.
- `@radarboard/plugin-rss-reader`, `@radarboard/plugin-status-page`, and `@radarboard/plugin-webhook-relay` export their background poller components.
- `scripts/check-app-ownership.ts` defines the owner map and forbidden import directions for `apps/app`.

Revision note: 2026-03-28. Initial ExecPlan created for the cross-package app-shell boundary cleanup initiative.
