# Enforce Shared Badge Contract

This ExecPlan is maintained according to [PLANS.md](/Users/thedaviddias/Projects/radarboard/PLANS.md).

## Purpose / Big Picture
Radarboard already has a shared badge primitive in `packages/ui/src/badge/index.tsx`, but generic local badge wrappers can quietly reappear because they are easy to hand-roll. This pass makes the rule explicit: product code should not define a local `Badge` component when the shared primitive already exists.

The outcome is modest but important. Status pills, metadata chips, and generic inline badges continue to be styled through one shared primitive instead of drifting into slightly different local wrappers.

## Scope
In scope:
- A repository check that rejects local `Badge` component declarations outside `packages/ui/src/badge/index.tsx`.
- Converting any active generic local `Badge` wrappers found during the audit to `@radarboard/ui/badge`.

Out of scope:
- Domain-specific badge components such as `HealthBadge`, `SaveStatusBadge`, or other named semantic wrappers.
- Forcing all card-like panels or project-color tags through the shared badge primitive.

## Progress
- [x] 2026-03-27 23:41Z: Audited product code and confirmed there are no remaining generic local `Badge` declarations outside `packages/ui`.
- [x] 2026-03-27 23:46Z: Added `check-badge-contract` and wired it into local hooks alongside the other UI contracts.

## Decision Log
- Decision: enforce the badge contract by banning local generic `Badge` declarations, not by pattern-matching every pill-like class combination.
  Rationale: the component-name rule is strong, low-noise, and avoids false positives on layout or domain-specific wrappers.
  Date/Author: 2026-03-27 / Codex

## Validation and Acceptance
Automated acceptance:
- `pnpm check:badge-contract` succeeds.
- Existing UI contract checks still succeed.

Manual acceptance:
- New generic badge wrappers should fail fast in hooks/CI and be replaced with `@radarboard/ui/badge`.

## Interfaces and Dependencies
Key files:
- `packages/ui/src/badge/index.tsx`
- `scripts/check-badge-contract.ts`
- `lefthook.yml`
- `package.json`

## Revision Notes
- 2026-03-27: Initial ExecPlan created for shared badge enforcement.
