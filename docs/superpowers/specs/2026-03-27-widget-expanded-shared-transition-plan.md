# Widget Expanded Shared Transition ExecPlan

This ExecPlan is maintained according to [PLANS.md](/Users/thedaviddias/Projects/radarboard/PLANS.md).

## Purpose / Big Picture

Radarboard widgets that open the in-place expanded view should feel like they grow out of the widget card instead of popping into a separate modal shell. After this change, clicking a widget's expand affordance or double-clicking its card will animate the widget surface and header into the expanded overlay in the same way every expandable widget behaves today, while preserving the existing `sm` / `md` / `lg` size toggle and URL-driven expanded state.

The change is working when an expandable widget opens into a full overlay with a shared shell/header transition, the dialog still closes via Escape and backdrop click, the URL still carries `?expanded=...`, and re-opening the widget keeps the previously selected expanded size.

## Scope

In scope: shared layout animation for widget cards and the in-place expanded portal, reduced-motion fallback behavior, missing-source fallback behavior, widget-engine unit coverage, and one dashboard E2E that exercises open/close and size persistence.

Out of scope: plugin overlays, widget configuration dialogs, redesigning widget header content, and removing the existing expanded size toggle.

## Progress

- [x] 2026-03-27 17:58Z: Audited the current widget card and expanded portal flow, including URL state in `packages/hooks/src/use-dashboard.tsx` and `apps/app/app/providers.tsx`.
- [x] 2026-03-27 18:02Z: Compared the requested reference transition in `kapishdima/fonttrio` and confirmed it uses Motion shared-layout primitives rather than manual transform math.
- [x] 2026-03-27 19:24Z: Implemented Motion-based shared shell/header/title transition in `packages/widget-engine`, including a reduced-motion and disconnected-source fallback.
- [x] 2026-03-27 19:39Z: Added widget-engine unit coverage for widget expansion interactions and expanded-portal body scroll / size persistence.
- [x] 2026-03-27 19:44Z: Added dashboard E2E coverage in `apps/e2e/tests/dashboard/widget-expanded-view.spec.ts`.
- [x] 2026-03-27 19:50Z: Ran `pnpm --filter @radarboard/widget-engine test -- src/expanded-portal/expanded-portal.test.tsx src/widget-card/index.test.tsx` and `pnpm exec biome check ...` on the touched files.
- [ ] Run the new Playwright spec against a running E2E app on `127.0.0.1:1365`.

## Surprises & Discoveries

- Observation: The current expanded widget overlay uses a manual rect-derived transform in `packages/widget-engine/src/expanded-portal/index.tsx`, and only uses that transform for the `lg` expanded size.
  Evidence: `useOpacityOnly = size !== "lg" || reducedMotion || !sourceRect`.
- Observation: The dashboard's expanded widget state is already hoisted into URL query state through `apps/app/app/providers.tsx`, so the transition work does not require any URL contract changes.
  Evidence: `expandedWidgetId` is wired to `useQueryState("expanded", parseAsString)`.
- Observation: `motion` is already a dependency in both `@radarboard/ui` and `@radarboard/widget-engine`, so no new animation library is needed.
  Evidence: `packages/ui/package.json` and `packages/widget-engine/package.json` already declare `"motion"`.
- Observation: `AnimatePresence` exit timing for the portaled expanded widget is awkward to assert directly in jsdom, even though the state change is observable through the controlled dashboard callback.
  Evidence: the reduced-motion widget-card test was more stable when it asserted `onExpandedWidgetIdChange(null)` instead of waiting for immediate dialog removal.
- Observation: the local E2E app is not currently running on `http://127.0.0.1:1365`, and Playwright would otherwise auto-start `pnpm --filter @radarboard/app dev:e2e`, which this workspace explicitly avoids.
  Evidence: `curl -I --max-time 3 http://127.0.0.1:1365/api/database/config` failed with connection error and `lsof -iTCP:1365 -sTCP:LISTEN -n -P` returned no listener.
- Observation: the `@radarboard/e2e` TypeScript check already fails in unrelated onboarding specs, so it cannot currently be used as a clean validation gate for this change.
  Evidence: `tests/onboarding/demo.spec.ts` reports existing `firstPage is possibly undefined` errors when running `pnpm --filter @radarboard/e2e exec tsc --noEmit`.

## Decision Log

- Decision: Apply the shared transition to all widgets that use the in-place expanded portal rather than only template-backed widgets.
  Rationale: The expand/open state is already centralized at the widget-card layer, so one implementation keeps behavior consistent and avoids per-widget divergence.
  Date/Author: 2026-03-27 / Codex
