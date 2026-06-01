# Stabilize Demo Dashboard

This ExecPlan is maintained according to `PLANS.md`.

## Purpose / Big Picture

Radarboard demo mode should showcase a full dashboard with stable sample data. After this work, entering demo mode shows SEO metrics and notifications immediately, the dashboard does not flicker after a few seconds, and the Demo badge offers clear paths to either connect real services or start fresh.

The visible proof is a fresh dev install entering demo mode, showing populated cards without repeated blanking, and letting the user leave demo mode through explicit actions.

## Scope

In scope: SEO demo data wiring, demo-mode cache revalidation behavior, demo notification fallback UI, notification dropdown opacity, and Demo badge exit actions.

Out of scope: moving extension packages, changing the community extension catalog, redesigning onboarding, or seeding fake notifications into the persistent notification database.

## Progress

- [x] 2026-05-31 23:06Z: Inspected SEO, demo cache, notification, and demo exit wiring.
- [x] 2026-05-31 23:06Z: Confirmed demo notifications should be UI fallback only and demo exit should expose both connect and fresh-start actions.
- [x] 2026-05-31 23:16Z: Passed demo mode into SEO widget rendering and data resolving.
- [x] 2026-05-31 23:18Z: Replaced repeated demo SWR cache deletion with event-driven revalidation.
- [x] 2026-05-31 23:25Z: Added demo notification fallback and opaque dropdown surface.
- [x] 2026-05-31 23:30Z: Added explicit Connect real services and Start fresh actions.
- [x] 2026-05-31 23:31Z: `pnpm --filter @radarboard/widget-seo test` passed.
- [x] 2026-05-31 23:31Z: `pnpm --filter @radarboard/feature-notifications test` passed.
- [x] 2026-05-31 23:32Z: `pnpm --filter @radarboard/app test` passed.
- [x] 2026-05-31 23:35Z: Targeted typechecks passed for app, widget-engine, and feature-notifications; widget-seo has no typecheck script.
- [x] 2026-05-31 23:37Z: Browser smoke pass against `http://radarboard.localhost:1355` confirmed SEO data, demo notifications, stable widgets after wait, and both demo exit actions.
- [x] 2026-05-31 23:47Z: Added demo plugin exposure for Tasks, Notes, and Bookmarks, with in-memory demo edits that do not write to plugin storage.
- [ ] `pnpm test:e2e -- --grep @onboarding` needs a clean rerun after its Playwright web server responds; the attempted run hung waiting for HTTP and was stopped.

## Surprises & Discoveries

- SEO already supports a `demoMode` argument in `widgets/seo/src/hooks/use-seo.ts`, but current call sites do not pass it.
- Dashboard demo refresh currently deletes matching SWR cache entries and revalidates four times after demo mode starts, which matches the reported flicker.
- `packages/widget-engine/src/demo/data/notifications.ts` already contains mock notification content, but the app notification center does not consume it.
- The top-bar Demo badge currently maps “Connect services” to rerunning setup and “Dismiss demo” to cache wipe/preference update, which does not clearly communicate fresh versus real-data paths.

## Decision Log

- Decision: Demo notifications will be derived from existing mock data in UI state only.
  Rationale: This avoids writing fake rows into the notification database while still making demo mode feel active.
  Date/Author: 2026-05-31 / Codex
- Decision: Demo exit will expose both “Connect real services” and “Start fresh”.
  Rationale: The user needs an obvious path to either preserve the demo layout and connect data, or reset into onboarding.
  Date/Author: 2026-05-31 / Codex

## Outcomes & Retrospective

SEO, cache refresh, notifications, and demo exit code paths have been updated. Unit tests, targeted typechecks, and a browser smoke pass succeeded. The onboarding E2E grep could not complete because its Playwright-managed web server accepted TCP on port 1365 but did not return HTTP responses.

## Context and Orientation

The main dashboard is implemented in `apps/app/components/dashboard/dashboard/index.tsx`. It renders the `TopBar` from `packages/widget-engine/src/chrome/top-bar/index.tsx` and injects `NotificationCenter` from `apps/app/modules/provider-shell/notification-center.tsx`.

Demo seed and wipe routes live in `apps/app/modules/demo-shell/routes/seed.ts` and `apps/app/modules/demo-shell/routes/wipe.ts`. Demo seed writes sample API responses into the app cache and sets `preferences.demoMode=true`.

