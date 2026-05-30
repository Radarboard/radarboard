# Context-Aware Widget Editor — Design Spec

**Date:** 2026-03-18
**Status:** Approved

---

## Overview

The existing `SettingsWidgets` component becomes a context-aware, reusable widget assignment editor. It can be invoked in two modes:

1. **Global mode** — the current behaviour. Reads/writes `WidgetLayoutConfig.layout` (slot1–slot9). Accessed via Settings > Widgets as today.
2. **Project mode** — invoked from the project detail panel (Settings > Projects). Reads/writes `ProjectLayoutConfig.cellWidgets` for a specific project+layout combination. The grid shape reflects the project's chosen `LayoutDefinition`; merged cells render merged; only cells that actually exist in the layout are shown.

No UI is duplicated. The same drag-and-drop widget library, grid preview, search, toggle, and reset live in one component. A `context` prop controls which data store is read from and written to.

---

## Goals

- Eliminate duplicate widget assignment UI.
- Allow per-project widget assignment scoped to a project's chosen `LayoutDefinition`.
- Grid preview shape matches the layout — a 7-cell layout shows 7 cells, not 9.
- Cells that don't exist in the layout are not shown or assigned.
- The global layout (slot1–slot9) is untouched by per-project edits.
- The editor opens in a full-screen modal (same dimensions as the settings modal) when triggered from the project detail panel.

---

## Data Model Changes

### `ProjectLayoutConfig` (extended)

`packages/types/src/database.ts`:

```ts
export interface ProjectLayoutConfig {
  layoutId?: string;
  layout?: Record<string, string | null>;  // kept for backwards compat — never read by dashboard
  cellWidgets?: Record<string, string | null>; // cellId → widgetId  [NEW]
}
```

`cellWidgets` maps each `LayoutCell.id` from the chosen `LayoutDefinition` to a widget ID (or `null` for empty). Only cells that exist in the `LayoutDefinition` should appear as keys. There are no phantom entries.

**No change** to `WidgetLayoutConfig.layout` (the global slot1–slot9 map). The old `ProjectLayoutConfig.layout` field is retained only for backwards compatibility and must never be read by the dashboard resolver — only `cellWidgets` is used for project-mode rendering.

---

## Component Architecture

### `SettingsWidgets` — new `context` prop

`apps/app/components/settings-widgets.tsx`:

```ts
export type WidgetEditorContext =
  | { mode: "global" }
  | {
      mode: "project";
      projectSlug: string;
      layoutId: string;
      layout: LayoutDefinition;
    };
```

`SettingsWidgets` accepts an optional `context?: WidgetEditorContext` prop (defaults to `{ mode: "global" }`).

#### Global mode — unchanged behaviour

Reads `widgetLayout` (slot1–slot9), writes via `updateWidgetLayout`. Grid renders `GRID_SLOTS` (always 9 slots). No context banner. `handleToggle` uses `GRID_SLOTS` to find an empty slot for displaced widgets, unchanged.

#### Project mode

**Reads/writes:** reads `projectLayouts[projectSlug].cellWidgets ?? {}`. Writes via `updateProjectLayout(slug, { ...existing, cellWidgets: newMap })`.

**Context banner:** shown at top of editor — project colour dot + project name + layout name badge (layout.name) + caption "Editing project overrides · global unchanged". If layout has no name, fall back to "Custom Layout".

**Grid:** renders `context.layout.cells` instead of `GRID_SLOTS`. Each `LayoutCell` becomes a `DroppableSlot` whose drop-zone ID is `cell-${cell.id}` (prefixed to avoid collision with global `slot-slotN` IDs). Cells are positioned using the same absolute-position math as `GridEditor`: `left = cell.colStart * cellSize`, etc., within a fixed-size container matching the settings preview pane.

**`SLOT_LABELS` and cell labels:** In project mode, `DroppableSlot` does not use `SLOT_LABELS`. Instead it shows the cell's position as a label: `R${cell.rowStart + 1}C${cell.colStart + 1}` (e.g. "R1C1", "R2C3"), or the widget name if occupied. This avoids the `undefined` lookup from the hardcoded `SLOT_LABELS` map.

**`handleToggle` in project mode:** When toggling a widget on, it is placed in the first cell in `context.layout.cells` whose ID is not present in `cellWidgets` (i.e. the first unoccupied cell). If all cells are occupied, the toggle is a no-op (widget cannot be placed). When toggling off, the widget's cell entry is set to `null`.

