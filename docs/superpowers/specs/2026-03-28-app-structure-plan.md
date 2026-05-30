# Apps App Structure Refactor ExecPlan

This ExecPlan is maintained according to [PLANS.md](/Users/thedaviddias/Projects/radarboard/PLANS.md).

## Purpose / Big Picture

Reorganize `apps/app` so contributors can tell, from the path alone, whether a file is UI, feature state, persistence, or runtime infrastructure. The observable outcome is that the worst flat roots disappear, new flat-root regressions are blocked automatically, and the remaining legacy `lib` root is explicitly tracked instead of growing silently.

## Scope

In scope are:

- moving `apps/app/db` into `apps/app/data`
- removing loose root files from `apps/app/components`
- removing loose root files from `apps/app/hooks` by moving non-hook store files into `apps/app/features`
- adding compatibility path aliases so imports do not require a one-shot rewrite
- moving an initial high-signal slice of `apps/app/lib` into grouped folders
- adding a repo check that enforces the new shape

Out of scope for this pass are:

- extracting every package-worthy utility out of `apps/app`
- rewriting every old import string to the new paths
- full `lib` root elimination in one change

## Progress

- [x] 2026-03-28 17:55Z: Audited current `apps/app` structure and existing hook/enforcement pipeline.
- [x] 2026-03-28 18:10Z: Wrote and user-approved the target structure and rollout.
- [x] 2026-03-28 20:35Z: Removed loose root files from `components` and `hooks`, and moved settings store internals to `apps/app/modules/settings/store`.
- [x] 2026-03-28 20:55Z: Replaced `apps/app/db` with grouped folders under `apps/app/data`.
- [x] 2026-03-28 21:15Z: Added `scripts/check-app-structure.ts` and wired it into package scripts plus Lefthook.
- [x] 2026-03-28 21:35Z: Moved the first `lib` slice into `auth`, `licensing`, `mcp`, and `notifications`.
- [x] 2026-03-28 21:55Z: Updated imports to the real moved paths and passed targeted validation.
- [x] 2026-03-28 23:35Z: Emptied `apps/app/lib` root and moved the remaining runtime files into grouped subfolders.
- [x] 2026-03-28 23:55Z: Enforced `__tests__` and `__stories__` buckets across `apps/app`.
- [ ] Commit the refactor once the staged diff is limited to the structure work only.

## Surprises & Discoveries

- Observation: A clean checkpoint commit was blocked by existing repo hooks unrelated to the app-structure work.
  Evidence: The pre-commit pipeline required fixes in `lefthook.yml`, `biome.json`, template files, and Secretlint examples before the checkpoint could land.

- Observation: Multi-target compatibility path aliases were sufficient for TypeScript, but not reliable enough for Vitest import resolution.
  Evidence: Focused app tests still failed on `@/db/*`, `@/hooks/*`, and moved `@/lib/*` aliases until imports were rewritten to the real new paths.

- Observation: A recursive direct-file budget needs narrow exemptions for artifact buckets.
  Evidence: `__stories__` folders naturally exceeded the normal 7-file limit once story scaffolds were moved out of runtime folders.

- Observation: Bulk-moving tests and stories requires a second pass to fix relative imports from the new buckets.
  Evidence: After moving files into `__tests__` and `__stories__`, many imports changed from `./foo` to `../foo`.

## Decision Log

- Decision: Use compatibility path aliases instead of rewriting every import string in the same change.
  Rationale: This keeps the structural refactor reviewable while still removing flat roots from disk.
  Date/Author: 2026-03-28 / Codex

- Decision: Move settings store internals out of `hooks` and into `modules/settings/store`.
  Rationale: Those files are state infrastructure, not generic React hooks.
  Date/Author: 2026-03-28 / Codex

## Outcomes & Retrospective

This pass delivered both the structural foundation and the full `lib` breakup. `components`, `hooks`, `data`, and `lib` no longer have loose root files, the old `db` tree is gone, settings store internals now live under `modules`, and the repo blocks new flat-root regressions, over-budget folders, tests outside `__tests__`, and stories outside `__stories__`.

The remaining work is operational rather than structural: making sure the staged diff is limited to the intended app refactor and clearing the repo hook pipeline for commit.

## Context and Orientation

