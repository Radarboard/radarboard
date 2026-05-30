# Capability Widget Governance

This ExecPlan is maintained according to [PLANS.md](/Users/thedaviddias/Projects/radarboard/PLANS.md). It is a living document and must stay current as implementation progresses.

## Purpose / Big Picture

Radarboard needs a descriptor-driven contract for shared dashboard capabilities so new integrations plug into existing canonical widgets instead of spawning overlapping widgets by default. After this change, integrations will declare the capabilities they provide, widgets will declare the capabilities they own, CI will audit mismatches, and runtime code will pick the correct provider for canonical widgets such as Revenue and Observability.

The working outcome is visible in three places. First, `pnpm check:extensions` should flag capability ownership mistakes and invalid provider mappings. Second, the app recommendation and dependency-graph APIs should reason about canonical capabilities instead of only `requiredIntegrations`. Third, canonical widgets should resolve providers from connected integrations rather than hard-coded service routes.

## Scope

In scope:

- Add shared capability types and descriptor metadata for integrations and widgets.
- Backfill first-party integrations and canonical widgets for the initial capability set.
- Update quality checks, conformance coverage, and app-facing recommendation/dependency graph behavior.
- Update canonical runtime provider selection for Revenue and Observability, including polling metadata where needed.

Out of scope:

- Multi-provider aggregation in one widget view.
- Reworking every widget to become multi-provider immediately beyond the initial canonical surfaces.
- New settings UI for manual provider selection unless required by existing runtime configuration paths.

## Progress

- [x] 2026-03-28 22:58Z: Audited current descriptor types, widget registries, recommendations route, dependency graph route, revenue widget, observability widget, and extension quality gate.
- [x] 2026-03-29 00:07Z: Added shared capability contracts in `packages/types`, `packages/integration-sdk`, and `packages/widget-sdk`, including capability-aware conformance coverage.
- [x] 2026-03-29 00:23Z: Backfilled first-party integrations and canonical widgets with capability metadata, regenerated app extension init files, and activated `@radarboard/integration-stripe`.
- [x] 2026-03-29 00:28Z: Updated Revenue provider selection and Observability mode resolution to consume capability metadata instead of single hard-coded assumptions.
- [x] 2026-03-29 00:30Z: Updated app recommendation and dependency graph routes plus `scripts/check-extensions-quality.ts` to audit canonical capability ownership.
- [x] 2026-03-29 00:32Z: Ran targeted tests for `@radarboard/types`, `@radarboard/integration-sdk`, `@radarboard/widget-engine`, `@radarboard/widget-revenue`, `@radarboard/widget-observability`, `@radarboard/widget-sponsorship`, `@radarboard/integration-stripe`, `@radarboard/app typecheck`, and `pnpm check:extensions`.
- [ ] Run `react-doctor` successfully, or document why it cannot run in this workspace.

## Surprises & Discoveries

- Observation: `widgets/revenue/src/hooks/use-revenue.ts` is hard-coded to `integrationRoute("revenuecat", "data")` even though `integrations/stripe` already exposes a `data` action for revenue summary.
  Evidence: `widgets/revenue/src/hooks/use-revenue.ts` and `integrations/stripe/src/api/data-sources.ts`.

- Observation: `widgets/observability` already acts as a multi-provider canonical surface, but its mode resolution is custom and only branches between Sentry, App Store Connect, and BetterStack.
  Evidence: `widgets/observability/src/index.ts` and `widgets/observability/src/data-resolver.tsx`.

- Observation: `requiredIntegrations` is used for availability and recommendations, but it does not represent canonical ownership and many canonical widgets currently leave it empty.
  Evidence: `apps/app/app/api/extensions/recommendations/route.ts`, `apps/app/app/api/extensions/dependency-graph/route.ts`, `widgets/revenue/src/index.ts`, and `widgets/stars/src/index.ts`.

- Observation: `react-doctor` currently exits before analysis in this repo with `No React dependency found in package.json`, even when run from `/Users/thedaviddias/Projects/radarboard/apps/app`.
  Evidence: `npx -y react-doctor@latest . --verbose --diff` and `npx -y react-doctor@latest apps/app --verbose --diff`.

- Observation: The new capability audit still warns that `github-sponsors` and `open-collective` lack a canonical sponsorship widget, which indicates the live runtime path is still not picking up sponsorship ownership metadata even though `widgets/sponsorship/src/index.tsx` now declares it.
  Evidence: `pnpm check:extensions` output after the implementation pass.

## Decision Log

- Decision: Store capability metadata directly on `IntegrationDescriptor` and `WidgetDescriptor` instead of creating a standalone registry file.
  Rationale: The same metadata must drive CI, runtime selection, and app recommendation surfaces, and descriptors are already the source of truth for extension metadata.
  Date/Author: 2026-03-28 / Codex

