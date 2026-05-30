# Widget Naming Migration

This ExecPlan is maintained according to [PLANS.md](/Users/thedaviddias/Projects/radarboard/PLANS.md). It is a living document and must stay current as implementation progresses.

## Purpose / Big Picture

Radarboard’s widget catalog currently mixes capability-first names, provider-first names, and branded or vague names. This makes the catalog harder to understand, makes capability governance less legible, and causes product surfaces to translate widget names manually in several places. The goal of this change is to make canonical widgets read like jobs users want done while specialized widgets read like provider-specific tools.

After this change, canonical widgets should appear in the product, docs, and marketing with clearer names such as `Bookmarks`, `Shipping`, and `Reviews`, while provider-specific widgets become explicit where necessary such as `GitHub Stars`, `Vercel Domains`, and `GitHub Commits`. Existing saved layouts and old docs links must continue to resolve through aliases and migration maps.

## Scope

In scope:

- Rename approved widget IDs and display names across runtime, settings, docs, and marketing.
- Add widget ID aliases and migration handling for saved layouts, widget config keys, modal prefs, and other runtime references.
- Update capability ownership to fit the renamed catalog.
- Audit and update public docs/widget slugs and settings/catalog labels to match the new naming taxonomy.

Out of scope:

- Renaming package names or moving widget directories unless required by a build/tooling constraint.
- Splitting the Observability widget into multiple widgets in this pass.
- Broad redesign of the widget UI beyond naming, labels, and catalog taxonomy.

## Progress

- [x] 2026-03-28 21:12Z: Audited current widget IDs, display names, marketing names, settings labels, migration hooks, and docs slugs.
- [x] 2026-03-28 21:48Z: Added widget rename aliases and renamed the approved widget descriptor IDs/display names.
- [x] 2026-03-28 22:05Z: Updated settings labels, blueprints, demo config, polling widget IDs, E2E seeded layouts, and widget-specific config logic to the new IDs.
- [x] 2026-03-28 22:17Z: Updated marketing/docs references for Shipping and added a widget naming taxonomy page under the developer guide.
- [x] 2026-03-28 22:24Z: Added a settings-store migration test for renamed widget IDs and updated affected widget/app tests.
- [ ] Run full docs validation successfully, or record why it remains blocked.

## Surprises & Discoveries

- Observation: Radarboard already has a cumulative widget rename map in `packages/widget-engine/src/widget-id-renames.ts`, so this migration should build on that mechanism instead of inventing a second alias system.
  Evidence: `packages/widget-engine/src/widget-id-renames.ts`.

- Observation: Several product surfaces already “translate” vague widget IDs manually, for example the settings blueprint picker maps `raindrop` to `Bookmarks` and `review-pulse` to `Reviews`.
  Evidence: `apps/app/components/settings/settings-layouts/blueprint-picker.tsx`.

- Observation: Marketing/docs names already diverge from internal widget IDs for several widgets, including `shipping-log`, `service-monitor`, and `github-stars`.
  Evidence: `apps/marketing/data/widgets.ts` and `apps/docs/docs.json`.

- Observation: `pnpm generate:extensions` was still writing generated init files into `apps/app/lib/`, but the app and tests resolve `@/lib/*-init` through `apps/app/lib/extensions/runtime/`.
  Evidence: `scripts/generate-extensions-init.ts`, `apps/app/tsconfig.json`, and the stale runtime integration registry missing Stripe until the generator path was fixed.

- Observation: Full Mintlify validation remains blocked by pre-existing SDK reference parse errors unrelated to this rename pass.
  Evidence: `pnpm --filter @radarboard/docs build` fails in `apps/docs/developer-guide/sdk-reference/integration-sdk.mdx`, `plugin-sdk.mdx`, and `widget-sdk.mdx`.

## Decision Log

- Decision: Keep package names and directories stable for this pass and rename the widget descriptor IDs, public slugs, and user-facing names instead.
  Rationale: The user asked for internal widget IDs/slugs to change, but package renames would add workspace churn without changing the user-facing or runtime widget identity model.
  Date/Author: 2026-03-28 / Codex

