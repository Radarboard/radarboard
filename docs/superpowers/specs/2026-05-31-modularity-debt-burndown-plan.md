# Burn Down App Modularity Debt

This ExecPlan is maintained according to [PLANS.md](/Users/thedaviddias/Projects/radarboard/PLANS.md).

## Purpose / Big Picture

Radarboard extensions should be plug-and-play packages. The app shell should load integrations, plugins, widgets, and features through generated registration files and SDK registries, not by importing concrete extension packages throughout app code.

The visible maintainer outcome is that `pnpm check:modularity` reports fewer accepted debt imports, then eventually no accepted debt. The product outcome is that adding or removing an extension only requires changing `radarboard.config.ts` and regenerating extension init files, instead of editing app internals.

## Scope

In scope:

Remove accepted direct extension imports reported by `pnpm check:modularity`, update SDK descriptor contracts where needed, and keep generated extension registration as the only normal app import point for concrete extension packages.

Out of scope:

Changing user-facing behavior, redesigning extension UIs, removing extension packages, or bypassing existing hooks and checks.

## Progress

- [x] 2026-05-31 22:05Z: Captured current modularity baseline: 24 accepted imports in 17 app files, with 0 new violations.
- [x] 2026-05-31 22:05Z: Committed RevenueCat integration work as `f4a2dd79 feat(integrations): add modular RevenueCat integration`.
- [x] 2026-05-31 22:10Z: Moved embeddings plugin server route and MCP resolver setup behind `PluginDescriptor.server`, reducing debt to 22 imports in 15 files.
- [x] 2026-05-31 22:11Z: Replaced assistant runtime's direct shipping data-source import with `findDataSource("shipping", "data")`, reducing debt to 21 imports in 14 files.
- [x] 2026-05-31 22:14Z: Moved briefing and workflow app routes behind `FeatureDescriptor.server`, reducing debt to 18 imports in 12 files.
- [x] 2026-05-31 22:18Z: Moved briefing prompt context and briefing/workflow assistant executors behind `FeatureDescriptor.assistant`, reducing debt to 15 imports in 10 files.
- [x] 2026-05-31 22:25Z: Moved notification and onboarding UI behind `FeatureDescriptor.ui` plus feature resources, reducing debt to 6 imports in 3 files.
- [x] 2026-05-31 22:30Z: Moved app chrome and desktop health sync widget hooks behind `WidgetDescriptor.chrome`, reducing debt to 0 imports in 0 files.
- [x] Finish moving plugin-specific server route/tool wiring behind plugin descriptors.
- [x] Move feature-specific route/tool/UI wiring behind feature descriptors or feature registries.
- [x] Move widget hook usage in app chrome behind widget or data-source registries.
- [x] Remove fixed entries from `KNOWN_TECH_DEBT` in `scripts/check-modularity.ts`.
- [x] Verify `pnpm check:modularity` shows no accepted debt.

## Surprises & Discoveries

- `pnpm check:extensions` currently validates active integrations, plugins, and widgets, but not feature packages. Feature modularity must be validated with targeted scans, feature tests, and typechecks until the quality gate grows feature support.
- `pnpm check:modularity` intentionally ignores generated files such as `apps/app/lib/extensions/runtime/*-init.ts`; those files are the approved place for concrete extension imports.
- Adding optional `PluginDescriptor.server` allowed app routes and MCP setup to call plugin-owned server code through `PLUGIN_REGISTRY` without changing plugin UI behavior.
- Adding optional `FeatureDescriptor.server` and `FeatureDescriptor.assistant` removed assistant route/tool imports without moving Zod schemas or AI SDK tool wrapping into feature packages.
- Adding optional `WidgetDescriptor.chrome` gave app chrome a registry contract for widget-owned hooks without importing concrete widget packages from app components.

## Decision Log

- Decision: Start with route/tool delegation debt before UI chrome debt.
  Rationale: Route/tool delegation can usually be solved by descriptor contracts and registry lookup, reducing app coupling without changing layouts or user flows.
  Date/Author: 2026-05-31 / Codex.

- Decision: Keep active extension loading in generated init files.
  Rationale: Generated init files are already allowed by `check-modularity.ts` and match the plug-and-play extension model.
  Date/Author: 2026-05-31 / Codex.

## Outcomes & Retrospective

`pnpm check:modularity` now reports 0 new violations and 0 accepted known debt. Concrete extension imports remain centralized in generated init files and registry wiring, preserving independent extension packages while allowing the app shell to render optional plugin, feature, and widget surfaces.

## Context and Orientation