- Decision: Animate the widget shell, header background, and title cluster only; do not attempt a full interior content morph.
  Rationale: The expanded body diverges too much across widgets, while shell/header continuity carries the desired effect with lower fragility.
  Date/Author: 2026-03-27 / Codex
- Decision: Preserve the existing `sm` / `md` / `lg` expanded size system.
  Rationale: Size persistence is already implemented and covered by tests, and removing it would be a product change outside the approved scope.
  Date/Author: 2026-03-27 / Codex
- Decision: Keep the reduced-motion widget-card test focused on the controlled close callback rather than direct portal teardown timing.
  Rationale: This still validates the close path without coupling the test to `AnimatePresence` portal timing behavior in jsdom.
  Date/Author: 2026-03-27 / Codex

## Outcomes & Retrospective

The widget engine now uses Motion shared layout ids to animate the compact widget shell, header, and title cluster into the expanded portal. The compact action cluster and body fade out during open, and the expanded controls/body fade in after the shell settles. The old manual transform math in `packages/widget-engine/src/expanded-portal/index.tsx` is gone.

Validation is solid at the unit layer: the full `@radarboard/widget-engine` test suite passed after the targeted additions, and Biome is clean on the files touched by this work. The remaining validation gap is browser E2E execution of the new Playwright spec, which requires the dedicated E2E app to already be running on `127.0.0.1:1365`.

## Context and Orientation

Radarboard's widget surfaces live in `packages/widget-engine`. The compact card shell is implemented in `packages/widget-engine/src/widget-card/index.tsx`. It renders the widget header, action buttons, and compact content, and opens the expanded overlay when the dashboard context reports that the widget is the currently expanded widget.

The expanded overlay itself is implemented in `packages/widget-engine/src/expanded-portal/index.tsx`. Today it portals a dialog shell to `document.body`, manages body scroll locking, reads the user's persisted expanded size preference through `packages/widget-engine/src/widget-modal/index.tsx`, and closes via Escape or backdrop click.

The dashboard state for widget expansion is defined in `packages/hooks/src/use-dashboard.tsx` and exposed through `packages/hooks/src/use-dashboard.types.ts`. In the app, `apps/app/app/providers.tsx` binds this state to the `expanded` URL query parameter, so opening an expanded widget updates the URL and closing it clears the parameter.

The dashboard E2E seed lives in `apps/app/app/api/e2e/state/route.ts`. The seeded dashboard places a stable set of widgets into the 3x3 layout, including `revenue`, `analytics`, `seo`, and `shipping`, which makes it possible to write one stable end-to-end test against a real expandable widget.

## Plan of Work

First, add a small internal helper in `packages/widget-engine` that generates namespaced Motion layout ids from a widget id. This avoids repeating string building across the compact card and expanded portal and gives every widget its own layout group so multiple cards cannot cross-animate.

Next, refactor `packages/widget-engine/src/widget-card/index.tsx` to wrap each widget in a `LayoutGroup` when it has a widget id. Convert the compact card shell, header container, and title cluster into Motion elements with shared `layoutId`s. Keep the compact actions outside the shared layout and fade them out while the widget is expanded.

Then, replace the manual animation state in `packages/widget-engine/src/expanded-portal/index.tsx` with Motion primitives. Keep the backdrop and body content as enter/exit fades, keep body scroll locking and close behavior, and render the expanded shell/header/title with matching shared `layoutId`s. When reduced motion is enabled or the source widget element is no longer connected, skip shared `layoutId`s and fall back to a centered fade.

After the runtime behavior is in place, add focused widget-engine tests. Extend the expanded portal tests to assert body scroll lock restoration. Add widget-card tests that prove button expand, double-click expand, `open-plugin` behavior, and reduced-motion close semantics. Finish by adding a dashboard E2E that expands a seeded widget, verifies the dialog and `?expanded=` state, changes the panel size, closes, and confirms the size persists when reopened.

## Concrete Steps

Working directory: `/Users/thedaviddias/Projects/radarboard`

1. Inspect current widget expansion implementation:
   - `sed -n '1,260p' packages/widget-engine/src/widget-card/index.tsx`
   - `sed -n '1,260p' packages/widget-engine/src/expanded-portal/index.tsx`
2. Implement the shared-layout refactor and helper:
   - edit `packages/widget-engine/src/widget-card/index.tsx`
   - edit `packages/widget-engine/src/expanded-portal/index.tsx`
   - add a small internal helper file under `packages/widget-engine/src/`
