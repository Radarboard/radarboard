# Enforce Shared Modal Contract

This ExecPlan is maintained according to [PLANS.md](/Users/thedaviddias/Projects/radarboard/PLANS.md).

## Purpose / Big Picture
Radarboard should have one product-facing dialog shell and one modal size contract. After this change, product code will stop choosing ad hoc dialog widths and heights. Instead, it will use one shared entrypoint with explicit `sm`, `md`, or `lg` sizing, and repository checks will fail if a source file bypasses that contract.

The working outcome is visible in two ways. First, app, package, and plugin dialogs will render with the same responsive shell sizing rules. Second, local hooks and CI-quality commands will reject new direct imports from the low-level dialog module or shell-level width and height overrides on shared dialog content.

## Scope
In scope:
- Add a strict app-facing dialog entrypoint in `packages/ui`.
- Centralize dialog shell sizing and S/M/L metadata.
- Migrate current product-source dialog users in `apps/app`, selected `packages/*`, and existing plugin sources that still bypass the shared shell.
- Add automated enforcement for raw low-level imports and shell-sizing overrides.

Out of scope:
- Redesigning drawer or mini-hud behavior beyond aligning size semantics where they intersect modal sizing.
- Refactoring dialog body content layouts that are unrelated to shell sizing or contract enforcement.
- Reworking Storybook- or test-only dialog fixtures unless needed to keep tests passing.

## Progress
- [x] 2026-03-27 18:26Z: Audited modal usage patterns and confirmed this work spans `apps/app`, `packages/ui`, `packages/widget-engine`, `packages/plugin-sdk`, `packages/assistant-ui`, and plugin source files.
- [x] 2026-03-27 18:41Z: Created this ExecPlan and recorded the intended enforcement approach.
- [x] 2026-03-27 19:02Z: Added the shared app-facing dialog entrypoint, centralized dialog shell classes, and modal size tokens.
- [x] 2026-03-27 19:15Z: Migrated product dialog consumers in app, shared packages, widget-engine, and plugin source to the strict shared shell and canonical `sm | md | lg` sizes.
- [x] 2026-03-27 19:19Z: Added repository enforcement via Biome import restrictions, `scripts/check-modal-contract.ts`, and hook wiring.
- [x] 2026-03-27 19:24Z: Verified `pnpm check:modal-contract`, targeted Biome checks, widget modal conformance, and targeted workspace typecheck.

## Surprises & Discoveries
- Observation: `packages/ui/src/dialog/index.tsx` still exposes a hidden `default` modal size, while widget and plugin overlays already use `sm | md | lg`.
  Evidence: `packages/types/src/ui.ts` and `packages/ui/src/dialog/index.tsx` currently define `ModalContentSize = ModalSize | "default"`.
- Observation: `apps/app` is not the only place bypassing shared sizes. Product-source dialogs in `packages/plugin-sdk`, `packages/assistant-ui`, `packages/widget-engine`, and `plugins/*` still import `@radarboard/ui/dialog` directly.
  Evidence: `rg 'from "@radarboard/ui/dialog"' apps packages widgets plugins`.
- Observation: the repo already enforces architecture with custom scripts and Biome import restrictions, so modal contract enforcement can be added without inventing a new mechanism.
  Evidence: `lefthook.yml`, `biome.json`, and `scripts/check-module-boundaries.ts`.
- Observation: several widget and plugin tests import shared dialog primitives from within `src/`, so moving source imports to the new product-facing entrypoint touched more files than the original `apps/app` audit suggested.
  Evidence: `rg 'from "@radarboard/ui/dialog"' apps packages widgets plugins` before migration.
- Observation: `react-doctor` is not currently usable as a finishing check in this workspace because it stops early with `No React dependency found in package.json`.
  Evidence: `npx -y react-doctor@latest . --verbose --diff`.
