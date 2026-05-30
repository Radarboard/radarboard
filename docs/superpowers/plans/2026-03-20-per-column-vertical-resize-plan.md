# Per-Column Vertical Resize — Implementation Plan

**Date:** 2026-03-20
**Spec:** [2026-03-20-per-column-vertical-resize-design.md](/Users/thedaviddias/Projects/radarboard/docs/superpowers/specs/2026-03-20-per-column-vertical-resize-design.md)
**Status:** Ready for implementation

---

## Objective

Implement desktop-only per-column vertical resizing for dashboard layouts while preserving:

- rectangular `LayoutCell` geometry
- existing merge/split semantics
- parity between the live dashboard and `Settings > Layouts`
- backward compatibility for layouts that only persist `rowSizes`

---

## Delivery Sequence

### Phase 1 — Schema and layout helper groundwork

Primary files:

- `packages/types/src/database.ts`
- `packages/widgets/src/layouts/index.ts`
- `packages/widgets/src/layouts/layouts.test.ts`
- `packages/hooks/src/dashboard-layout.ts`

Work:

1. Add `columnRowSizes?: number[][]` to `LayoutDefinition`.
2. Add helper APIs in `packages/widgets/src/layouts/index.ts`:
   - `resolveColumnRowSizes`
   - `normalizeColumnRowSizes`
   - `validateSpanningCellAlignment`
   - `getCellRect`
   - handle/border descriptor helpers for desktop rendering
3. Keep `rowSizes` as compatibility input only.
4. Seed built-in layouts from fallback logic or explicit `columnRowSizes` only if needed for clarity.
5. Expand `packages/widgets/src/layouts/layouts.test.ts` to lock down:
   - legacy fallback from `rowSizes`
   - malformed profile normalization
   - single-column and spanning-cell rectangle math
   - row/column insert/remove profile updates
   - merge/split alignment normalization

Exit criteria:

- helper layer can fully resolve desktop geometry from either old or new layout JSON
- tests cover the rectangular invariant before any UI is touched

### Phase 2 — Persistence and state plumbing

Primary files:

- `packages/hooks/src/use-dashboard.tsx`
- `apps/app/app/api/settings/route.ts`
- `apps/app/hooks/settings-store.ts`
- related tests in `apps/app/app/api/settings/route.test.ts`, `apps/app/hooks/use-dashboard.test.tsx`, `apps/app/hooks/use-settings.test.ts`

Work:

1. Replace `updateLayoutSizes(layoutId, colSizes, rowSizes)` with `updateLayoutSizes(layoutId, colSizes, columnRowSizes)`.
2. Preserve `columnRowSizes` across all widget-layout config updates.
3. Extend settings POST validation so saved layouts can include nested numeric arrays for `columnRowSizes`.
4. Verify settings store normalization keeps old layouts readable and new layouts stable.

Exit criteria:

- old settings blobs still round-trip
- new `columnRowSizes` data persists without being dropped by unrelated settings writes

### Phase 3 — Desktop geometry renderer for the dashboard

Primary files:

- `apps/app/components/dashboard/dashboard/index.tsx`
- `packages/widgets/src/resize-handle/index.tsx`
- `apps/app/components/dashboard/dashboard-skeleton/index.tsx`
- `apps/app/components/projects/project-switch-skeleton-overlay/index.tsx`

Work:

1. Replace the desktop-only reliance on `gridTemplateRows` and full-width row handles.
2. Keep current mobile/tablet stacked fallbacks unchanged.
3. Introduce a positioned desktop widget layer using resolved cell rectangles.
4. Update resize handle rendering so:
   - column handles stay global
   - horizontal handles are local to the affected column or grouped across a spanning cell
   - invalid handles are suppressed instead of silently deforming cells
5. Reuse the same geometry for skeleton/transition overlays.

Exit criteria:

- desktop dashboard renders from geometry helpers, not global row tracks
- live edit mode can resize vertical boundaries per column without breaking spanning cells

### Phase 4 — Settings editor parity

Primary files:

- `apps/app/components/settings/settings-layouts/index.tsx`

Work:

1. Move the editor preview onto the same geometry helpers used by the dashboard.
2. Replace the single left-side row-track assumption with actual per-column border handles.
3. Keep global row/column insertion and removal, but update those operations to edit every column profile.
4. Update balance/reset controls:
   - `Cols` rebalances global column widths
   - `Rows` resets every column profile to equal vertical splits
   - `Balance` resets both dimensions
5. Update the summary readout to show per-column vertical profiles.

Exit criteria:

- `Settings > Layouts` matches live dashboard geometry and handle availability
- structural actions preserve valid rectangular cells

### Phase 5 — Verification and cleanup

Primary files:

- new/updated tests across `packages/widgets`, `packages/hooks`, and `apps/app`

Work:

1. Add targeted UI tests for handle visibility and spanning-cell suppression.
2. Run focused package checks first:
   - `pnpm --filter @radarboard/widget-engine typecheck`
   - `pnpm --filter @radarboard/hooks typecheck`
   - `pnpm --filter @radarboard/app test -- --runInBand` or the repo’s nearest equivalent targeted suite
3. Run manual desktop verification:
   - resize one column’s stacked widgets without affecting adjacent columns
   - verify spanning cells only expose grouped/shared boundaries
   - confirm mobile/tablet breakpoints still use stacked fallback
   - compare live dashboard vs `Settings > Layouts` for the same saved layout

Exit criteria:

- geometry, persistence, and editor parity are covered by tests
- manual desktop behavior matches the approved spec

---

## Suggested Commit Slices

1. `types/widgets`: add `columnRowSizes` schema, helpers, and unit tests
2. `hooks/api`: persist and validate `columnRowSizes`
3. `web/dashboard`: desktop geometry renderer and live resize handles
4. `web/settings`: layout editor parity and summary updates

This sequence keeps the highest-risk changes isolated and reviewable.

---

## Known Blocker

Current pre-commit hooks are not clean on unrelated existing work. The latest hook failure was in:

- `packages/widgets/src/shared/details/github-stars-repo-detail/index.tsx`

Implementation can still proceed locally, but clean commits will require either:

- fixing those unrelated repo errors first, or
- landing the feature after those errors are resolved upstream in the working tree

This blocker is outside the scope of the vertical resize feature itself.

---

## Risks to Watch

- accidental drift between dashboard geometry and settings preview geometry
- row insertion/removal mutating `columnRowSizes` inconsistently across columns
- grouped handle math around `colSpan > 1` cells
- compatibility regressions for saved layouts that only contain legacy `rowSizes`

The plan intentionally front-loads helper tests to keep those failures local before UI work begins.
