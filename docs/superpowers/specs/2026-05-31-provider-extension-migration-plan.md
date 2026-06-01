# Move Provider Extensions Out Of Core

This ExecPlan is maintained according to [PLANS.md](/Users/thedaviddias/Projects/radarboard/PLANS.md).

## Purpose / Big Picture

Radarboard core should own provider-neutral dashboard capabilities, the extension runtime, and the first-run experience. Concrete SaaS providers such as Stripe, GitHub, Vercel, Linear, Sentry, and Slack should be installable extensions from `/Users/thedaviddias/Projects/community-extensions`, not packages that the core app must ship and register by default.

After this work, a fresh Radarboard install can complete onboarding and render a demo/default dashboard with no third-party provider integrations installed. Users can still install provider packages from the extension catalog, and moved extensions can remain officially maintained in the community repository.

## Scope

In scope:

Move provider-specific integrations, plugins, and widgets out of the core registration set; copy their package directories into the community extension repository; decouple onboarding, blueprints, polling, capability checks, demo mode, and app imports from uninstalled providers; and verify both repositories.

Out of scope:

Redesigning the public SDK, changing the extension installer model, or adding new provider integrations beyond the packages that already exist in this repository.

## Progress

- [x] 2026-05-31 18:45Z: Read `PLANS.md` and the Radarboard extension creation/update skills.
- [x] 2026-05-31 18:45Z: Created this ExecPlan.
- [x] 2026-05-31 18:50Z: Copied moved extension packages into `/Users/thedaviddias/Projects/community-extensions`.
- [x] 2026-05-31 18:51Z: Reduced `radarboard.config.ts` to the core extension list; kept `integration-shipping` under `virtualIntegrations` because it exposes data sources without an `IntegrationDescriptor`.
- [x] 2026-05-31 19:05Z: Regenerated Radarboard extension runtime files for the reduced core extension set.
- [x] 2026-05-31 19:45Z: Decoupled provider-specific app imports and tests from moved packages.
- [x] 2026-05-31 20:05Z: Updated core onboarding, blueprints, polling, capability governance, and provider-neutral widget fallback behavior.
- [x] 2026-05-31 20:30Z: Generated and validated the community catalog.
- [x] 2026-05-31 20:55Z: Ran Radarboard core validation; unit/type/extension checks pass, targeted onboarding E2E is still blocked by preview-page timeouts in the current worktree.

## Surprises & Discoveries

- Discovery: Provider coupling is deeper than `radarboard.config.ts`. Core app modules directly import GitHub, Linear, Slack, Resend, and provider type packages, and SQLite schema creation imports GitHub star-history SQL from the GitHub integration.
- Discovery: Demo mode intentionally serves cached data for unregistered providers, so demo routes can remain provider-shaped as long as the registered core widgets no longer depend on moved provider-specific widgets.
- Discovery: The existing Playwright onboarding runner still polls the legacy `/api/database/config` readiness URL while the app route registry has moved the canonical route to `/api/system/database/config`; a compatibility route is now registered for the legacy path.
- Discovery: Community validation and catalog generation pass with the copied packages, but `pnpm install` in `/Users/thedaviddias/Projects/community-extensions` still fails because migrated packages reference Radarboard `workspace:*` packages that are not present in that repo. Installability will need a separate dependency-manifest conversion once those SDK packages are published or linked intentionally.

## Decision Log

- Decision: Treat `/Users/thedaviddias/Projects/community-extensions` as the installable extension catalog repo, not as an unsupported-only repository.
  Rationale: Moved packages can be `tier: "official"` while still not being part of the default Radarboard core install.
  Date/Author: 2026-05-31 / Codex.

- Decision: Keep provider-neutral canonical widgets in core even if their providers move out.
  Rationale: The app should expose the product capabilities, while provider packages plug into those capabilities through the extension model.
  Date/Author: 2026-05-31 / Codex.

## Outcomes & Retrospective

Core now registers only the provider-neutral/default extension set plus the virtual shipping integration. Moved provider extensions were copied into `/Users/thedaviddias/Projects/community-extensions`, given the metadata required by community validation, and included in the generated community catalog.

The core app no longer statically imports moved provider packages from runtime paths. Provider-specific assistant actions, notifications, plugin routes, webhook relay registration, GitHub star-history persistence, and shipping data sources now degrade to extension-owned unavailable states instead of importing deleted packages.

Validation completed:

- `pnpm generate:extensions`
- `pnpm check:extensions`
- `pnpm typecheck`
- `pnpm --filter @radarboard/feature-onboarding test`
- `pnpm --filter @radarboard/widget-engine test`
- `pnpm --filter @radarboard/app test`
- In `/Users/thedaviddias/Projects/community-extensions`: `pnpm validate`, `pnpm catalog:generate`, and `pnpm test`

