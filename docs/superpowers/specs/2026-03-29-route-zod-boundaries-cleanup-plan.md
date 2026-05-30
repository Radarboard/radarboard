# Route Zod Boundary Cleanup

Maintained according to [PLANS.md](/Users/thedaviddias/Projects/radarboard/PLANS.md).

## Purpose / Big Picture

Bring all grandfathered route validation warnings down to zero so `pnpm check:route-zod-boundaries` can move from warning mode to full enforcement. After this work, route handlers under the app and module shells will validate request bodies and query parameters through Zod-backed helpers instead of reading untrusted input directly.

The result is visible through the checker itself: `pnpm check:route-zod-boundaries` should stop printing the existing-warning block and report only the success line. The baseline file at `scripts/route-zod-boundaries-baseline.txt` should either be empty or removable.

## Scope

In scope are route handlers covered by `scripts/check-route-zod-boundaries.ts`, especially files under `apps/app/modules/**/routes/*.ts` that still read `request.json()` or `searchParams` directly.

Out of scope are new checker heuristics, unrelated route architecture changes, or changes to endpoints that are already compliant.

## Progress

- [x] 2026-03-29 10:34Z: Audited the current warning set from `pnpm check:route-zod-boundaries`.
- [x] 2026-03-29 10:34Z: Grouped the current warnings by route file and pattern.
- [x] 2026-03-29 11:53Z: Fixed assistant-shell, notifications-shell, debug-shell, and extensions-shell route warnings.
- [x] 2026-03-29 11:57Z: Fixed auth-shell, backup-shell, credentials-shell, database-shell, and integration-shell route warnings.
- [x] 2026-03-29 11:58Z: Removed `scripts/route-zod-boundaries-baseline.txt` after the warning count reached zero.
- [x] 2026-03-29 11:58Z: Re-ran focused tests, checker, and changed-file typechecking.

## Surprises & Discoveries

- Observation: The current warning set is concentrated in a small number of route files rather than evenly spread across the app.
  Evidence: `apps/app/modules/integration-shell/routes/data.ts` accounts for 12 warnings and `apps/app/modules/notifications-shell/routes/feed.ts` accounts for 8 warnings.
- Observation: Many body warnings come from route handlers that already have custom parsing logic and only need a minimal object-level Zod boundary before the existing normalization code.
  Evidence: `apps/app/modules/assistant-shell/routes/artifacts.ts` already funnels the payload through `parseArtifactUpsertInput`.

## Decision Log

- Decision: Use the existing `parseBody` and `parseSearchParams` helpers wherever possible instead of introducing another validation helper.
  Rationale: The route checker is already defined around those helpers and they produce the response shape the codebase already expects.
  Date/Author: 2026-03-29 / Codex
- Decision: Burn down the current warning list in route-family batches rather than file-by-file in baseline order.
  Rationale: Batching by subsystem keeps related schemas and route semantics in context and reduces rework.
  Date/Author: 2026-03-29 / Codex

## Outcomes & Retrospective

All grandfathered route boundary warnings were removed by moving the remaining route handlers onto Zod-backed body and query parsing. The checker now passes without a baseline file, which means new violations fail immediately instead of being warned through.

The cleanup stayed narrower than a broader route refactor. Existing route semantics were preserved where practical by validating permissive schemas first and then keeping the route-specific normalization logic in place.

## Context and Orientation

The new route validation checker lives in `scripts/check-route-zod-boundaries.ts`. It scans route files under `apps/app/app/api`, `apps/app/modules`, and `apps/marketing/app/api` and flags two patterns: direct `request.json()` reads that are not validated by Zod, and direct `searchParams` reads that are not validated by Zod.

The canonical request validation helpers live in `apps/app/lib/utils/core/api.ts`, re-exported in the app shell as `@/lib/api`. `parseBody(request, schema)` validates JSON request bodies and returns a typed result or a ready-to-return 400 response. `parseSearchParams(searchParams, schema)` does the same for query parameters.

The current cleanup work is concentrated in module route handlers such as `apps/app/modules/assistant-shell/routes/artifacts.ts`, `apps/app/modules/integration-shell/routes/data.ts`, and `apps/app/modules/notifications-shell/routes/feed.ts`. These files already implement the business logic; the task is to move request parsing onto Zod-backed boundaries without changing the endpoint semantics.

## Plan of Work