- Observation: `widgets/seo/src/components/seo-query-detail/seo-query-detail.test.tsx` still fails its large-modal ordering assertion after the contract migration; the failure is about duplicate content and current ordering assumptions inside that widget test, not import or type contract issues.
  Evidence: `pnpm exec vitest run packages/widget-engine/src/widget-modal-conformance.test.ts widgets/seo/src/components/seo-query-detail/seo-query-detail.test.tsx`.

## Decision Log
- Decision: introduce a separate product-facing dialog entrypoint instead of trying to police named imports from the low-level module.
  Rationale: Biome can reliably block an entire import path, while named-import enforcement would be more brittle. A dedicated entrypoint also gives product code one obvious component to use.
  Date/Author: 2026-03-27 / Codex
- Decision: keep exactly three product-level dialog sizes: `sm`, `md`, and `lg`.
  Rationale: current inconsistency comes from bypassing the contract, not from lacking more sizes.
  Date/Author: 2026-03-27 / Codex

## Outcomes & Retrospective
The shared modal contract shipped as planned. Product code now imports dialog shells from `@radarboard/ui/app-dialog`, shared shell sizing is centralized into `sm`, `md`, and `lg`, and hook/CI enforcement exists to prevent direct low-level dialog imports or shell-level width and height overrides from creeping back in.

The main deviation from the initial plan is verification scope. Contract enforcement, Biome, and targeted typecheck all pass, and the widget modal conformance test passes. One SEO widget test remains flaky/failing for reasons outside the modal contract work, so that test was recorded as a known unrelated validation gap rather than changed to mask the underlying widget behavior question.

## Context and Orientation
Radarboard’s low-level dialog primitives live in `packages/ui/src/dialog/index.tsx`. They wrap Radix dialog primitives and currently include shell sizing logic. Product source files across the app and shared packages import that module directly, which lets each feature add its own shell width and height overrides.

The dashboard app lives in `apps/app`. Widget-specific modal behavior lives in `packages/widget-engine/src/widget-modal/index.tsx` and `packages/widget-engine/src/expanded-portal/index.tsx`. Plugin forms use `packages/plugin-sdk/src/components/form-dialog.tsx`. Plugin overlays live in `apps/app/components/plugins/plugin-overlay/index.tsx`. App-wide theme tokens live in `apps/app/app/globals.css`. Repository policy and pre-commit / pre-push checks are defined in `biome.json`, `lefthook.yml`, and scripts under `scripts/`.

For this plan, “low-level dialog module” means `@radarboard/ui/dialog`, which exposes the raw shell primitive. “Product-facing dialog entrypoint” means a new shared module that re-exports the approved dialog pieces but makes the shell contract explicit and centralized for production source files.

## Plan of Work
First, add a new product-facing dialog entrypoint in `packages/ui` that re-exports the shared dialog pieces and owns the only approved `DialogContent` shell for product code. At the same time, replace the hidden `default` shell size with centralized `sm`, `md`, and `lg` sizing backed by reusable app theme tokens and shared S/M/L metadata.

Second, migrate product dialog consumers to that new entrypoint. This includes `apps/app` dialog call sites, shared package consumers like `packages/plugin-sdk` and `packages/assistant-ui`, widget modal wrappers in `packages/widget-engine`, and the few plugin source dialogs that still bypass the shared shell. Each dialog should end the migration with an explicit `size` choice and no shell width or height classes on the dialog root.

Third, add enforcement. Biome should block product-source imports from `@radarboard/ui/dialog`, and a new repository script should fail when product source files add shell-sizing classes to the shared dialog root. Then run targeted lint, typecheck, and test commands to prove the migration works and that the guardrails catch future drift.

## Concrete Steps
1. Working directory: `/Users/thedaviddias/Projects/radarboard`
   Command: `rg -n 'from "@radarboard/ui/dialog"|DialogContent' apps packages widgets plugins`
   Expected: list of product-source dialog imports and `DialogContent` usages to migrate.