- Decision: Use capability-first names for canonical widgets and provider-first names for specialized widgets.
  Rationale: This matches the capability-governance work already in progress and makes the catalog legible without product-specific context.
  Date/Author: 2026-03-28 / Codex

- Decision: Keep the `shipping` capability but rename the display name to `Shipping`.
  Rationale: The capability is still meaningful, but the “Log” suffix is more appropriate for docs copy than for the widget name itself.
  Date/Author: 2026-03-28 / Codex

- Decision: Keep `observability` as a composite widget in this pass and rename its user-facing label to `Service Monitor` instead of forcing it to become `Errors`.
  Rationale: The current implementation still includes uptime and app reviews, so an `Errors` rename would be misleading without a deeper behavior split.
  Date/Author: 2026-03-28 / Codex

- Decision: Move canonical `app-reviews` ownership to the renamed App Reviews widget and keep Service Monitor focused on `errors` + `uptime` capability ownership.
  Rationale: This keeps the capability map legible while allowing the composite widget to remain broader in behavior than its owned capabilities.
  Date/Author: 2026-03-28 / Codex

## Outcomes & Retrospective

Implemented the approved widget ID/display-name renames for `bookmarks`, `github-stars`, `vercel-domains`, `app-reviews`, `github-commits`, and `Shipping`, plus the compatibility aliases needed for stored layouts and widget config keys. Settings, blueprints, demo seeds, E2E layout seeds, and the key product/docs/marketing references now use the new names consistently.

The remaining validation gap is full Mintlify docs success. The rename-related docs work is in place, but docs build is still blocked by unrelated pre-existing SDK reference parsing problems.

## Context and Orientation

Widget identity currently flows through `WidgetDescriptor.id`, saved dashboard layouts, widget config keys, modal prefs, blueprint definitions, settings surfaces, docs slugs, marketing widget data, and assistant/runtime helpers. The existing migration point for saved widget IDs is `packages/widget-engine/src/widget-id-renames.ts`, which is consumed by `apps/app/modules/settings/store/settings-store-layout.ts`.

The specific current rename targets from the approved plan are:

- `raindrop` → `bookmarks`
- `stars` → `github-stars`
- `domains` → `vercel-domains`
- `review-pulse` → `app-reviews`
- `shipping` stays `shipping` as a capability but the widget’s user-facing name becomes `Shipping`
- `commits` → `github-commits`

The current repo already contains both old and newer naming patterns. Examples:

- The widget descriptor `stars` displays as `Github Stars`, while docs and marketing already use `github-stars`.
- The widget descriptor `raindrop` still uses the provider name, while the settings blueprint picker already labels it `Bookmarks`.
- The widget descriptor `review-pulse` is specialized for App Store reviews but overlaps the `app-reviews` capability.
- The widget descriptor `domains` is Vercel-only, but its name is generic enough to imply multi-provider support.

This change therefore needs both a rename pass and a consistency pass across supporting surfaces.

## Plan of Work

Start by updating the widget rename compatibility layer so old saved IDs map to the new descriptor IDs. This must happen before changing any widget descriptor IDs to avoid breaking stored layouts, configs, and modal preferences. Update the widget descriptors next, including capability ownership where renaming changes whether the widget is canonical or specialized.

Then update runtime references and catalog surfaces. This includes settings labels, layout defaults, blueprint definitions, demo registries, polling references, backup tasks, assistant tools, and any code paths that hardcode widget IDs. The rule is simple: internal references should use the new widget IDs, while the migration layer handles old IDs.

After runtime references are consistent, update docs and marketing slugs/names. Keep old public docs links resolving through aliases or duplicate routes when necessary. Marketing and docs should follow the same naming model as the product catalog: capability-first for canonical widgets and provider-first for specialized widgets.

Finally, add tests that prove old saved layouts migrate correctly and that the catalog still renders the renamed widgets. Validation must include settings layout migration, widget registry consumers, docs route coverage where feasible, and the capability governance checks.