Start with the assistant and notifications route families because they contain several repeated patterns: direct `request.json()` casts, direct `searchParams.get(...)` reads, and existing manual normalization functions that can be preserved after the Zod boundary. Add local query/body schemas where needed, route the reads through `parseBody` or `parseSearchParams`, and keep existing domain-specific normalization logic after validation.

Next, fix the auth, backup, credentials, database, extensions, and integration route families. The integration data route is the largest single hotspot and likely needs multiple small query schemas rather than one global schema because it handles several distinct actions. The goal is not to over-generalize that file, only to validate each request shape before use.

Once the warning count reaches zero, regenerate the baseline file. If the regenerated file is empty, remove its contents or delete the file and keep the checker in full-pass mode. Verification should include the focused test suite for the checker and a clean `pnpm check:route-zod-boundaries` run.

## Concrete Steps

1. Working directory: `/Users/thedaviddias/Projects/radarboard`
   Command: `pnpm check:route-zod-boundaries`
   Expected: prints the current grandfathered warning set and the final success line.

2. Working directory: `/Users/thedaviddias/Projects/radarboard`
   Command: edit the flagged route handlers to replace direct request parsing with `parseBody` / `parseSearchParams` and local Zod schemas.
   Expected: warning count drops as route families are cleaned up.

3. Working directory: `/Users/thedaviddias/Projects/radarboard`
   Command: `pnpm exec vitest run scripts/check-route-zod-boundaries.test.ts`
   Expected: the checker tests pass.

4. Working directory: `/Users/thedaviddias/Projects/radarboard`
   Command: `pnpm exec tsx scripts/check-route-zod-boundaries.ts --write-baseline`
   Expected: baseline file updates to match the remaining warning set, ideally zero entries.

5. Working directory: `/Users/thedaviddias/Projects/radarboard`
   Command: `pnpm check:route-zod-boundaries`
   Expected: no grandfathered warning block remains; only the success line is printed.

## Validation and Acceptance

Acceptance means the route validation checker no longer reports grandfathered warnings for existing route files. Automated proof is:

- `pnpm exec vitest run scripts/check-route-zod-boundaries.test.ts`
- `pnpm check:route-zod-boundaries`

If the baseline remains necessary for any reason, acceptance is not met. The intended end state is zero warnings, not merely fewer warnings.

## Idempotence and Recovery

The checker and baseline generation steps are safe to repeat. Running `pnpm check:route-zod-boundaries` multiple times is read-only. Running `pnpm exec tsx scripts/check-route-zod-boundaries.ts --write-baseline` is safe as long as the working tree contains the intended route fixes; it simply rewrites the baseline file to the current warning set.

If a route refactor changes behavior unexpectedly, revert only that file-level edit and re-run the checker to confirm the warning returns. Avoid removing the baseline early; it is the temporary guardrail while the cleanup is in progress.

## Artifacts and Notes

- Current warning distribution at the start of cleanup:
  - `apps/app/modules/integration-shell/routes/data.ts`: 12 warnings
  - `apps/app/modules/notifications-shell/routes/feed.ts`: 8 warnings
  - `apps/app/modules/assistant-shell/routes/artifacts.ts`: 5 warnings
  - `apps/app/modules/auth-shell/routes/mcp-oauth/authorize.ts`: 5 warnings
  - `apps/app/modules/backup-shell/routes/export.ts`: 5 warnings
- Final verification commands and outcomes:
  - `pnpm check:route-zod-boundaries` → `✓ route handlers do not introduce new unvalidated request body or query reads`
  - `pnpm exec vitest run scripts/check-route-zod-boundaries.test.ts` → 11 tests passed
  - `pnpm exec tsc-files --noEmit $(git diff --name-only -- '*.ts' '*.tsx' | tr '\n' ' ' )` → completed successfully

## Interfaces and Dependencies

This work depends on:

- `zod` for request schemas
- `apps/app/lib/utils/core/api.ts` for `parseBody` and `parseSearchParams`
- `next/server` route handlers and `NextResponse`
- The route checker in `scripts/check-route-zod-boundaries.ts`

The important contract at the end of the work is simple: route handlers covered by the checker must not read untrusted JSON bodies or query parameters directly without passing through a Zod validation step first.

Revision note: 2026-03-29. Initial ExecPlan created after the checker rollout to drive the warning burn-down to zero.
Revision note: 2026-03-29. Updated after the cleanup completed, including final verification evidence and removal of the baseline file.
