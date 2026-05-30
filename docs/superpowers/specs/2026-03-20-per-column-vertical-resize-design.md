# Per-Column Vertical Resize — Design Spec

**Date:** 2026-03-20
**Status:** Approved

---

## Overview

The dashboard currently supports:

- global column resizing via `colSizes`
- global row resizing via `rowSizes`
- rectangular cells defined by `rowStart`, `colStart`, `rowSpan`, and `colSpan`

That means dragging a horizontal resize handle changes an entire row across the full dashboard width. The requested behavior is different: vertical stacking should be resizable per column, while keeping the existing layout system understandable and preserving rectangular cells for merged widgets.

This spec adds per-column vertical sizing to the layout model and applies it in both places where layouts are edited or rendered:

- live dashboard edit mode in `apps/app/components/dashboard/dashboard/index.tsx`
- `Settings > Layouts` in `apps/app/components/settings/settings-layouts/index.tsx`

The chosen constraint is:

- per-column vertical resizing is supported
- widgets that span multiple columns stay rectangular and therefore lock the shared vertical boundaries they cover
- we do not introduce freeform or non-rectangular widget geometry

---

## Goals

- Allow vertical resize handles to operate per column instead of across the full dashboard width.
- Keep `LayoutCell` rectangular and compatible with the existing merge/split mental model.
- Support the same geometry in the live dashboard and in `Settings > Layouts`.
- Preserve all existing saved layouts through compatibility fallback and migration-free normalization.
- Keep mobile and tablet stacked layouts unchanged.

## Non-Goals

- Freeform masonry layout behavior.
- Non-rectangular or bent spanning widgets.
- Changing widget placement semantics or page-level layout assignment behavior.
- Making row insertion/removal column-local.

---

## Decisions

- **Primary model:** add per-column row-size profiles to `LayoutDefinition` rather than replacing `LayoutCell`.
- **Rectangular invariant:** every rendered cell remains a rectangle. A cell with `colSpan > 1` must have the same top and bottom boundaries across all columns it spans.
- **Resize behavior:** horizontal resize handles are local to the affected column unless a spanning cell requires a shared handle across multiple columns.
- **Spanning-cell policy:** handles that would make a spanning cell non-rectangular are hidden or grouped; they are never allowed to deform the widget.
- **Structure operations:** insert/remove row stays global. Merge and split remain discrete grid operations, with explicit boundary normalization when needed.
- **Compatibility:** legacy `rowSizes` remains accepted as fallback input. New desktop rendering does not treat it as the source of truth.

---

## Data Model

### `LayoutDefinition`

Add a new optional field in `packages/types/src/database.ts`:

```ts
export interface LayoutDefinition {
  id: string;
  name: string;
  cells: LayoutCell[];
  colSizes?: number[];
  rowSizes?: number[]; // legacy compatibility + fallback seed
  columnRowSizes?: number[][];
}
```

`columnRowSizes` is indexed by column:

- outer array length must equal `colCount`
- each inner array length must equal `rowCount`
- each inner array is a percentage list summing to `100`

Example for a 3-column / 3-row layout:

```ts
columnRowSizes: [
  [40, 25, 35], // column 0
  [33.33, 33.33, 33.34], // column 1
  [20, 45, 35], // column 2
]
```

### Compatibility Rules

- If `columnRowSizes` is missing, derive it by repeating `resolveRowSizes(layout)` for every column.
- If `columnRowSizes` exists but is invalid for the current dimensions, repair invalid columns from `resolveRowSizes(layout)`.
- `rowSizes` is retained for backwards compatibility, JSON shape stability, and fallback seeding. New desktop geometry must not depend on `rowSizes`.

### Resolved Helpers

Add layout helpers in `packages/widgets/src/layouts/index.ts`:

- `resolveColumnRowSizes(layout): number[][]`
- `normalizeColumnRowSizes(columnRowSizes, rowCount, fallbackRowSizes): number[][]`
- `validateColumnRowSizes(layout): boolean`
- `validateSpanningCellAlignment(layout): boolean`
- `getColumnOffsets(colSizes): number[]`
- `getRowOffsetsForColumn(columnRowSizes[columnIndex]): number[]`
- `getCellRect(layout, cell): { leftPct; topPct; widthPct; heightPct }`

`getCellRect` uses the resolved row offsets for the columns the cell spans. For multi-column cells, it reads top and bottom from the first covered column after alignment validation has passed.

---

## Geometry Rules

### Base Grid

The discrete grid remains unchanged:

- `rowStart` / `rowSpan` still refer to shared row indices
- `colStart` / `colSpan` still refer to shared column indices
- `validateGrid()` still guarantees full tiling of the logical grid

What changes is only the physical pixel height of each row segment inside each column.