- Decision: Enforce a single canonical widget per capability and allow additional widgets only as explicitly `specialized`.
  Rationale: This keeps extension ownership legible and gives CI a concrete policy to audit.
  Date/Author: 2026-03-28 / Codex

- Decision: Keep rollout warn-first except for invalid provider references and duplicate canonical ownership.
  Rationale: The repo already contains partial mismatches, so immediate hard failure would block unrelated extension work.
  Date/Author: 2026-03-28 / Codex

## Outcomes & Retrospective

Implemented the shared capability contract across first-party integrations and widgets, wired that metadata into runtime provider selection for Revenue and Observability, and updated the app recommendation/dependency graph routes plus the extension quality gate to read the new ownership model.

The rollout is functioning in the intended warn-first mode. All targeted tests and `pnpm check:extensions` pass, and the remaining warnings are non-blocking. The one unresolved issue is the sponsorship capability warning, which appears to be a live registry wiring gap rather than a descriptor schema gap.

## Context and Orientation

Radarboard is a pnpm monorepo with extension packages under `integrations/` and `widgets/`. Shared extension contracts live in `packages/integration-sdk/src/types.ts` and `packages/widget-sdk/src/widget-types.ts`. Integrations register in `packages/integration-sdk/src/registry.ts`; widgets register in `packages/widget-engine/src/widgets/registry.ts`.

The current quality gate is `scripts/check-extensions-quality.ts`. It loads active extensions from `radarboard.config.ts`, checks structure and boundaries, and emits pass/warn/error results for CI. Existing conformance helpers live in `packages/integration-sdk/src/conformance.test.ts` and `packages/widget-engine/src/conformance.test.ts`; extension packages call those helpers from their own tests.

Runtime recommendation and graph surfaces are implemented in `apps/app/app/api/extensions/recommendations/route.ts` and `apps/app/app/api/extensions/dependency-graph/route.ts`. They currently depend on `requiredIntegrations` and extension registries, not on any capability contract.

The Revenue widget lives in `widgets/revenue/` and currently fetches only RevenueCat data. The Observability widget lives in `widgets/observability/` and already represents several monitoring-related providers but with custom per-provider logic. Polling families are registered in `apps/app/lib/system/polling/polling-config.ts`.

In this plan, a “capability” means a cross-service product concept such as `revenue`, `stars`, or `errors`. A canonical widget is the primary Radarboard dashboard surface for that capability. A specialized widget is a narrower, provider-specific or workflow-specific surface that overlaps the capability intentionally.

## Plan of Work

Start by introducing a shared capability vocabulary and descriptor shapes in the SDK types. The integration descriptor will declare which capabilities it provides and which data-source action fulfills each capability. The widget descriptor will declare which capabilities it owns, whether ownership is canonical or specialized, and which integration/action providers it supports.

Next, extend registry-facing validation in the conformance helpers and in `scripts/check-extensions-quality.ts`. The quality script must load descriptor metadata, cross-check widget provider references against registered integration actions, ensure only one canonical widget owns a capability, and warn on incomplete ownership mappings.

After the contracts exist, backfill first-party integrations and widgets. The initial set is `revenue`, `stars`, `errors`, `uptime`, `app-reviews`, `downloads`, `sponsorship`, `shipping`, `analytics`, and `seo`, but only the integrations and widgets already present in the repo need concrete mappings now. Prioritize Revenue and Observability because they exercise runtime provider resolution.

Then update runtime selection. Revenue should resolve a provider integration/action from widget capability metadata and current project connectivity instead of hard-coding RevenueCat. Observability should derive the active provider mode from capability ownership and configured providers instead of ad hoc branching. Polling metadata for Revenue should follow the selected provider contract rather than a fixed RevenueCat mapping.

Finally, update app surfaces so recommendations and dependency graph output expose canonical capability ownership. Recommendations should be able to state that an integration unlocks a canonical widget because it satisfies that widget’s capability. The graph response should expose capability mismatches as audit warnings so settings or catalog UI can surface them later without new server logic.

## Concrete Steps

1. Working directory `/Users/thedaviddias/Projects/radarboard`: update shared types in `packages/integration-sdk/src/types.ts` and `packages/widget-sdk/src/widget-types.ts` to add capability contracts and export helpers used by the app and tests.
2. Working directory `/Users/thedaviddias/Projects/radarboard`: update `packages/integration-sdk/src/conformance.test.ts` and `packages/widget-engine/src/conformance.test.ts` so descriptor-level tests cover capability metadata invariants.
3. Working directory `/Users/thedaviddias/Projects/radarboard`: update first-party descriptors in `integrations/` and `widgets/` with capability metadata, then refactor Revenue and Observability runtime selection to consume that metadata.
4. Working directory `/Users/thedaviddias/Projects/radarboard`: update `scripts/check-extensions-quality.ts` plus any supporting helpers or tests to audit capability ownership across active extensions.
5. Working directory `/Users/thedaviddias/Projects/radarboard`: update `apps/app/app/api/extensions/recommendations/route.ts`, `apps/app/app/api/extensions/dependency-graph/route.ts`, and any helper modules they need so capability ownership appears in responses.
6. Working directory `/Users/thedaviddias/Projects/radarboard`: run targeted tests for changed packages, `pnpm check:extensions`, and `npx -y react-doctor@latest . --verbose --diff`; record any deviations in this ExecPlan.

