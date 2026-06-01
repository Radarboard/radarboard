# Improve Dark Theme Readability

This ExecPlan is maintained according to `PLANS.md`.

## Purpose / Big Picture

Radarboard's dark UI should stay dense while remaining readable. The current app fallback theme and typography tokens allow readable text to render too dark and too small, especially in settings, app chrome, assistant panels, widgets, and plugin surfaces. After this work, readable UI text has a 12px minimum, the default dark dim token matches the contrast-tested theme package, and a consistency check prevents regressions.

Users can see the result by opening the dashboard and settings modal in dark mode at `http://radarboard.localhost:1355`: muted labels, descriptions, form controls, cards, widgets, and assistant surfaces should be visibly lighter and no readable text should look microscopic.

## Scope

In scope: `apps/app` product surfaces, `packages/ui` shared primitives, `packages/assistant-ui`, `packages/widget-engine`, `packages/plugin-sdk`, first-party widgets/plugins that consume the app tokens, and `scripts/check-ui-consistency.ts`.

Out of scope: `apps/marketing`, `apps/docs`, database/API changes, route behavior, and new user-facing settings.

## Progress

- [x] 2026-05-31 13:35Z: Audited settings screenshot, app theme fallbacks, theme package contrast tests, and shared settings primitives.
- [x] 2026-05-31 13:40Z: Chose 12px as the minimum readable UI text size and app/dashboard surfaces as the implementation scope.
- [x] 2026-05-31 13:37Z: Update global app text tokens and default dark fallback contrast.
- [x] 2026-05-31 13:39Z: Update shared UI primitives and high-impact product surfaces to use readable semantic text classes.
- [x] 2026-05-31 13:43Z: Extend UI consistency checks to block small readable text and low-opacity text regressions.
- [x] 2026-05-31 13:48Z: Run automated validation commands.
- [ ] Manually inspect the running app without starting a new dev server.

## Surprises & Discoveries

- Observation: `packages/themes` has a contrast-tested `radarboardDark` dim token of `#858585`, but `apps/app/app/globals.css` falls back to `#777777`.
  Evidence: `packages/themes/src/index.ts` and `apps/app/app/globals.css` define different values.
- Observation: `text-w-xs` and `text-w-sm` are currently container-query based and can render at 9-11px.
  Evidence: `apps/app/app/globals.css` defines `--widget-font-xs: clamp(9px, 2.5cqi, 10px)` and `--widget-font-sm: clamp(10px, 3cqi, 11px)`.
- Observation: The documented portless dashboard host is listening but currently returns a 404, and no Radarboard `next dev` process is running.
  Evidence: Playwright opened `http://radarboard.localhost:1355` and received `404 - Not Found`; `ps -ax` showed the portless proxy but no Radarboard Next dev server.

## Decision Log

- Decision: Keep the six-step `text-w-*` contract but raise the minimum readable floor instead of introducing a new token family.
  Rationale: Most app surfaces already use semantic text tokens; changing the token values improves many surfaces with less churn.
  Date/Author: 2026-05-31 / Codex
- Decision: Allow small physical sizes only for icons, dimensions, and hidden screen-reader text, not visible readable text.
  Rationale: The reported issue is visible text readability; non-text sizing utilities should remain available.
  Date/Author: 2026-05-31 / Codex
- Decision: Scope legacy component-consistency rules to plugins/widgets while applying the new readable text rule to app, shared UI, assistant UI, widget engine, plugins, and widgets.
  Rationale: Expanding the old rules to `@radarboard/ui` incorrectly flags the package that defines the shared components.
  Date/Author: 2026-05-31 / Codex

## Outcomes & Retrospective

Implemented the token floor, fallback contrast fix, broad class cleanup, and consistency guardrail. Automated validation passed. Manual browser inspection is still pending because the local app target is not serving the dashboard and the project instructions say not to start dev servers automatically.

## Context and Orientation

The app-wide Tailwind theme is defined in `apps/app/app/globals.css`. It maps semantic color variables and text tokens such as `text-w-xs`, `text-w-sm`, and `text-w-base` to CSS custom properties. `ThemeBridge` in `apps/app/components/theme/theme-bridge.tsx` applies theme package variables from `packages/themes/src/index.ts` to the document element.