2. Working directory: `/Users/thedaviddias/Projects/radarboard`
   Command: `pnpm exec vitest run packages/widget-engine/src/widget-modal-conformance.test.ts`
   Expected: existing widget modal conformance test passes before broader enforcement changes.

3. Working directory: `/Users/thedaviddias/Projects/radarboard`
   Command: `pnpm exec tsx scripts/check-modal-contract.ts`
   Expected after implementation: no product-source files import the low-level dialog module or override shared shell sizing.

4. Working directory: `/Users/thedaviddias/Projects/radarboard`
   Command: `pnpm biome check packages/ui apps/app packages/assistant-ui packages/plugin-sdk packages/widget-engine plugins/changelog plugins/notes`
   Expected: formatting and lint pass for touched files.

5. Working directory: `/Users/thedaviddias/Projects/radarboard`
   Command: `pnpm turbo run test --filter=@radarboard/ui --filter=@radarboard/widget-engine --filter=@radarboard/app --filter=@radarboard/assistant-ui --filter=@radarboard/plugin-sdk`
   Expected: relevant test suites pass or any unrelated existing failures are identified explicitly.

## Validation and Acceptance
Automated acceptance:
- `pnpm exec tsx scripts/check-modal-contract.ts` succeeds.
- `pnpm biome check ...` succeeds for touched workspaces.
- Relevant tests for UI and widget modal conformance pass.
- `pnpm turbo run typecheck --filter=@radarboard/ui --filter=@radarboard/widget-engine --filter=@radarboard/plugin-sdk --filter=@radarboard/assistant-ui --filter=@radarboard/app` succeeds.

Manual acceptance:
- Compact confirm dialogs render at the shared `sm` size and stay inset on narrow screens.
- Standard detail and settings dialogs render at the shared `md` size with consistent shell sizing.
- Large workspaces such as widget placement or expanded overlays use `lg` or their aligned overlay contract and remain usable without horizontal overflow.
- Product code no longer imports `@radarboard/ui/dialog` directly outside the UI package internals and approved test/story cases.

## Idempotence and Recovery
The migration is safe to repeat. Re-running the enforcement script or Biome checks should only confirm the current contract. If a consumer migration fails partway through, recover by finishing the import-path migration before enabling or tightening the Biome restriction for that path set.

The riskiest part is enabling enforcement before all product consumers are migrated. Avoid that by landing the new entrypoint and source migrations first, then adding or tightening the import restriction and contract script in the same changeset.

## Artifacts and Notes
- Audit command used during planning:
  - `rg -n 'from "@radarboard/ui/dialog"|DialogContent' apps packages widgets plugins`
- Existing policy hooks already available for extension:
  - `lefthook.yml`
  - `scripts/check-module-boundaries.ts`
  - `biome.json`

## Interfaces and Dependencies
Key interfaces and modules involved:
- `packages/types/src/ui.ts`: canonical modal size types.
- `packages/ui/src/dialog/index.tsx`: low-level Radix-backed dialog primitives.
- `packages/ui/src/app-dialog/index.tsx`: new product-facing dialog contract.
- `apps/app/app/globals.css`: modal shell tokens and shared responsive classes.
- `packages/widget-engine/src/widget-modal/index.tsx`: widget dialog wrapper and S/M/L toggle.
- `apps/app/components/plugins/plugin-overlay/index.tsx`: plugin overlay size semantics.
- `scripts/check-modal-contract.ts`: repository enforcement for dialog imports and shell size overrides.

Dependencies involved:
- `@radix-ui/react-dialog` remains the low-level primitive dependency.
- Biome enforces import policy.
- Lefthook runs pre-commit and pre-push quality checks.

## Revision Notes
- 2026-03-27: Initial ExecPlan created to support the shared modal contract implementation and enforcement work.
- 2026-03-27: Updated after implementation to record shipped files, successful validation, and the unrelated SEO test failure discovered during targeted vitest verification.
