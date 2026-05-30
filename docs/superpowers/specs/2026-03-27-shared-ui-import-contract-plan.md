# Enforce Shared UI Import Contract

This ExecPlan is maintained according to [PLANS.md](/Users/thedaviddias/Projects/radarboard/PLANS.md).

## Purpose / Big Picture
Radarboard already has shared wrappers for several Radix-backed primitives in `packages/ui`, but only dialogs were blocked at the import boundary. This leaves room for product code to bypass the shared design system later and reintroduce drift. The goal of this pass is to enforce those wrappers consistently wherever the shared abstraction already exists.

The visible outcome is stability rather than a visual redesign: tabs, tooltips, selects, switches, separators, toggle groups, scroll areas, and dialogs continue to render as they do now, but product code is no longer allowed to import the underlying Radix packages directly.

## Scope
In scope:
- Product-facing import enforcement for Radix-backed primitives that already have a shared `@radarboard/ui` wrapper.
- Biome import restrictions for:
  - `@radix-ui/react-dialog`
  - `@radix-ui/react-scroll-area`
  - `@radix-ui/react-select`
  - `@radix-ui/react-separator`
  - `@radix-ui/react-switch`
  - `@radix-ui/react-tabs`
  - `@radix-ui/react-toggle-group`
  - `@radix-ui/react-tooltip`

Out of scope:
- Creating new shared wrappers that do not already exist.
- Forcing all card-like layouts through `@radarboard/ui/card`.
- Replacing domain-specific badge components that encode meaning rather than generic chrome.

## Progress
- [x] 2026-03-27 23:23Z: Audited current shared primitive usage and confirmed there are no product-side direct Radix tabs or tooltip imports left.
- [x] 2026-03-27 23:29Z: Expanded the existing Biome import restriction to cover the rest of the shared Radix-backed UI primitives.

## Surprises & Discoveries
- Observation: the remaining high-value enforcement work has shifted from migration to policy.
  Evidence: raw `<button>` usage in product code is now `0`, and Radix tabs/tooltip imports are already confined to `packages/ui`.
- Observation: tabs and tooltips are safe to enforce broadly now, while cards are still too layout-specific for a blanket rule.
  Evidence: product code already imports `@radarboard/ui/tabs` and `@radarboard/ui/tooltip`, but card-like layouts still appear as many bespoke compositions.

## Decision Log
- Decision: enforce shared primitive usage at the import boundary wherever a shared UI wrapper already exists.
  Rationale: this prevents future drift without adding more brittle content-scanning scripts.
  Date/Author: 2026-03-27 / Codex

## Outcomes & Retrospective
This pass extends the same enforcement philosophy used for dialogs to the broader shared UI surface. Product code can keep using the shared primitives it already uses today, but future direct Radix imports for those primitives will fail fast in Biome instead of slowly fragmenting the UI layer again.

## Validation and Acceptance
Automated acceptance:
- `pnpm biome check biome.json` succeeds.
- Existing contract checks (`button`, `form-controls`, `modal`) still pass.

Manual acceptance:
- No product-facing file should need changes to comply because the current codebase already routes those primitives through `@radarboard/ui`.

## Interfaces and Dependencies
Key files:
- `biome.json`
- `packages/ui/src/dialog/index.tsx`
- `packages/ui/src/scroll-area/index.tsx`
- `packages/ui/src/select/index.tsx`
- `packages/ui/src/separator/index.tsx`
- `packages/ui/src/switch.tsx`
- `packages/ui/src/tabs/index.tsx`
- `packages/ui/src/toggle-group/index.tsx`
- `packages/ui/src/tooltip/index.tsx`

## Revision Notes
- 2026-03-27: Initial ExecPlan created for shared primitive import-boundary enforcement.