The SEO widget lives in `widgets/seo`. Its hook already accepts a `demoMode` boolean that appends `demo=1` to the Google Search Console integration route. The compact, expanded, and data-resolver call sites must provide that flag.

Notifications are rendered by `features/notifications/src/components/notification-center-view.tsx` and `features/notifications/src/components/notification-dropdown.tsx`. The app fetches real notifications via `packages/hooks/src/use-notifications.ts`.

## Plan of Work

First, wire SEO call sites to `useDemoMode()` so the existing demo route behavior is used consistently.

Second, change dashboard demo data refresh so it revalidates matching SWR keys once after the demo seed event without deleting populated cache entries or scheduling repeated timeouts.

Third, add a demo notification adapter in the app notification center. When demo mode is active and the real feed is empty, convert `MOCK_NOTIFICATIONS` into `NotificationFeedItem` objects, keep local read/dismiss state, and pass those items to the existing notification UI. Make the dropdown background opaque.

Fourth, split demo exit actions in the app helper and top bar. “Connect real services” wipes demo cache, exits demo mode, and opens Settings > Integrations. “Start fresh” confirms, wipes demo cache with fresh mode, exits demo mode, clears session onboarding guards, and opens onboarding in first-run mode.

## Concrete Steps

Run all commands from `/Users/thedaviddias/Projects/radarboard`.

1. Edit the SEO components and data resolver to pass `isDemoMode` into `useSeo`.
2. Edit the dashboard demo revalidation effect to remove the repeated timeout loop.
3. Edit notification center and dropdown components for demo fallback and opaque surface.
4. Edit demo data actions, wipe route, top bar props, and dashboard wiring for explicit demo exits.
5. Run:

```sh
pnpm --filter @radarboard/widget-seo test
pnpm --filter @radarboard/feature-notifications test
pnpm --filter @radarboard/app test
pnpm test:e2e -- --grep @onboarding
```

## Validation and Acceptance

Acceptance is observable in the running app:

- In demo mode, SEO Performance renders sample SEO metrics instead of staying on `Loading...`.
- Opening notifications in demo mode shows fake unread items when the real feed is empty.
- The notification dropdown visually blocks the dashboard behind it.
- After waiting at least five seconds in demo mode, widgets do not repeatedly blank or dim from scheduled demo cache invalidations.
- “Connect real services” exits demo mode and opens Settings > Integrations.
- “Start fresh” asks for confirmation and then reopens onboarding from a clean state.

## Idempotence and Recovery

The code edits are safe to repeat. The demo wipe route clears cache data and updates layout preferences; this is expected in development but should not be called automatically outside explicit user actions.

If tests fail due to unrelated existing migration work, record the failure and keep the implementation scoped to the files touched by this plan.

## Artifacts and Notes

Screenshots provided by the user show SEO stuck loading, an empty translucent notifications dropdown over the Revenue widget, and widgets dimming/flickering after a short delay.

Validation artifacts:

- `pnpm --filter @radarboard/widget-seo test`: 5 files, 43 tests passed.
- `pnpm --filter @radarboard/feature-notifications test`: 1 file, 6 tests passed.
- `pnpm --filter @radarboard/app test`: 166 files, 1155 tests passed.
- `pnpm --filter @radarboard/app typecheck`: passed.
- `pnpm --filter @radarboard/widget-engine typecheck`: passed.
- `pnpm --filter @radarboard/feature-notifications typecheck`: passed.
- Browser smoke with `agent-browser`: SEO rows rendered, fake notification `PR #142 merged` rendered, widgets stayed populated after a six-second wait, and Demo badge showed `Connect real services` plus `Start fresh`.
- Demo plugin follow-up: Tasks, Notes, and Bookmarks are enabled in demo even when no plugin preference exists. Their sample data can be edited during the session without persisting to plugin storage.

## Interfaces and Dependencies

The implementation uses existing packages and interfaces:

- `@radarboard/hooks/use-demo-mode` for read-only demo mode.
- `@radarboard/types/notifications` for `NotificationFeedItem`.
- `@radarboard/widget-engine/demo` for `MOCK_NOTIFICATIONS`.
- `API_ROUTES.demoWipe` for explicit demo exit actions.