### Rectangular Cell Invariant

For every cell:

- left and right edges come from global `colSizes`
- top and bottom edges come from the column-local row profiles

For `colSpan === 1`, any column-local row profile is valid.

For `colSpan > 1`, the following must be true for all columns in the span:

- cumulative offset at `rowStart` is equal
- cumulative offset at `rowStart + rowSpan` is equal

If not, the layout is structurally invalid for rectangular rendering and must be normalized before persistence or blocked from creation by the editor.

### Resize Handle Grouping

Horizontal resize handles are generated from actual cell borders, not from the global `rowSizes` list.

A handle can be:

- **single-column:** adjusts the boundary only inside one column
- **multi-column grouped:** adjusts the shared boundary for a spanning cell across every column it covers

A handle is never shown if dragging it would create a non-rectangular spanning cell.

### Mobile and Tablet

The existing responsive fallbacks in `dashboard.tsx` remain unchanged:

- `<= 600px`: single stacked column
- `<= 900px`: two-column stacked fallback

Per-column vertical resizing is a desktop-only concern.

---

## Rendering Architecture

### Live Dashboard

The desktop renderer in `apps/app/components/dashboard/dashboard/index.tsx` must stop depending on:

- `gridTemplateRows: sizesToGridTemplate(liveRowSizes)`
- full-width row resize handles mounted from `liveRowSizes`

Instead:

1. Keep the dashboard surface container.
2. Keep CSS grid for the outer shell only if useful for ticker/chrome placement.
3. Render dashboard widgets inside a positioned content layer where each widget card gets explicit `top`, `left`, `width`, and `height` percentages from `getCellRect()`.
4. Continue using CSS grid or flex fallbacks for mobile/tablet stacked rendering.

This separates desktop geometry from the limitations of CSS grid row tracks while leaving the rest of the dashboard shell intact.

### Project Switch Skeleton Overlay

`apps/app/components/projects/project-switch-skeleton-overlay/index.tsx` and `apps/app/components/dashboard/dashboard-skeleton/index.tsx` must use the same desktop geometry helper so skeletons match the live layout when column-local vertical sizes are present.

---

## Interaction Design

### Live Dashboard Edit Mode

In desktop edit mode:

- column handles stay global and continue to resize adjacent columns
- horizontal handles are attached to actual visible cell borders
- dragging a handle updates only the affected column profile or grouped span
- drag feedback is live and immediate, matching today’s resize behavior
- persistence still happens on drag end only

State changes:

- replace `liveRowSizes` with `liveColumnRowSizes`
- keep `liveColSizes`
- update `handleRowResizeEnd` to persist `columnRowSizes`

### `Settings > Layouts`

The editor in `apps/app/components/settings/settings-layouts/index.tsx` must use the same geometry engine as the live dashboard.

Changes:

- remove the assumption that a single left-side row rail describes all vertical tracks
- keep the top column rail for global column insertion/removal
- render horizontal resize handles on actual cell borders inside the preview
- show column-local percentages in the summary readout

Recommended summary format:

- `Columns: 40% / 30% / 30%`
- `Vertical splits: C1 45/20/35 · C2 33/33/34 · C3 20/45/35`

Button behavior:

- `Cols`: rebalance `colSizes`
- `Rows`: reset every column profile to equal row sizes for the current `rowCount`
- `Balance`: reset both `colSizes` and every column profile to equal splits

---

## Structure Operations

### Insert Row / Remove Row

Row insertion and removal stays global.

Implementation rule:

- existing `insertRow()` / `removeRow()` continue to update `LayoutCell.rowStart` and `rowSpan`
- each operation must also update every `columnRowSizes[columnIndex]` using the same proportional split/merge logic currently used for `rowSizes`

This preserves shared row indices while allowing each column profile to diverge afterward.

### Insert Column / Remove Column

Column insertion and removal remains global.

Additional rule:

- inserting a column seeds the new column’s row profile from the nearest existing column after split
- removing a column also removes its row profile

### Merge Cells

Merging remains explicit and user-initiated.

Rules:

- vertical merges within one column do not require cross-column normalization
- horizontal merges that create `colSpan > 1` must align the merged cell’s top and bottom boundaries across the participating columns

Normalization rule for horizontal merge:

- compute the merged cell’s top and bottom cumulative offsets for each participating column
- snap those shared boundaries to a single normalized value using the arithmetic mean
- redistribute the affected row segments within each participating column so totals remain `100`

This makes an explicit merge action succeed without requiring the user to manually align columns first.

### Split Cell

Split remains explicit and discrete.

Rules:

- vertical split of a cell works exactly as today and does not affect row profiles
- horizontal split of a single-column cell works exactly as today
- horizontal split of a multi-column cell must create an aligned boundary across all columns the cell spans

