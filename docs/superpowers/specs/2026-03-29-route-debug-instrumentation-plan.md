# Route Debug Instrumentation

This ExecPlan is maintained according to [PLANS.md](/Users/thedaviddias/Projects/radarboard/PLANS.md).

## Purpose / Big Picture

Make every API request that passes through Radarboard's shared route dispatcher leave a durable record in Debug > Events. That gives maintainers a single place to inspect route starts, completions, rejections, and failures, instead of relying on scattered console output or Tauri logs.

## Scope

In scope: shared instrumentation for registered API routes, catch-all 404/405 handling, route lifecycle event persistence, and targeted tests for the wrapper behavior.

Out of scope: instrumenting arbitrary server-side helper functions that are not route handlers, redesigning the debug events schema, or removing route-specific debug events that already exist.

## Progress

- [x] 2026-03-29 19:08Z: Audited the catch-all dispatcher, route registry, and debug event persistence flow.
- [x] 2026-03-29 19:15Z: Added shared route lifecycle instrumentation for registered routes and catch-all 404/405 outcomes.
- [x] 2026-03-29 19:16Z: Added targeted tests for completed, rejected, failed, and thrown route outcomes.
- [ ] Verify rerun-setup failures surface in Debug > Events in the running desktop app.

## Surprises & Discoveries

- Observation: `apps/app/components/dashboard/setup-wizard/index.tsx` swallows failed responses and advances to step 3 regardless of status.
  Evidence: `handleSaveAndContinue` does not check `response.ok` and calls `setStep(3)` in `finally`.
- Observation: Almost every migrated API route already goes through `apps/app/app/api/[...path]/route.ts`; only `apps/app/app/api/mcp/tools.ts` sits outside that request path and is not itself a Next route handler.
- Observation: `pnpm --filter @radarboard/desktop build:sidecar` is currently blocked by unrelated settings-section typing drift already present in the worktree.
  Evidence: the latest failure is `apps/app/components/dashboard/dashboard/index.tsx` calling `handleSettingsSectionChange("infrastructure")` even though `SettingsSection` only includes `"advanced"`.

## Decision Log

- Decision: Instrument at the shared catch-all route boundary instead of adding `emitDebugEvent` manually to every route.
  Rationale: This covers existing registered routes immediately and keeps future registered routes covered by default.
  Date/Author: 2026-03-29 / Codex

## Outcomes & Retrospective

The shared catch-all API boundary now emits route lifecycle debug events for started, completed, rejected, failed, not-found, and method-not-allowed outcomes. This covers all registered routes automatically, including future routes added through `registerRoutes()`.

The route-debug change is validated with targeted Vitest coverage and biome checks. Full desktop build verification is currently blocked by unrelated settings-section type errors in the existing dirty worktree, so in-app manual verification is still pending.

## Context and Orientation

Radarboard's migrated API routes are registered through `apps/app/lib/router/registry.ts` and dispatched via `apps/app/app/api/[...path]/route.ts`. The debug event pipeline is implemented in `apps/app/lib/system/events/debug-events.ts` and persists rows through the configured debug repository in `apps/app/data/core/repository.ts`.

The current failure mode is that route handlers can return 4xx/5xx responses without creating debug events unless the handler explicitly emits its own events. Setup rerun in the dashboard uses `apps/app/components/dashboard/setup-wizard/index.tsx`, which calls `/api/system/database/config` and `/api/system/database/migrate` through this shared route boundary.

## Plan of Work

Add a small route instrumentation helper under `apps/app/lib/router/` that wraps a route handler invocation with `emitDebugEvent` calls. The helper should emit:

1. `route.request.started` before the handler runs.
2. `route.request.completed` for 2xx/3xx responses.
3. `route.request.rejected` for 4xx responses.
4. `route.request.failed` for 5xx responses or thrown exceptions.

The wrapper should record the request method, matched route path, actual URL path, query params, route params, duration, status code, and a safe preview of error bodies when available. Then wire the catch-all dispatcher to use that wrapper for matched routes and to emit debug events for 404 and 405 outcomes as well.

## Concrete Steps

From `/Users/thedaviddias/Projects/radarboard`:

1. Edit `apps/app/lib/router/types.ts` and `apps/app/lib/router/registry.ts` so `matchRoute()` returns the matched route path/pattern.
2. Add a route lifecycle wrapper under `apps/app/lib/router/`.
3. Update `apps/app/app/api/[...path]/route.ts` to use the wrapper and log 404/405 outcomes.
4. Add tests under `apps/app/lib/router/__tests__/`.
5. Run targeted Vitest for the new wrapper.

## Validation and Acceptance

Acceptance criteria:

- A successful registered route request produces a `route.request.started` event and a `route.request.completed` event in the debug repository.
- A registered route returning 4xx produces a `route.request.rejected` event with the status code.
- A registered route returning 5xx or throwing produces a `route.request.failed` event with the error/status metadata.
- Unknown paths and method mismatches generate debug events too.
- The rerun-setup APIs are covered by this shared instrumentation path automatically.
- Debug event coverage for rerun-setup still requires a manual run in the app once the unrelated dashboard/settings type errors in the worktree are cleared.

Validation commands:

- `pnpm --filter @radarboard/app exec vitest run lib/router/__tests__/route-debug.test.ts`
- `pnpm --filter @radarboard/desktop build:sidecar`

## Idempotence and Recovery

The instrumentation edits are safe to rerun and safe to validate repeatedly. If the wrapper causes noisy or incorrect debug events, recovery is to revert the route wrapper file and the catch-all integration together; the debug event schema itself is unchanged.

## Artifacts and Notes

- Current desktop dev logs live at `/Users/thedaviddias/Library/Logs/com.radarboard.client.dev/Radarboard Dev.log`.
- The dashboard rerun-setup failure path currently does not surface route status in the UI, so Debug > Events becomes the primary in-product inspection surface after this change.

## Interfaces and Dependencies

- `apps/app/lib/router/types.ts`: route match contract
- `apps/app/lib/router/registry.ts`: route matching for registered handlers
- `apps/app/app/api/[...path]/route.ts`: shared Next.js API entrypoint
- `apps/app/lib/system/events/debug-events.ts`: debug event persistence
- `apps/app/data/core/repository.ts`: debug repository resolution

Revision note: 2026-03-29. Created during implementation after confirming the shared catch-all route boundary is the correct instrumentation point.

Revision note: 2026-03-29. Updated after implementation to record the completed shared wrapper work, targeted test coverage, and the unrelated build blocker that still prevents full desktop verification.