## Validation and Acceptance

Automated validation:

- In `/Users/thedaviddias/Projects/radarboard`, run `pnpm test --filter @radarboard/integration-sdk --filter @radarboard/widget-engine` or the equivalent targeted Vitest commands for changed packages. Expected result: updated conformance tests pass with the new capability metadata.
- In `/Users/thedaviddias/Projects/radarboard`, run `pnpm check:extensions`. Expected result: the script completes successfully, emitting warnings for intentional rollout gaps only, and no errors for provider references or duplicate canonical widgets.
- In `/Users/thedaviddias/Projects/radarboard`, run targeted tests for `widgets/revenue`, `widgets/observability`, and any app route tests added for recommendations/dependency graph. Expected result: provider selection and capability-driven responses are covered.
- In `/Users/thedaviddias/Projects/radarboard`, run `npx -y react-doctor@latest . --verbose --diff`. Expected result: no new React correctness or architecture regressions attributable to this work.

Behavioral acceptance:

- A connected Stripe project can drive the Revenue widget without changing the widget code path to a Stripe-specific widget.
- A project with multiple supported Revenue providers uses a stable provider choice, preferring explicit widget config when present.
- Recommendations can explain that connecting a capability-providing integration unlocks the canonical widget for that capability.
- The dependency graph or companion audit output can describe capability mismatches instead of only raw required-integration edges.

## Idempotence and Recovery

Descriptor metadata edits and validation updates are safe to repeat. Re-running `pnpm check:extensions` and the targeted tests should be idempotent.

If runtime provider selection breaks a canonical widget, recover by narrowing the provider resolution helper and falling back to the widget’s first declared provider. Avoid deleting capability metadata during recovery because the quality gate relies on it.

This plan does not include destructive migration steps. If a partial implementation leaves warnings noisy, keep the quality script warn-first and document the gap in `Surprises & Discoveries` and `Decision Log` before pausing.

## Artifacts and Notes

- Key current references:
  - `packages/integration-sdk/src/types.ts`
  - `packages/widget-sdk/src/widget-types.ts`
  - `scripts/check-extensions-quality.ts`
  - `widgets/revenue/src/hooks/use-revenue.ts`
  - `widgets/observability/src/index.ts`
  - `apps/app/app/api/extensions/recommendations/route.ts`
  - `apps/app/app/api/extensions/dependency-graph/route.ts`

## Interfaces and Dependencies

Internal interfaces:

- `IntegrationDescriptor` in `packages/integration-sdk/src/types.ts`
- `WidgetDescriptor` in `packages/widget-sdk/src/widget-types.ts`
- Extension registries in `packages/integration-sdk/src/registry.ts` and `packages/widget-engine/src/widgets/registry.ts`
- Polling source registrations in `apps/app/lib/system/polling/polling-config.ts`

Packages and apps involved:

- `@radarboard/integration-sdk`
- `@radarboard/widget-sdk`
- `@radarboard/widget-engine`
- `apps/app`
- `integrations/revenuecat`, `integrations/stripe`, `integrations/sentry`, `integrations/betterstack`, `integrations/app-store-connect`, `integrations/github`
- `widgets/revenue`, `widgets/stars`, `widgets/observability`

The end-state contract is that integrations advertise capability providers, widgets advertise capability ownership, and all higher-level behavior reads from those descriptor contracts instead of hard-coded per-service assumptions.

## Milestones

### Milestone 1: Shared capability contract exists

At the end of this milestone, SDK types and conformance helpers understand capability metadata, and first-party descriptors compile with the new fields.

### Milestone 2: CI and registry audits understand canonical ownership

At the end of this milestone, `pnpm check:extensions` can detect invalid provider references, duplicate canonical widgets, and ownership gaps as defined in the rollout policy.

### Milestone 3: Canonical runtime selection uses capability metadata

At the end of this milestone, Revenue and Observability resolve providers from descriptor metadata and connected integrations instead of hard-coded routes.

### Milestone 4: App-facing extension surfaces expose capability governance

At the end of this milestone, recommendations and dependency graph responses can explain canonical capability ownership and audit mismatches.

Revision note: 2026-03-28. Initial ExecPlan created before implementation to satisfy the repo requirement for cross-package governance work.
Revision note: 2026-03-29. Updated progress, validation results, and post-implementation discoveries after landing the capability governance changes.
