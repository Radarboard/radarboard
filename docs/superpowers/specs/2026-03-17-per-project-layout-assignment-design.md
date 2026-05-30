# Per-Project Layout Assignment — Design Spec

**Date:** 2026-03-17
**Status:** Approved

---

## Overview

Each project can have its own independent grid layout (cell structure) and widget-per-slot assignment. When a specific project is active, the dashboard uses that project's layout and widget mapping. When viewing "All projects" (no active project), the global layout is used as a fallback.

---

## Goals

- Allow each project to use a different `LayoutDefinition` (grid cell shape).
- Allow each project to have its own widget-per-slot assignment.
- The global layout continues to function as the "All projects" view.
- No database schema migrations required.
- Expose assignment from two settings surfaces: **Settings > Layouts** and **Settings > Projects**.
- Widget-per-slot editing per project is accessible from **Settings > Widgets** via a project selector.

---

## Data Model

### New type: `ProjectLayoutConfig`

Added to `packages/types/src/database.ts`:

```ts
export interface ProjectLayoutConfig {
  layoutId: string;                        // ID of the LayoutDefinition to use
  layout: Record<string, string | null>;   // slot → widgetId for this project
}
```

### Extended `WidgetLayoutConfig`

```ts
export interface WidgetLayoutConfig {
  layout: Record<string, string | null>;           // global / "All projects" slots
  configs: Record<string, Record<string, unknown>>; // per-widget config overrides
  layouts?: LayoutDefinition[];                     // saved LayoutDefinitions
  projectLayouts?: Record<string, ProjectLayoutConfig>; // slug → per-project config  [NEW]
}
```

`projectLayouts` is optional; a missing entry for a project slug means "use the global defaults".

---

## Resolution Logic

When resolving what the dashboard renders for the current view:

| Condition | Grid shape | Widget slots |
|---|---|---|
| `activeProjectSlug` is null | `BASIC_3X3` (or global `layoutId` if added later) | global `layout` |
| `activeProjectSlug` set, no `projectLayouts[slug]` entry | `BASIC_3X3` | global `layout` |
| `activeProjectSlug` set, `projectLayouts[slug]` exists | `layoutId` → resolved `LayoutDefinition` | `projectLayouts[slug].layout` |

Fallback for widget slots: if a project has a `layoutId` but no explicit `layout` entry, inherit the global `layout` as the starting point.

---

## Dashboard Context Changes (`packages/hooks/src/use-dashboard.tsx`)

### New derived values on `DashboardContextValue`

```ts
activeLayoutId: string;              // resolved layout ID for current view
activeLayout: LayoutDefinition;      // resolved LayoutDefinition object
```

Both fall back to `BASIC_3X3` when no project-specific layout is set.

The existing `widgetLayout` is updated to resolve as:
```
projectLayouts[activeProjectSlug]?.layout ?? global layout
```

### New callback

```ts
updateProjectLayout: (slug: string, config: ProjectLayoutConfig) => void;
```

Merges `{ ...widgetLayoutConfig.projectLayouts, [slug]: config }` and calls `onWidgetLayoutConfigChange`.

### Critical: preserve `projectLayouts` in all config-reconstruction callbacks

The existing callbacks `updateLayouts`, `updateWidgetLayout`, and `updateWidgetConfig` each reconstruct the full `WidgetLayoutConfig` object via a spread. All three must be updated to pass `projectLayouts` through as a preserved field:

```ts
// Example: updateLayouts — before
{ layout: widgetLayoutConfig?.layout ?? DEFAULT_LAYOUT, configs: ..., layouts: newLayouts }

// After
{ layout: ..., configs: ..., layouts: newLayouts, projectLayouts: widgetLayoutConfig?.projectLayouts }
```

Failing to do this in any one of the three callbacks causes silent erasure of all per-project layout data on the next settings save.

### `GridSlot` type boundary

The existing `widgetLayout` on context is typed as `Record<GridSlot, string | null>` where `GridSlot` is the union `"slot1" | ... | "slot9"`. `ProjectLayoutConfig.layout` is typed as `Record<string, string | null>` (wider) to allow future non-standard slot keys.