**`handleDragEnd` in project mode:** Drag sources remain `lib-<widgetId>` from the library. Drop targets use `cell-${cell.id}`. When a widget is dropped onto a cell, it is placed in that cell; any widget previously in that cell is displaced to the first available empty cell (same swap logic as global mode, but iterating `context.layout.cells` instead of `GRID_SLOTS`).

**Reset:** Clears `cellWidgets` for the project (sets to `{}`), reverting to no project override. Dashboard falls back to global layout.

**`configWidgetId` query param isolation:** The shared `useQueryState("widget-config")` param causes conflicts when `SettingsWidgets` is rendered inside both `SettingsModal` and `WidgetEditorModal` simultaneously. In project mode, `SettingsWidgets` must use `useState` (local state) for the widget detail dialog selection instead of `useQueryState`. A `useConfigWidgetId` internal hook abstracts this: in global mode it uses `useQueryState`; in project mode it uses `useState`.

---

### `WidgetEditorModal`

New file `apps/app/components/widget-editor-modal.tsx`:

```ts
interface WidgetEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: WidgetEditorContext;
  onNavigateToIntegrations?: () => void;
}
```

Renders a `Dialog` with `DialogContent` matching settings modal dimensions (`max-w-[1400px] h-[80vh] max-h-[850px] overflow-hidden flex flex-col`). No settings sidebar — the full width is given to `SettingsWidgets`. A `DialogHeader` shows "Widget Assignment — {project name} / {layout name}" as the title.

---

## Dashboard Context Changes

### `DashboardContextValue` — new field

`packages/hooks/src/use-dashboard.tsx`:

```ts
activeCellWidgets: Record<string, string | null> | null;
// null = no project override active, use global slot layout
```

**Resolution logic:**

```
if activeProjectSlug is set
  AND projectLayouts[slug].layoutId is set (a custom layout is explicitly chosen)
  AND that layoutId resolves to a valid LayoutDefinition in widgetLayoutConfig.layouts
  AND projectLayouts[slug].cellWidgets is non-empty:
    activeCellWidgets = projectLayouts[slug].cellWidgets
else:
    activeCellWidgets = null
```

The `BASIC_3X3` default is never explicitly stored as a `layoutId` — a project with no `layoutId` override always falls through to `activeCellWidgets = null`, using the global layout.

**Deleted layout fallback:** If `projectLayouts[slug].layoutId` references a layout that no longer exists in `widgetLayoutConfig.layouts`, `activeLayout` falls back to `BASIC_3X3` (already implemented). In this case `activeCellWidgets` is also set to `null` — the project falls back to the global layout entirely. Stale `cellWidgets` data is preserved in storage (not deleted) but ignored until the project is assigned a valid layout again.

**Stale `cellWidgets` keys:** When `activeCellWidgets` is used for rendering, the dashboard iterates `activeLayout.cells` (not `cellWidgets` keys directly). A cell whose ID is absent from `cellWidgets` renders empty. A `cellWidgets` entry whose ID does not appear in `activeLayout.cells` is silently ignored — it never causes an error. This means a user can safely edit a `LayoutDefinition` after assigning widgets; the assignments for surviving cells are preserved, and cells that were merged away just get dropped on next save.

**When a layout is edited (cells change):** `updateLayouts` in `use-dashboard.tsx` does not sanitise `cellWidgets`. Stale keys are left in storage and silently ignored at render time (see above). No warning is shown — this is acceptable because the cell's widget assignment is simply "lost" when its cell is merged, which is intuitive.

---

## Dashboard Rendering Changes

### `dashboard.tsx` — two render paths

**When `activeCellWidgets` is null (global mode):** No change to existing render. Static `dashboard-grid` CSS class, `GRID_SLOTS` iteration, `WidgetSlotWithUrl` as today.

**When `activeCellWidgets` is non-null (project mode):**
- The `dashboard-grid` container receives an additional inline `style` with `gridTemplateAreas: generateGridTemplateAreas(activeLayout)`. The static CSS `grid-template-areas` in `globals.css` is overridden by the inline style.
- Instead of iterating `GRID_SLOTS`, `dashboard.tsx` iterates `activeLayout.cells` and renders one `WidgetSlotWithUrl` per cell, passing `cellId={cell.id}` and `slot={cell.id}` (a temporary passthrough until `WidgetSlot` is updated — see below).
- The `ResizeHandle` overlay is hidden (rendered as `null`) when `activeCellWidgets` is active. Resize handles are only meaningful on the standard 3-row layout structure. In project mode with a custom layout, resizing is not supported.

