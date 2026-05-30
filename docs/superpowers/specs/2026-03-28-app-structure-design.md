# Apps App Structure Design

## Purpose

`apps/app` has accumulated too many flat catch-all roots. This design defines a target structure that makes ownership obvious, reduces top-level sprawl, and creates a clear rule for what stays app-local versus what gets extracted into workspace packages.

The immediate maintainer-visible outcome is that `components`, `hooks`, `data`, and `lib` stop behaving like dumping grounds. The long-term outcome is that new code has an expected landing zone and regressions are blocked by repo checks.

## Target Structure

The app should be organized by responsibility, with compatibility shims handled at the alias level rather than by keeping flat legacy roots around forever.

- `apps/app/components`
  UI only. Root contains domain folders, not loose one-off components.
- `apps/app/modules`
  App-owned orchestration and state that do not belong in generic hooks or low-level runtime utilities. This intentionally avoids colliding with the monorepo’s root `features/*` packages.
- `apps/app/data`
  Persistence and repository code. This replaces the old `apps/app/db` root.
- `apps/app/hooks`
  React hooks only. Non-hook state helpers move into feature folders.
- `apps/app/lib`
  App runtime utilities and services, grouped into domain folders instead of a single flat root.
- `apps/app/config`
  Static app configuration.

## Extraction Rules

Keep code in `apps/app` when it is tightly coupled to Next route handlers, Tauri behavior, app shell composition, or app-local persistence. Move code to workspace packages when it has no app alias dependency, no app-specific runtime dependency, and a plausible second consumer.

Use these decisions consistently:

- Merge files when several files implement one concern split only by naming or backend variants.
- Divide files when one module mixes orchestration, IO, data mapping, and UI/runtime concerns.
- Move code out of `apps/app` when it is reusable and app-agnostic.
- Leave code in `apps/app` when it is a composition layer, even if it is small.

## Rollout

This refactor should be staged.

1. Add structure enforcement and compatibility aliases.
2. Move `db` to `data` and remove flat roots from `components` and `hooks`.
3. Reduce `lib` root size by moving obvious domains into subfolders.
4. Tighten enforcement and continue extracting package-worthy modules out of the app.

## Enforcement

The repo should reject new top-level sprawl.

- `components`, `hooks`, and `data` should reject loose root files.
- `hooks` should only contain hook modules; app-local stores belong under `modules`.
- `apps/app` should enforce a direct-file budget of at most 7 files per normal folder, with only narrow exemptions for artifact buckets such as `__stories__` and `__tests__`, plus explicitly tracked legacy roots during migration.
- tests must live in `__tests__`
- stories and scaffold stories must live in `__stories__`
- `lib` must not keep root files once the migration is complete.
- Structure checks should run from the existing hook pipeline, alongside current architecture and modularity checks.