## Concrete Steps

1. Working directory `/Users/thedaviddias/Projects/radarboard`: update `packages/widget-engine/src/widget-id-renames.ts` and related settings normalization logic to map legacy widget IDs to the new IDs.
2. Working directory `/Users/thedaviddias/Projects/radarboard`: update the renamed widget descriptors and their capabilities in `widgets/`.
3. Working directory `/Users/thedaviddias/Projects/radarboard`: update settings/layout/catalog/blueprint/runtime references in `apps/app/`, `packages/widget-engine/`, and assistant/runtime helpers to use the new IDs.
4. Working directory `/Users/thedaviddias/Projects/radarboard`: update marketing and Mintlify docs/widget slugs to match the new taxonomy and add compatibility handling for old names.
5. Working directory `/Users/thedaviddias/Projects/radarboard`: add migration tests and focused route/catalog verification, then run the validation commands listed below.

## Validation and Acceptance

Automated validation:

- In `/Users/thedaviddias/Projects/radarboard`, run focused tests for settings layout migration and any widget registry consumers touched by the rename.
- In `/Users/thedaviddias/Projects/radarboard`, run focused tests for the renamed widget packages.
- In `/Users/thedaviddias/Projects/radarboard`, run `pnpm check:extensions` and confirm capability/provider checks still pass for the renamed widgets.
- In `/Users/thedaviddias/Projects/radarboard`, run app typecheck and any relevant docs validation if docs navigation or slugs change.

Behavioral acceptance:

- Old saved layouts using `raindrop`, `stars`, `domains`, `review-pulse`, or `commits` still load and resolve to the new widget IDs.
- Settings/catalog surfaces show the new names consistently.
- Docs and marketing no longer mix old and new names for the same widget concept.
- Provider-specific widgets are explicit about provider context, and canonical widgets read like user jobs rather than provider names.

## Idempotence and Recovery

The widget rename map is cumulative and safe to extend. If a rename causes a regression, add or correct the alias mapping rather than reverting the entire rename.

When updating docs and marketing slugs, prefer additive compatibility (redirects, aliases, duplicate routes during transition) over removing old paths immediately.

If a runtime reference is missed, the safest recovery path is to add the missing old→new alias and then update the caller to the canonical ID.

## Artifacts and Notes

- Key files:
  - `packages/widget-engine/src/widget-id-renames.ts`
  - `apps/app/modules/settings/store/settings-store-layout.ts`
  - `apps/app/components/settings/settings-layouts/blueprint-picker.tsx`
  - `apps/marketing/data/widgets.ts`
  - `apps/docs/docs.json`

## Interfaces and Dependencies

Internal interfaces:

- `WidgetDescriptor.id`
- Widget rename migration map in `packages/widget-engine/src/widget-id-renames.ts`
- Saved layout/config/modal-pref normalization in `apps/app/modules/settings/store/settings-store-layout.ts`
- Capability ownership on widget descriptors

Packages and apps involved:

- `apps/app`
- `apps/docs`
- `apps/marketing`
- `packages/widget-engine`
- `widgets/raindrop`, `widgets/stars`, `widgets/domains`, `widgets/review-pulse`, `widgets/commits`, `widgets/shipping`, `widgets/observability`

## Milestones

### Milestone 1: Compatibility-first rename foundation

The rename map, settings normalization, and descriptor IDs are updated so old saved layouts resolve to the new widget IDs.

### Milestone 2: Runtime and catalog consistency

Settings, blueprints, demos, assistant/runtime helpers, and widget registry consumers all use the new widget IDs and names.

### Milestone 3: Public docs and marketing consistency

Docs and marketing slugs/names match the new taxonomy, with old public paths still resolving where needed.

Revision note: 2026-03-28. Initial ExecPlan created before implementing the widget naming and capability migration.
Revision note: 2026-03-28. Updated progress, decisions, and validation outcomes after the rename/migration implementation pass.