### `WidgetSlotWithUrl` — project mode awareness

`WidgetSlotWithUrl` currently reads `widgetLayout[slot]` to determine the active widget for URL state. In project mode it must read `activeCellWidgets[cellId]` instead.

Updated signature:
```ts
function WidgetSlotWithUrl({
  slot,        // GridSlot in global mode; cell.id in project mode
  cellId,      // optional — when set, triggers project-mode lookup
  ...
})
```

When `cellId` is provided, widget ID is resolved from `activeCellWidgets[cellId]`. The `detail` URL param logic (encoding `widgetId:itemId`) is unchanged.

---

## `WidgetSlot` Changes

`packages/widgets/src/widget-slot/index.tsx`:

A new optional prop `cellId?: string` is added. When `cellId` is present:
- Widget ID is resolved from `activeCellWidgets[cellId]` (read from context).
- The root element receives `style={{ gridArea: cellId.replace(/-/g, '_') }}` instead of `className="dashboard-${slot}"`.
- The `ErrorBoundary` wrapper receives the same `style` prop (or a wrapping `div` handles the `gridArea`).

When `cellId` is absent — global mode — behaviour is completely unchanged (`dashboard-${slot}` CSS class, `widgetLayout[slot]` lookup).

`generateGridTemplateAreas` is already exported from `packages/widgets/src/layouts/index.ts` — no move needed.

---

## Project Detail Panel Changes

`apps/app/components/settings-projects.tsx` — `ProjectDetailPanel`:

1. The layout picker row is restructured: layout thumbnail tiles on the left, an **"Edit widgets →"** button on the right. The button is **only shown when a custom layout (not the default) is selected** for the project. When no custom layout is set, the project inherits the global widget assignment, so there is nothing to edit at the project level — editing happens in Settings > Widgets.
2. Clicking "Edit widgets →" opens `WidgetEditorModal` with:
   ```ts
   context = {
     mode: "project",
     projectSlug: project.slug,
     layoutId: activeLayoutId || BASIC_3X3.id,
     layout: resolvedLayout, // layouts.find(l => l.id === activeLayoutId) ?? BASIC_3X3
   }
   ```
3. `WidgetEditorModal` state is managed via `useState(false)` for the `open` boolean — no URL state needed.

---

## Files Changed

| File | Change |
|---|---|
| `packages/types/src/database.ts` | Add `cellWidgets?: Record<string, string \| null>` to `ProjectLayoutConfig` |
| `packages/hooks/src/use-dashboard.tsx` | Add `activeCellWidgets` to `DashboardContextValue`; derive from `projectLayouts` + `activeLayout`; update all three config-reconstruction callbacks to preserve new field |
| `packages/widgets/src/widget-slot/index.tsx` | Add optional `cellId` prop; resolve widget and grid-area from `activeCellWidgets` when set |
| `apps/app/components/dashboard.tsx` | Two render paths based on `activeCellWidgets`; hide `ResizeHandle` in project mode; pass `cellId` to `WidgetSlotWithUrl`; update `WidgetSlotWithUrl` for project-mode widget resolution |
| `apps/app/components/settings-widgets.tsx` | Add `context` prop + `WidgetEditorContext` type; context banner; project-mode grid render using `LayoutCell` geometry; project-mode reads/writes; `handleToggle`/`handleDragEnd` project-mode variants; `useConfigWidgetId` abstraction for dialog state isolation |
| `apps/app/components/widget-editor-modal.tsx` | New: thin `Dialog` wrapper around `SettingsWidgets` with project context |
| `apps/app/components/settings-projects.tsx` | Add "Edit widgets →" button; `useState` for modal open; resolve layout for context |

---

## Out of Scope

- Multiple named widget presets per project — one active config only.
- Widget-level config overrides per project — `widgetConfigs` remains global.
- Responsive grid changes — project-mode layout only applies at full width; the responsive CSS breakpoints in `globals.css` are not changed and may not reflect custom layouts on small screens.
- Migrating `ProjectLayoutConfig.layout` (old slot-based field) to `cellWidgets` — old data is ignored going forward.
- Sanitising stale `cellWidgets` keys on layout edit — stale keys are silently ignored at render time.