Shared controls live in `packages/ui/src`. Settings surfaces live under `apps/app/components/settings`. Assistant UI lives in `packages/assistant-ui/src`. Widget rendering lives in `packages/widget-engine/src`, with first-party widgets under `widgets/` and plugins under `plugins/`.

`scripts/check-ui-consistency.ts` currently checks extension component consistency. This work extends it into a broader UI readability guardrail.

## Plan of Work

First update `apps/app/app/globals.css` so the fallback dark dim token matches the contrast-tested default theme and all widget/app text tokens use stable minimum sizes instead of container-query values. Preserve `data-font-scale` while clamping the small scale to a readable floor.

Next update shared primitives in `packages/ui/src` so common controls no longer emit `text-xs`, `text-sm`, or low-opacity text for readable labels. Then clean the most common app, settings, assistant, widget-engine, plugin, and widget classes that visibly use low-opacity text or raw Tailwind text sizes.

Finally extend `scripts/check-ui-consistency.ts` to scan product UI source files for readable text regressions. The check should flag `text-xs`, `text-sm`, arbitrary text-size utilities, and low-opacity semantic text classes in visible source, while allowing dimensions, icons, disabled states, `sr-only`, generated stories/tests, and explicit internal exceptions where the class is not visible readable text.

## Concrete Steps

Run from `/Users/thedaviddias/Projects/radarboard`:

1. Edit `apps/app/app/globals.css`, `packages/ui/src`, app settings/chrome files, `packages/assistant-ui/src`, `packages/widget-engine/src`, widgets/plugins as needed, and `scripts/check-ui-consistency.ts`.
2. Run `pnpm --filter @radarboard/themes test`; expect all tests to pass.
3. Run `pnpm --filter @radarboard/ui test`; expect all tests to pass.
4. Run `pnpm --filter @radarboard/app typecheck`; expect TypeScript to pass.
5. Run `pnpm --filter @radarboard/assistant-ui typecheck`; expect TypeScript to pass.
6. Run `pnpm check:ui-consistency`; expect the guardrail to pass.
7. Use the already-running app at `http://radarboard.localhost:1355` to inspect settings, dashboard, assistant, widget, and plugin surfaces in dark mode. If it returns a 404, do not start a dev server automatically; record the blocker and run the manual check when the user restarts their continuous dev server.

## Validation and Acceptance

Automated acceptance: all commands in the Concrete Steps section pass, except manual browser inspection when the user-managed dev server is unavailable.

Manual acceptance: in dark mode, visible readable text in settings, app chrome, assistant UI, widgets, and plugin surfaces is at least 12px, muted text is visibly lighter than the screenshot, and no horizontal overflow is introduced.

## Idempotence and Recovery

The validation commands are safe to repeat. The UI consistency script is read-only. If a class replacement causes layout problems, restore that specific class from git diff context and replace it with the closest semantic `text-w-*` token instead of reverting unrelated user changes.

No destructive commands or migrations are required.

## Artifacts and Notes

The initial audit confirmed that the theme package contrast test already passes, but the app fallback token and opacity usage can still fail effective contrast in the running app.

Validation transcript summary:

- `pnpm --filter @radarboard/themes test`: passed, 1 file and 8 tests.
- `pnpm --filter @radarboard/ui test`: passed, 4 files and 5 tests.
- `pnpm --filter @radarboard/app typecheck`: passed.
- `pnpm --filter @radarboard/assistant-ui typecheck`: passed.
- `pnpm check:ui-consistency`: passed after running outside the sandbox because `tsx` needed an IPC pipe under `/var/folders`.
- `pnpm react-doctor`: started but emitted no diagnostics for over a minute; the process chain started by this turn was stopped and the check is not counted as passing.

## Interfaces and Dependencies

No public API, route, or database interfaces change. The CSS token contract changes only in rendered values: `text-w-xs` and `text-w-sm` become readable at 12px minimum, while the existing class names remain valid.