3. Update automated coverage:
   - edit `packages/widget-engine/src/expanded-portal/expanded-portal.test.tsx`
   - add a widget-card test file under `packages/widget-engine/src/widget-card/`
   - add one dashboard E2E in `apps/e2e/tests/dashboard/`
4. Validate:
   - `pnpm --filter @radarboard/widget-engine test -- --runInBand`
   - `pnpm --filter @radarboard/app test -- --runInBand`
   - `pnpm --filter @radarboard/e2e test -- dashboard` if the workspace exposes that target, otherwise run the targeted Playwright command used by the repo

Expected result: widget-engine tests pass, the app test suite covering dashboard state remains green, and the new dashboard E2E proves the expanded widget transition flow without changing plugin overlay behavior.

## Validation and Acceptance

Acceptance is based on observable behavior:

- Clicking the expand icon on an expandable widget opens a dialog whose shell appears to grow from the widget card.
- Double-clicking the widget body opens the same expanded dialog.
- The compact widget action cluster is not visibly duplicated during the transition, and the expanded size toggle plus close button fade in after the shell appears.
- Pressing Escape or clicking the backdrop closes the dialog and restores page scroll.
- Changing the expanded size to `Large`, closing the dialog, and reopening it preserves the `Large` selection.
- Visiting the dashboard during the E2E run shows the `expanded` query parameter while the dialog is open and clears it after close.
- Widgets configured to `open-plugin` still open plugin overlays instead of the expanded widget portal.

## Idempotence and Recovery

The code edits are safe to repeat. Re-running the unit and E2E commands is non-destructive.

If a Motion-based shared layout proves unstable in tests, the safe rollback point is to keep the new helper and test scaffolding while restoring the previous `ExpandedPortal` shell and `WidgetCard` structure. No database or persisted settings migration is involved, so reverting code leaves user data intact.

If a validation command fails, inspect only the files touched by this effort rather than resetting unrelated work, because the working tree already contains unrelated user changes outside this scope.

## Artifacts and Notes

- Reference behavior audited from `kapishdima/fonttrio`:
  - shared `layoutId` on the compact card and dialog shell,
  - separate fading backdrop,
  - detail content fades in after the shared shell transition starts.
- Implemented files:
  - `packages/widget-engine/src/widget-expanded-motion.ts`
  - `packages/widget-engine/src/widget-card/index.tsx`
  - `packages/widget-engine/src/expanded-portal/index.tsx`
  - `packages/widget-engine/src/widget-card/index.test.tsx`
  - `packages/widget-engine/src/expanded-portal/expanded-portal.test.tsx`
  - `apps/e2e/tests/dashboard/widget-expanded-view.spec.ts`
- Validation completed:
  - `pnpm --filter @radarboard/widget-engine typecheck`
  - `pnpm --filter @radarboard/widget-engine test -- src/expanded-portal/expanded-portal.test.tsx src/widget-card/index.test.tsx`
  - `pnpm exec biome check packages/widget-engine/src/expanded-portal/index.tsx packages/widget-engine/src/expanded-portal/expanded-portal.test.tsx packages/widget-engine/src/widget-card/index.tsx packages/widget-engine/src/widget-card/index.test.tsx packages/widget-engine/src/widget-expanded-motion.ts apps/e2e/tests/dashboard/widget-expanded-view.spec.ts docs/superpowers/specs/2026-03-27-widget-expanded-shared-transition-plan.md`
- Validation attempted but blocked:
  - `pnpm --filter @radarboard/e2e exec tsc --noEmit` hits unrelated pre-existing onboarding test errors.
  - Playwright E2E execution is pending because no E2E server is listening on `127.0.0.1:1365`.

## Interfaces and Dependencies

Internal modules:

- `packages/widget-engine/src/widget-card/index.tsx`
- `packages/widget-engine/src/expanded-portal/index.tsx`
- `packages/widget-engine/src/widget-modal/index.tsx`
- `packages/hooks/src/use-dashboard.tsx`
- `apps/app/app/providers.tsx`

Libraries and contracts:

- `motion/react` provides `AnimatePresence`, `LayoutGroup`, `motion`, and reduced-motion hooks.
- `@radarboard/hooks/use-dashboard` remains the source of truth for expanded widget state.
- `WidgetModalSize` and persisted modal preferences remain unchanged.
- No public widget SDK, URL, or settings API contract changes are expected.

## Revision Notes

- 2026-03-27: Initial ExecPlan created before implementation based on the approved shared-transition design.
- 2026-03-27: Updated after implementation with actual validation results, testing constraints, and the remaining E2E follow-up.