The current app uses four overloaded roots:

- `apps/app/components` mixes domain folders with loose runtime UI files.
- `apps/app/db` used to be fully flat and contained shared core files plus backend-specific repositories.
- `apps/app/hooks` contains real hooks plus non-hook settings store modules.
- `apps/app/lib` is now split into domain folders such as `assistant`, `integrations`, `extensions`, `system`, `utils`, `layout`, `auth`, `licensing`, `mcp`, and `notifications`.

Relevant files for the rollout:

- `apps/app/tsconfig.json`
- `apps/app/components/**`
- `apps/app/db/**`
- `apps/app/hooks/**`
- `apps/app/lib/**`
- `scripts/check-component-names.ts`
- `lefthook.yml`
- `package.json`

## Plan of Work

First add the docs and compatibility layer so files can move without forcing a huge import rewrite. Then move `db` into `data`, because that root is the cleanest to flatten structurally. Next move loose root components and hook/store files into their new folders. After the shape is stable, add a structure check that blocks new loose root files and records the temporary `lib` legacy allowlist. Finally, move a first grouped slice of `lib` so the app stops relying on a single flat runtime root.

## Concrete Steps

1. In `/Users/thedaviddias/Projects/radarboard`, update `apps/app/tsconfig.json` with compatibility paths for moved `data`, `hooks`, `components`, and grouped `lib` folders.
2. Move `apps/app/db` files into `apps/app/data/**` and update any broken relative imports inside the moved files.
3. Move non-hook settings store files into `apps/app/modules/settings/store/**`, then move hook files into `apps/app/hooks/**` domain folders.
4. Move loose root components into real domain folders under `apps/app/components`.
5. Add `scripts/check-app-structure.ts`, wire it into `package.json` and `lefthook.yml`, and fail on new flat-root regressions.
6. Move `apps/app/lib` into domain folders and add compatibility alias coverage for the new locations.
7. Move tests into `__tests__` and stories into `__stories__`, then normalize relative imports from the new buckets.
8. Run targeted checks, then commit only the intended structure diff.

## Validation and Acceptance

Acceptance criteria:

- `find apps/app/components -maxdepth 1 -type f` returns no implementation files.
- `find apps/app/hooks -maxdepth 1 -type f` returns no implementation files.
- `find apps/app/data -maxdepth 1 -type f` returns no implementation files.
- `find apps/app/lib -maxdepth 1 -type f` returns no implementation files.
- `find apps/app -type f \( -name '*.test.ts' -o -name '*.test.tsx' \)` returns only paths under `__tests__`.
- `find apps/app -type f \( -name '*.stories.ts' -o -name '*.stories.tsx' -o -name '*.scaffold.stories.tsx' \)` returns only paths under `__stories__`.
- `pnpm exec tsx scripts/check-app-structure.ts` passes.
- `pnpm --filter @radarboard/app typecheck` passes.
- Targeted `pnpm --filter @radarboard/app test` or related tests pass for touched areas.

Validated in this pass:

- `pnpm check:app-structure`
- `pnpm --filter @radarboard/app typecheck`
- `pnpm --filter @radarboard/app test -- hooks/settings/use-settings.test.ts lib/licensing/license.test.ts app/api/backup/route.test.ts`
- `pnpm --filter @radarboard/app test -- app/api/backup/__tests__/route.test.ts`

## Idempotence and Recovery

File moves are safe to repeat as long as the destination does not already contain the file. The compatibility alias layer makes partial migration recoverable because old import specifiers continue resolving while files settle into their new folders.

If a move breaks relative imports, fix the moved file to import by app alias instead of relative path. Do not recreate flat root wrappers unless the alias fallback proves insufficient.

## Artifacts and Notes

- Checkpoint commit before this refactor: `8e1a59e2` (`chore(repo): checkpoint workspace changes`)
- `apps/app/lib` root is empty.

## Interfaces and Dependencies

This work touches Next.js app code, app-local repository implementations, Tauri-related hooks, and repo-level enforcement scripts. The compatibility layer depends on `apps/app/tsconfig.json` path resolution continuing to work in both TypeScript and Next.

Revision note: 2026-03-28. Updated after the second implementation pass to reflect the full `lib` breakup and the enforced `__tests__` / `__stories__` convention.