When merging per-project layout into the context's `widgetLayout`, the implementation must cast or narrow to `Record<GridSlot, string | null>` for compatibility with existing consumers. Per-project slot keys must always use `slot1`–`slot9` identifiers — they are not `LayoutCell.id` values.

---

## Grid Rendering (`apps/app/components/dashboard.tsx`)

The grid container must apply `grid-template-areas` CSS based on `activeLayout` (the resolved `LayoutDefinition`) rather than always defaulting to the standard 3×3. The existing `generateGridTemplateAreas()` utility from `@radarboard/widget-engine/layouts` is used.

The `widgetLayout` resolved in context already accounts for the active project, so `WidgetSlot` needs no changes — it continues to read `widgetLayout[slot]`.

---

## Settings UI

### Settings > Layouts (`settings-layouts.tsx`)

Changes to the right panel (editor side):

1. A **"Assigned projects"** section below the grid editor listing all projects with checkboxes.
2. Checking a project sets `projectLayouts[slug].layoutId = selectedLayout.id`. If no `layout` entry exists yet for the project, it is initialized from the global layout.
3. Unchecking removes the `layoutId` override (project reverts to default 3×3). Widget-slot overrides for that project are preserved unless explicitly cleared.
4. The left sidebar list item for each layout shows a secondary badge: e.g., "2 projects" when assigned.

### Settings > Projects (`settings-projects.tsx`)

Each project row gets a **"Layout"** inline dropdown showing:
- "Default (3×3)" — no override
- One entry per saved `LayoutDefinition` by name

Selecting an option sets `projectLayouts[slug].layoutId`. This reads/writes the same `projectLayouts` data as the Layouts settings page.

### Settings > Widgets (`settings-widgets.tsx`)

A **project selector** (dropdown or tab strip) is added at the top of the Widgets settings panel. Options: "All projects (global)", then one entry per project.

- Selecting "All projects" shows and edits the global `layout`.
- Selecting a project shows and edits `projectLayouts[slug].layout`. If no per-project layout exists yet, it is pre-populated from the global layout as a starting point.
- A "Reset to global defaults" action clears the project's `layout` override (but keeps `layoutId` if set).

The existing `SLOT_LABELS` (`slot1` → "Top Left", etc.) remain valid because per-project widget slot assignments always use `slot1`–`slot9` keys, regardless of which `LayoutDefinition` shape the project uses. The grid shape (cell merges) and the slot-to-widget mapping are independent concerns.

---

## Persistence

No new DB columns or API routes are required. The `projectLayouts` field is stored as part of the existing `widget_layout` JSON column via the existing `setWidgetLayout` / `getWidgetLayout` adapters and `POST /api/settings` route.

The API route's existing validation (`wl.layout` must be an object) is extended to also allow `wl.projectLayouts` to be an object when present.

---

## Files Changed

| File | Change |
|---|---|
| `packages/types/src/database.ts` | Add `ProjectLayoutConfig` type; add `projectLayouts?` to `WidgetLayoutConfig` |
| `packages/hooks/src/use-dashboard.tsx` | Add `activeLayoutId`, `activeLayout`, `updateProjectLayout` to context; update `widgetLayout` resolution |
| `apps/app/components/dashboard.tsx` | Apply `grid-template-areas` from `activeLayout`; add `"layouts"` to `VALID_SETTINGS_SECTIONS` (already done) |
| `apps/app/hooks/use-settings.ts` | `mergeWithDefaults` preserves `projectLayouts`; no other changes needed |
| `apps/app/app/api/settings/route.ts` | Extend POST validation to accept `projectLayouts` |
| `apps/app/components/settings-layouts.tsx` | Add "Assigned projects" section with checkboxes; show assignment count in list |
| `apps/app/components/settings-projects.tsx` | Add per-row layout dropdown |
| `apps/app/components/settings-widgets.tsx` | Add project selector at top; route slot edits to correct layout map |

---

## Out of Scope

- Per-project widget configs (`configs` per project) — widget-level config remains global.
- Persisting the "All projects" layout ID — the global view always uses `BASIC_3X3`.
- Any UI for reordering or duplicating layouts (handled by the existing Layouts settings).