Normalization rule for horizontal split of a multi-column cell:

- determine the new shared boundary at the split row index
- align that cumulative offset across the participating columns using the arithmetic mean
- redistribute the adjacent row segments in each participating column

This keeps split behavior explicit and predictable while preserving the rectangular invariant.

### Resize Drag vs Structural Auto-Fixes

Explicit structure changes may normalize boundaries.

Resize dragging may not.

That means:

- merge/split operations are allowed to snap profiles as part of an intentional structural edit
- drag handles never silently create or resolve structural inconsistencies
- if a drag would violate the invariant, the handle is not rendered

---

## Persistence and Context

### `use-dashboard`

Update `packages/hooks/src/use-dashboard.tsx`:

- replace `updateLayoutSizes(layoutId, colSizes, rowSizes)` with `updateLayoutSizes(layoutId, colSizes, columnRowSizes)`
- propagate `columnRowSizes` through `onWidgetLayoutConfigChange`
- continue preserving all other config fields exactly as today

`activeLayout` should always expose resolved `columnRowSizes` to consumers through layout helpers rather than requiring every caller to reimplement fallback logic.

### Settings Storage and API

The layout JSON already lives inside the existing `widget_layout` blob, so no database schema migration is required.

Required changes:

- `packages/types/src/database.ts`: add `columnRowSizes?: number[][]`
- `apps/app/app/api/settings/route.ts`: allow nested numeric arrays on `LayoutDefinition`
- SQLite / Turso / PlanetScale settings repositories do not need column changes because they persist opaque JSON

### Migration Behavior

There is no one-time migration step.

Instead:

- old layouts continue to deserialize with only `rowSizes`
- helper resolution derives `columnRowSizes` at read time
- once a layout is edited and saved, the new `columnRowSizes` field is persisted

---

## Error Handling and Invariants

The implementation must reject or repair these invalid states:

- `columnRowSizes.length !== colCount`
- any column profile length differs from `rowCount`
- any column profile sums to something other than `100` after normalization tolerance
- any spanning cell has mismatched top/bottom offsets across its columns

Rules:

- helper-level normalization repairs malformed persisted arrays when possible
- UI editors should never emit an invalid layout
- rendering should fail safe to normalized values, not to partially broken geometry
- invariant violations should be surfaced during tests rather than silently ignored

No destructive fallback is allowed that deletes cells or rewrites widget assignments.

---

## Testing

### Unit Tests

Add tests in `packages/widgets/src/layouts/layouts.test.ts` for:

- `resolveColumnRowSizes()` fallback from legacy `rowSizes`
- normalization of malformed `columnRowSizes`
- cell rectangle calculation for single-column and multi-column cells
- spanning-cell alignment validation
- horizontal merge normalization
- horizontal split normalization
- insert/remove row updating every column profile
- insert/remove column seeding/removing the correct profile

### Hook and Persistence Tests

Add tests in:

- `packages/hooks/src/use-dashboard.tsx`
- `apps/app/hooks/settings-store.ts`
- `apps/app/app/api/settings/route.test.ts`

Coverage:

- persisting `columnRowSizes`
- preserving `columnRowSizes` across unrelated settings updates
- round-tripping old and new layout JSON shapes

### UI Tests

Add targeted tests for:

- desktop edit mode showing column-local horizontal handles
- spanning cells suppressing invalid local handles
- `Settings > Layouts` preview matching the same geometry as the live dashboard

---

## Files Expected to Change

- `packages/types/src/database.ts`
- `packages/widgets/src/layouts/index.ts`
- `packages/widgets/src/layouts/layouts.test.ts`
- `packages/widgets/src/resize-handle/index.tsx`
- `packages/hooks/src/use-dashboard.tsx`
- `apps/app/components/dashboard/dashboard/index.tsx`
- `apps/app/components/dashboard/dashboard-skeleton/index.tsx`
- `apps/app/components/projects/project-switch-skeleton-overlay/index.tsx`
- `apps/app/components/settings/settings-layouts/index.tsx`
- `apps/app/app/api/settings/route.ts`
- related tests under `apps/app/hooks`, `apps/app/components`, and `packages/hooks`

---

## Implementation Notes

- Prefer introducing a dedicated desktop geometry helper layer in `packages/widgets/src/layouts/index.ts` instead of duplicating percentage math in the dashboard and settings editor.
- Keep the old responsive stacked rendering paths intact to limit the blast radius.
- Do not attempt to solve non-rectangular cells. The entire design depends on never needing them.

---

## Out of Scope

- Arbitrary drag-to-freeform layout editing
- Widget-specific min/max height constraints
- Automatic reflow of widget assignments when geometry changes
- Any change to page tabs, project tabs, KPI strip, or ticker behavior