The debt source is `scripts/check-modularity.ts`. It scans `apps/app` for direct imports from packages with prefixes such as `@radarboard/integration-`, `@radarboard/plugin-`, `@radarboard/widget-`, and `@radarboard/feature-`. SDK imports such as `@radarboard/plugin-sdk` and generated files such as `apps/app/lib/extensions/runtime/plugins-init.ts` are allowed.

Current accepted debt reported by `pnpm check:modularity`: none.

Important registry files:

- `packages/plugin-sdk/src/types.ts` defines `PluginDescriptor`.
- `packages/plugin-sdk/src/registry.ts` stores plugin descriptors.
- `packages/feature-sdk/src/types.ts` defines feature descriptors.
- `packages/feature-sdk/src/registry.ts` stores feature descriptors.
- `packages/widget-engine/src/widgets/registry.ts` stores widget descriptors.
- `packages/integration-sdk/src/registry.ts` stores integration descriptors and data sources.
- `apps/app/lib/extensions/runtime/*-init.ts` are generated by `pnpm generate:extensions` and are allowed to import concrete extension packages.

## Plan of Work

First, remove plugin server coupling. The app should not import `@radarboard/plugin-embeddings/server/routes` or `@radarboard/plugin-embeddings/mcp-tools` directly. Add descriptor fields or registry helpers that let the embeddings plugin expose its server route handler and service resolver setup through `PluginDescriptor`. The app route should look up the `embeddings` descriptor and call the registered handler.

Second, remove feature route coupling. Briefing and workflows should expose route handlers or assistant tools through feature descriptors, and app routes should delegate through `FEATURE_REGISTRY`.

Third, remove feature UI coupling. Notification center and onboarding UI should be exposed through descriptor-owned surface components or a feature UI registry, with the app shell rendering by feature ID.

Fourth, remove widget hook coupling from app chrome. KPI strip, bottom ticker, and desktop health sync should consume widget-declared ticker/KPI/health contributions or generic data sources instead of importing widget hooks.

After each milestone, update `scripts/check-modularity.ts` to remove only the debt entries that are actually eliminated, then run checks.

## Concrete Steps

Run from `/Users/thedaviddias/Projects/radarboard`.

1. Baseline:

   ```sh
   pnpm check:modularity
   ```

   Expected now: `0 new violations` and `24 accepted known debt`.

2. After each milestone:

   ```sh
   pnpm check:modularity
   pnpm check:architecture
   pnpm check:extensions
   pnpm --filter @radarboard/app test -- <focused tests>
   pnpm --filter @radarboard/app typecheck
   ```

   Expected: no new violations, no architecture errors, no extension quality errors, focused tests pass, and typecheck passes.

3. Before committing:

   ```sh
   git status --short
   git diff --stat
   git add -A
   git commit -m "refactor(repo): reduce extension modularity debt"
   ```

   Expected: hooks pass without `--no-verify` and without `LEFTHOOK=0`.

## Validation and Acceptance

Acceptance is incremental. Each merged milestone must reduce the accepted debt count in `pnpm check:modularity` without adding new violations. Existing app tests and typechecks must continue to pass. For descriptor changes, extension conformance tests should pass or be updated to validate the new descriptor fields.

Final acceptance: `pnpm check:modularity` reports `0 new violations` and no accepted known debt, and `scripts/check-modularity.ts` no longer needs app-file exceptions for extension imports.

## Idempotence and Recovery

`pnpm check:*`, `pnpm --filter ... test`, and `pnpm --filter ... typecheck` are safe to rerun. `pnpm generate:extensions` is safe to rerun after changing `radarboard.config.ts` or extension package lists.

If a refactor breaks behavior, use normal Git inspection commands to identify the change and patch forward. Do not use `git reset --hard`, do not bypass hooks, and do not remove unrelated user changes.

## Artifacts and Notes

Baseline evidence from `pnpm check:modularity` on 2026-05-31:

```text
Known accepted modularity debt (24 imports in 17 files)
Files scanned: 743
0 new violations
```

Latest evidence after the descriptor and registry refactors:

```text
Files scanned: 748
0 new violations
0 accepted known debt
Fully modular — no direct extension imports.
```

## Interfaces and Dependencies

The main interfaces are descriptor contracts:

- `PluginDescriptor` in `packages/plugin-sdk/src/types.ts`.
- `FeatureDescriptor` in `packages/feature-sdk/src/types.ts`.
- `WidgetDescriptor` in `packages/widget-sdk/src/widget-types.ts` and runtime registry types in `packages/widget-engine`.
- `IntegrationDescriptor` and `DataSourceDescriptor` in `packages/integration-sdk/src/types.ts`.

Any new descriptor field must be optional for backward compatibility, tested in the relevant SDK or extension package, and consumed by app code through registry lookup.