Validation not completed:

- `pnpm test:e2e -- --grep @onboarding` starts after the compatibility readiness route is added, but the current worktree times out on onboarding preview/demo pages that remain on the dashboard skeleton/project-not-found child during the test window. This is not a missing moved-package failure anymore; it needs a separate E2E/runtime investigation.

## Context and Orientation

`radarboard.config.ts` is the source of truth for first-party extensions that Radarboard registers at app startup. Running `pnpm generate:extensions` regenerates files under `apps/app/lib/extensions/runtime/`, including integration, plugin, widget, feature, dev-extension, and transpile-package registration files.

The community extension repo lives outside this repo at `/Users/thedaviddias/Projects/community-extensions`. It has top-level `integrations/`, `plugins/`, and `widgets/` folders plus `catalog.json`. Its scripts are run with `pnpm validate`, `pnpm catalog:generate`, and `pnpm test`.

Onboarding pulls registered integration services through `apps/app/components/onboarding/step-integrations.tsx` and suggestions from `features/onboarding/src/components/onboarding-wizard/profiles/*`. Layout blueprints live in `packages/widget-engine/src/blueprints/registry.ts` and currently reference provider-specific widgets. Polling sources are registered in `apps/app/lib/system/polling/polling-config.ts`. Capability checks are in `apps/app/lib/extensions/capability-governance.ts`.

## Plan of Work

First, copy all moved extension directories to the community repo so no implementation is lost. Then update Radarboard's config and generated files so only core extensions register at startup. After the core list is smaller, fix every compile/runtime break caused by static imports from moved packages. Finally, validate the core and community repositories and record remaining gaps.

The highest-risk area is removing direct imports from provider packages in app-shell modules. Provider-specific actions should either become optional dynamic imports with graceful unavailable states or be moved into extension-owned tools. Core code must not require a moved provider package to boot.

## Concrete Steps

Run from `/Users/thedaviddias/Projects/radarboard` unless stated otherwise.

1. Copy extension directories into `/Users/thedaviddias/Projects/community-extensions`.
2. Edit `radarboard.config.ts` to keep only core extensions.
3. Run `pnpm generate:extensions`.
4. Remove moved package dependencies from `apps/app/package.json`.
5. Update onboarding, blueprints, capability governance, polling, and hardcoded provider imports.
6. Run `pnpm typecheck`, focused package tests, and extension checks.
7. In `/Users/thedaviddias/Projects/community-extensions`, run `pnpm validate`, `pnpm catalog:generate`, and `pnpm test`.

## Validation and Acceptance

Acceptance criteria:

Fresh onboarding can be completed without selecting a provider integration. Demo mode renders without missing-widget crashes. Settings still displays core extensions and community catalog entries. Installing a provider extension from the community catalog can satisfy its relevant canonical widget. No static core import remains from moved provider packages except public SDK packages and generated community artifacts.

Automated checks:

```bash
pnpm generate:extensions
pnpm check:extensions
pnpm typecheck
pnpm --filter @radarboard/feature-onboarding test
pnpm --filter @radarboard/widget-engine test
pnpm --filter @radarboard/app test
pnpm test:e2e -- --grep @onboarding
```

Community checks from `/Users/thedaviddias/Projects/community-extensions`:

```bash
pnpm validate
pnpm catalog:generate
pnpm test
```

## Idempotence and Recovery

Copying extension directories into the community repo is safe to repeat if the destination is overwritten from the Radarboard source directory. `pnpm generate:extensions` is safe to repeat after every config change. If the core app fails to compile after dependencies are removed, restore the last working dependency while continuing to remove static imports one subsystem at a time.

The risky steps are deleting or moving directories and removing workspace dependencies. Do not use `git reset`; use normal edits and inspect `git diff` to recover specific files if needed.

## Artifacts and Notes

The initial provider-specific packages targeted for migration are:

Integrations: `app-store-connect`, `astro`, `betterstack`, `discord`, `github`, `github-sponsors`, `google-search-console`, `linear`, `npm`, `open-collective`, `openpanel`, `pagerduty`, `raindrop`, `resend`, `revenuecat`, `sentry`, `slack`, `stripe`, `umami`, `vercel`.

Plugins: `changelog`, `expenses`, `rss-reader`, `status-page`, `webhook-relay`.

Widgets: `app-reviews`, `aso-keywords`, `builds`, `deployments`, `github-commits`, `github-stars`, `npm-downloads`, `projects`, `pulls`, `vercel-domains`.

## Interfaces and Dependencies

Core keeps depending on SDK packages such as `@radarboard/integration-sdk`, `@radarboard/plugin-sdk`, `@radarboard/widget-sdk`, and `@radarboard/widget-engine`. Provider packages moved to the community repo must keep their existing package names and public exports so installing them later preserves compatibility with the extension installer.
