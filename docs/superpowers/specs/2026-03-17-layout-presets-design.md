# Layout Presets System

**Date:** 2026-03-17
**Status:** Draft

## Problem

The dashboard has a single hardcoded CSS grid layout with 6 asymmetric content slots. The grid shape is fixed in `globals.css` and cannot be changed at runtime. Users have no way to choose different arrangements of widgets, and adding new layouts requires editing CSS and multiple code files.

The goal is to replace this with a data-driven layout system where the grid shape is defined by selectable presets. The first preset is a uniform 3x3 grid with 9 identical slots.

## Decisions

- **Architecture:** Data-driven presets. Each layout is a plain object describing CSS grid properties and slot names. A single generic grid component renders any preset.
- **Grid shape:** The 3x3 preset uses equal cells (`1fr 1fr 1fr` columns and rows). All 9 slots are identical in size.
- **Chrome preservation:** Topbar, tabs, KPI strip, and bottom ticker remain in fixed positions. Only the content area between KPIs and ticker is controlled by the layout preset.
- **Empty slots:** Display a visual placeholder (dashed border, "+" icon, "Add widget" label).
- **Widget compatibility:** Deferred. All widgets render in any slot. Size preference fields (`minColumns`/`minRows`) can be added in a future iteration when layouts with varying slot sizes exist.
- **Widget naming:** Widget display names describe their function, not the service they connect to. Service-specific names (e.g. "Open Collective", "App Store") become function-based names (e.g. "Finances", "App Reviews").
- **Layout switching:** A dropdown selector in the topbar, showing a mini grid icon per preset.
- **Current layout:** The existing asymmetric 6-slot layout is replaced by the 3x3. It does not become a selectable preset (it may be re-added later as a preset if desired).
- **Scaling:** The system is designed for 4+ presets over time. Adding a new layout means adding a new data object to the registry.

## Design

### LayoutPreset type

```ts
// packages/widgets/src/layouts/types.ts

export interface LayoutPreset {
  /** Unique identifier, e.g. "uniform-3x3". */
  id: string;
  /** Display name shown in the selector dropdown. */
  name: string;
  /** Lucide icon name for the selector (e.g. "grid-3x3"). */
  icon: string;
  /** CSS grid-template-columns value, e.g. "1fr 1fr 1fr". */
  columns: string;
  /** CSS grid-template-rows value for content slots, e.g. "1fr 1fr 1fr". */
  rows: string;
  /** Grid-template-areas rows for content slots only.
   *  Chrome areas (topbar, tabs, kpis, ticker) are prepended/appended by the renderer. */
  areas: string[];
  /** Ordered slot identifiers. Must match area names. */
  slots: string[];
  /** Number of columns in this layout (used by widget size preference checks). */
  columnCount: number;
  /** Number of rows in this layout. */
  rowCount: number;
  /** Optional responsive overrides. Keys are max-width breakpoints in px. */
  responsive?: Record<number, {
    columns: string;
    rows: string;
    areas: string[];
  }>;
}
```

### First preset: Uniform 3x3

```ts
// packages/widgets/src/layouts/presets/uniform-3x3.ts

export const uniform3x3: LayoutPreset = {
  id: "uniform-3x3",
  name: "Uniform Grid",
  icon: "grid-3x3",
  columns: "1fr 1fr 1fr",
  rows: "1fr 1fr 1fr",
  areas: [
    "s1 s2 s3",
    "s4 s5 s6",
    "s7 s8 s9",
  ],
  slots: ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9"],
  columnCount: 3,
  rowCount: 3,
  responsive: {
    900: {
      columns: "1fr 1fr",
      rows: "1fr 1fr 1fr 1fr 1fr",
      areas: [
        "s1 s2",
        "s3 s4",
        "s5 s6",
        "s7 s8",
        "s9 s9",
      ],
    },
    600: {
      columns: "1fr",
      rows: "repeat(9, minmax(250px, auto))",
      areas: [
        "s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9",
      ],
    },
  },
};
```

### Layout registry

```ts
// packages/widgets/src/layouts/registry.ts

import type { LayoutPreset } from "./types";
import { uniform3x3 } from "./presets/uniform-3x3";

export const LAYOUT_PRESETS = new Map<string, LayoutPreset>([
  [uniform3x3.id, uniform3x3],
]);

export const DEFAULT_LAYOUT_ID = "uniform-3x3";
```

### WidgetDescriptor.defaultSlot removal

The current `WidgetDescriptor` has a `defaultSlot: GridSlot` field (e.g. `defaultSlot: "detail"`). With dynamic slot names per layout preset, these hardcoded slot names are meaningless.

**Change:** Remove the `defaultSlot` field from `WidgetDescriptor`. Its role is replaced by `DEFAULT_SLOT_ASSIGNMENTS` in `layouts/defaults.ts`, which maps slot names to widget IDs per preset.

**Impact on settings UI:** `settings-widgets.tsx` uses `descriptor.defaultSlot` in `handleToggle` (line 543) to decide where to place a re-enabled widget. This changes to: find the first empty slot in the active layout, or use the widget's default slot from `DEFAULT_SLOT_ASSIGNMENTS` for the active preset.

All 6 widget descriptors are updated to remove `defaultSlot`.

### Widget naming: function over service

Widget display names should describe what the widget does, not which service backs it. This makes the dashboard understandable regardless of which integrations are configured.

| Widget ID | Current `name` | New `name` | Rationale |
|-----------|---------------|------------|-----------|
| `revenue` | Revenue | Revenue | Already agnostic. |
| `shipping` | Shipping Log | Shipping | Already agnostic. |
| `ideas` | Ideas + Bugs | Ideas | Already agnostic. |
| `analytics` | Analytics | Analytics | Already agnostic. |
| `seo` | SEO Performance | SEO | Already agnostic. |
| `detail` | Detail Panel | Detail | Already agnostic. |

The `detail` widget dynamically resolves its title via `getDetailTitle()` based on which integration is active. The current mode-to-title mapping uses service names:

```ts
// BEFORE (detail/index.tsx)
const TITLES: Record<DetailMode, string> = {
  opencollective: "Open Collective",  // service name
  sentry: "Errors",                   // already agnostic
  appstore: "App Store",              // service name
  health: "Health Monitors",          // already agnostic
};

// AFTER
const TITLES: Record<DetailMode, string> = {
  opencollective: "Finances",
  sentry: "Errors",
  appstore: "App Reviews",
  health: "Health",
};
```

### GridSlot type change

The current `GridSlot` is a union of 6 hardcoded strings:

```ts
// BEFORE
export type GridSlot = "revenue" | "shipping" | "ideas" | "analytics" | "seo" | "detail";
```

This becomes `string` since slot names are now dynamic per layout preset:

```ts
// AFTER
export type GridSlot = string;
```

This is the simplest change. The type alias is kept for readability and to mark intent.

### Default widget-to-slot mapping

Each layout preset needs a default mapping of which widget goes in which slot. This is separate from the preset definition (presets define grid shape, not content).

```ts
// packages/widgets/src/layouts/defaults.ts

/** Default widget assignments for each layout preset, keyed by preset ID. */
export const DEFAULT_SLOT_ASSIGNMENTS: Record<string, Record<string, string | null>> = {
  "uniform-3x3": {
    s1: "revenue",
    s2: "shipping",
    s3: "ideas",
    s4: "analytics",
    s5: "seo",
    s6: "detail",
    s7: null,
    s8: null,
    s9: null,
  },
};
```

### WidgetLayoutConfig persistence change

The persisted config adds `activeLayoutId` and changes `layout` to be per-preset:

```ts
// BEFORE
export interface WidgetLayoutConfig {
  layout: Record<string, string | null>;
  configs: Record<string, Record<string, unknown>>;
}

// AFTER
export interface WidgetLayoutConfig {
  /** Active layout preset ID. */
  activeLayoutId?: string;
  /** Widget-to-slot mappings, keyed by layout preset ID.
   *  Each value maps slot name -> widget ID or null. */
  layouts?: Record<string, Record<string, string | null>>;
  /** Per-widget config overrides (shared across all layouts). */
  configs: Record<string, Record<string, unknown>>;
}
```

The old `layout` field is kept for backward compatibility during migration. On load, if `layouts` is absent but `layout` is present, the old mapping is treated as the default for whatever layout was previously active (effectively the old 6-slot layout mapping gets ignored since that layout no longer exists, and the 3x3 default takes over).

### DashboardContext changes

`useDashboard` exposes the active layout and a setter:

```ts
interface DashboardContextValue {
  // ...existing fields (timeRange, granularity, currency, activeProjectSlug,
  //   projects, orderedProjects, projectOrder, expandedWidgetId,
  //   updateProjectOrder, setTimeRange, setGranularity, setCurrency,
  //   setActiveProject, expandWidget, collapseWidget, updateWidgetConfig)...

  /** Active layout preset. */
  activeLayout: LayoutPreset;
  /** Set the active layout by preset ID. */
  setActiveLayout: (presetId: string) => void;
  /** Widget-to-slot mapping for the active layout. */
  widgetLayout: Record<string, string | null>;
  /** Per-widget config overrides. Unchanged from before. */
  widgetConfigs: Record<string, Record<string, unknown>>;
  /** Update widget-to-slot mapping for the active layout.
   *  Persists under the active preset key in WidgetLayoutConfig.layouts. */
  updateWidgetLayout: (layout: Record<string, string | null>) => void;
}
```

The `widgetLayout` type changes from `Record<GridSlot, string | null>` (with 6 hardcoded keys) to `Record<string, string | null>` (dynamic keys from the active preset's `slots`).

The `updateWidgetLayout` signature changes from `Record<GridSlot, string | null>` to `Record<string, string | null>`. Internally, the provider stores the updated mapping under `layouts[activeLayout.id]` in the persisted `WidgetLayoutConfig`.

### CSS changes

The hardcoded content-slot grid areas in `globals.css` are removed. Chrome area classes remain. The grid template is now applied as inline styles by the renderer.

```css
/* REMOVE these from globals.css: */
/* .dashboard-revenue { grid-area: revenue; } */
/* .dashboard-shipping { grid-area: shipping; } */
/* etc. */

/* KEEP these: */
.dashboard-topbar { grid-area: topbar; }
.dashboard-tabs { grid-area: tabs; }
.dashboard-kpis { grid-area: kpis; }
.dashboard-ticker { grid-area: ticker; }

/* The .dashboard-grid class keeps gap/height/background but loses its
   hardcoded grid-template-* properties. Those are set via inline styles. */
```

### Dashboard grid renderer

`dashboard.tsx` changes from iterating `GRID_SLOTS` to reading the active preset:

```tsx
function DashboardContent() {
  const { activeLayout, ... } = useDashboard();

  // Build full grid-template-areas including chrome rows
  const fullAreas = [
    `"topbar ${" topbar".repeat(activeLayout.columnCount - 1)}"`,
    `"tabs ${" tabs".repeat(activeLayout.columnCount - 1)}"`,
    `"kpis ${" kpis".repeat(activeLayout.columnCount - 1)}"`,
    ...activeLayout.areas.map(row => `"${row}"`),
    `"ticker ${" ticker".repeat(activeLayout.columnCount - 1)}"`,
  ].join("\n");

  const gridStyle = {
    gridTemplateColumns: activeLayout.columns,
    gridTemplateRows: `auto auto auto ${activeLayout.rows} auto`,
    gridTemplateAreas: fullAreas,
  };

  return (
    <div className="dashboard-grid" style={gridStyle}>
      <div className="dashboard-topbar">...</div>
      <div className="dashboard-tabs">...</div>
      <div className="dashboard-kpis">...</div>
      {activeLayout.slots.map(slot => (
        <WidgetSlot key={slot} slot={slot} />
      ))}
      <div className="dashboard-ticker">...</div>
    </div>
  );
}
```

### WidgetSlot changes

`WidgetSlot` currently accepts a `slot: GridSlot` prop and assigns `className={dashboard-${slot}}` to `WidgetCard`. Since slot names are now dynamic (e.g., "s1", "s2"), the CSS class approach no longer works. Instead, `WidgetSlot` passes a `style` prop with `gridArea`:

```tsx
export function WidgetSlot({ slot }: { slot: string }) {
  const { widgetLayout, widgetConfigs, projects, activeProjectSlug } = useDashboard();
  const widgetId = widgetLayout[slot] ?? null;

  if (!widgetId) {
    return <EmptySlot slot={slot} />;
  }

  const descriptor = WIDGET_REGISTRY.get(widgetId);
  if (!descriptor) {
    return (
      <div style={{ gridArea: slot }} className="flex items-center justify-center">
        <span className="text-[#555] text-xs font-mono">Unknown widget: {widgetId}</span>
      </div>
    );
  }

  const mergedConfig = { ...descriptor.defaultConfig, ...(widgetConfigs[widgetId] ?? {}) };
  const Component = descriptor.component;
  const ExpandedComponent = descriptor.expandedComponent;
  const title =
    descriptor.id === "detail" ? getDetailTitle(projects, activeProjectSlug) : descriptor.name;

  return (
    <WidgetCard
      title={title}
      style={{ gridArea: slot }}
      widgetId={descriptor.id}
      expandedContent={
        ExpandedComponent ? (
          <ExpandedComponent projectSlug={activeProjectSlug} config={mergedConfig} />
        ) : undefined
      }
    >
      <Component projectSlug={activeProjectSlug} config={mergedConfig} />
    </WidgetCard>
  );
}
```

### WidgetCard style prop

`WidgetCard` currently has no `style` prop. Add `style?: React.CSSProperties` to its props interface:

```tsx
// BEFORE
interface WidgetCardProps {
  title: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  action?: ReactNode;
  widgetId?: string;
  expandedContent?: ReactNode;
}

// AFTER
interface WidgetCardProps {
  title: string;
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  contentClassName?: string;
  action?: ReactNode;
  widgetId?: string;
  expandedContent?: ReactNode;
}
```

The `style` prop is spread onto the root `<section>` element alongside `className`. The existing `className` prop is kept for non-grid styling (e.g., custom borders), but `WidgetSlot` stops passing `className={dashboard-${slot}}` and uses `style` instead.

### EmptySlot component

A new component for empty grid cells:

```tsx
// packages/widgets/src/empty-slot.tsx

export function EmptySlot({ slot }: { slot: string }) {
  return (
    <div
      style={{ gridArea: slot }}
      className="flex items-center justify-center border border-dashed border-[#2a2a2a] bg-[#0d0d0d]"
    >
      <div className="text-center">
        <span className="block text-base text-[#333]">+</span>
        <span className="block text-[9px] font-mono text-[#333]">Add widget</span>
      </div>
    </div>
  );
}
```

### Layout selector component

A dropdown in the topbar for switching presets:

```tsx
// packages/widgets/src/layout-selector.tsx

import { LAYOUT_PRESETS } from "./layouts/registry";

export function LayoutSelector() {
  const { activeLayout, setActiveLayout } = useDashboard();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        {/* Mini grid icon + preset name */}
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {Array.from(LAYOUT_PRESETS.values()).map(preset => (
          <DropdownMenuItem
            key={preset.id}
            onClick={() => setActiveLayout(preset.id)}
          >
            <LayoutIcon preset={preset} />
            <span>{preset.name}</span>
            {preset.id === activeLayout.id && <Check />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

### TopBar integration

The `TopBar` component (`packages/widgets/src/chrome/top-bar/index.tsx`) currently has a fixed props interface with no slot for additional content. The `LayoutSelector` is rendered by the parent (`DashboardContent` in `dashboard.tsx`) adjacent to the `TopBar`, not inside it.

Approach: `DashboardContent` renders the `LayoutSelector` inside the `dashboard-topbar` div, next to `TopBar`. This avoids changing the `TopBar` interface:

```tsx
<div className="dashboard-topbar">
  <div className="flex items-center justify-between px-4 py-2">
    <TopBar ... />
    <LayoutSelector />
  </div>
</div>
```

Alternatively, `TopBar` can accept an optional `children` or `actions` prop to render the selector in its right-side button group. The simpler approach (wrapping in the parent) is preferred to avoid changing the `TopBar` interface for a single addition.

### Settings widget grid preview and DnD

`settings-widgets.tsx` has significant hardcoded references to the old 6-slot layout that must change:

**Grid preview (lines 648-669):** The miniature grid preview hardcodes `GRID_SLOTS` and mirrors the old CSS grid shape. This changes to read the active preset's `slots`, `columns`, `rows`, and `areas` to render a dynamic grid preview matching the current layout.

**`handleToggle` (line 535-552):** Currently uses `descriptor.defaultSlot` to decide where to place a re-enabled widget. Changes to: look up the widget's default slot from `DEFAULT_SLOT_ASSIGNMENTS[activeLayout.id]`, or fall back to the first empty slot.

**`handleDragEnd` (line 554-567):** Currently casts to `GridSlot`. Changes to use `string` slot names and read from the active layout's slot list.

**`handleReset` (line 574-592):** Currently hardcodes the old 6-slot default layout. Changes to reset to `DEFAULT_SLOT_ASSIGNMENTS[activeLayout.id]`.

**All `GRID_SLOTS` references:** Replaced with `activeLayout.slots` from the dashboard context.

The DnD library (`@dnd-kit/core`) and the drag-between-slots interaction pattern stay the same. The data driving the grid shape and slot names changes.

### Responsive behavior

Each preset defines responsive overrides via the `responsive` field. The dashboard grid renderer injects a `<style>` element (via React, not dangerouslySetInnerHTML) containing media queries that override the inline grid styles at each breakpoint.

Implementation: `DashboardContent` renders a `<style>` tag within the component that generates CSS like:

```css
@media (max-width: 900px) {
  .dashboard-grid {
    grid-template-columns: 1fr 1fr;
    grid-template-rows: auto auto auto 1fr 1fr 1fr 1fr 1fr auto;
    grid-template-areas:
      "topbar topbar" "tabs tabs" "kpis kpis"
      "s1 s2" "s3 s4" "s5 s6" "s7 s8" "s9 s9"
      "ticker ticker";
  }
}
```

This approach is chosen because:
- Inline styles cannot express media queries, so a `<style>` tag is necessary.
- The `<style>` tag is scoped to `.dashboard-grid`, which is a single instance in the DOM.
- The content is deterministic (derived from preset data), so there are no SSR/hydration mismatches.
- The existing `globals.css` responsive media queries for the old grid are removed.

The KPI strip hiding rule (`@media (max-width: 600px) { .dashboard-kpis { display: none; } }`) stays in `globals.css` since it is layout-agnostic.

For the 3x3 preset:
- **> 900px:** 3 columns, 3 rows (default)
- **600-900px:** 2 columns, 5 rows (last slot spans full width)
- **< 600px:** 1 column, 9 stacked rows. KPI strip hidden (existing behavior).

## Files changed

| File | Change |
|------|--------|
| `packages/widgets/src/layouts/types.ts` | **New.** `LayoutPreset` interface. |
| `packages/widgets/src/layouts/presets/uniform-3x3.ts` | **New.** First preset definition. |
| `packages/widgets/src/layouts/registry.ts` | **New.** `LAYOUT_PRESETS` map + `DEFAULT_LAYOUT_ID`. |
| `packages/widgets/src/layouts/defaults.ts` | **New.** Default widget-to-slot assignments per preset. |
| `packages/widgets/src/empty-slot.tsx` | **New.** Empty slot placeholder component. |
| `packages/widgets/src/layout-selector.tsx` | **New.** Dropdown for layout switching in topbar. |
| `packages/widgets/src/widgets/types.ts` | Change `GridSlot` to `string`. Remove `defaultSlot` from `WidgetDescriptor`. |
| `packages/widgets/src/widgets/registry.ts` | Remove `GRID_SLOTS` array and `DEFAULT_LAYOUT` record. Keep `WIDGET_REGISTRY`. Re-export updated types. |
| `packages/widgets/src/widget-slot/index.tsx` | Accept `string` slot. Replace `className` with `style={{ gridArea: slot }}`. Render `EmptySlot` when no widget. |
| `packages/widgets/src/widget-card/index.tsx` | Add `style?: React.CSSProperties` to `WidgetCardProps`. Spread onto root `<section>`. |
| `packages/types/src/database.ts` | Update `WidgetLayoutConfig` with `activeLayoutId` and `layouts` fields. |
| `packages/hooks/src/use-dashboard.tsx` | Add `activeLayout`, `setActiveLayout`. Change `widgetLayout` and `updateWidgetLayout` to `Record<string, string \| null>`. Remove local `GridSlot` type alias. |
| `apps/app/hooks/use-settings.ts` | Update `DEFAULT_WIDGET_LAYOUT` to use new schema. Handle migration from old `layout` field. |
| `apps/app/app/globals.css` | Remove hardcoded content-slot grid-area classes (`.dashboard-revenue`, etc.), hardcoded `grid-template-*` from `.dashboard-grid`, and old responsive media queries for content slots. Keep chrome classes, base grid styling, and KPI-hide rule. |
| `apps/app/components/dashboard.tsx` | Replace `GRID_SLOTS.map()` with `activeLayout.slots.map()`. Apply grid template as inline styles. Render `<style>` for responsive breakpoints. Render `LayoutSelector` in topbar area. |
| `apps/app/components/settings-widgets.tsx` | Replace all `GRID_SLOTS` references with `activeLayout.slots`. Update `handleToggle` to use `DEFAULT_SLOT_ASSIGNMENTS`. Update `handleReset` to use preset defaults. Update grid preview to render dynamic layout. Update `handleDragEnd` casts from `GridSlot` to `string`. |
| `packages/widgets/src/widgets/detail/index.tsx` | Rename `TITLES` values: "Open Collective" to "Finances", "App Store" to "App Reviews", "Health Monitors" to "Health". Remove `defaultSlot` from descriptor. |
| `packages/widgets/src/widgets/revenue/index.tsx` | Remove `defaultSlot` from descriptor. |
| `packages/widgets/src/widgets/shipping/index.tsx` | Remove `defaultSlot` from descriptor. |
| `packages/widgets/src/widgets/ideas/index.tsx` | Remove `defaultSlot` from descriptor. |
| `packages/widgets/src/widgets/analytics/index.tsx` | Remove `defaultSlot` from descriptor. |
| `packages/widgets/src/widgets/seo/index.tsx` | Remove `defaultSlot` from descriptor. |
| `packages/widgets/src/widgets/sponsorship/index.tsx` | Remove `defaultSlot` from descriptor. |

## Migration

The old `WidgetLayoutConfig.layout` (a flat `Record<string, string | null>`) is replaced by `WidgetLayoutConfig.layouts` (keyed by preset ID). On first load:

1. If `layouts` exists, use it directly.
2. If only `layout` exists (old format), ignore it — the old 6-slot names don't map to the 3x3 slots. Apply the default 3x3 assignments.
3. If neither exists, apply defaults.

This is a clean break. Users who customized their 6-slot layout will get the default 3x3 assignments. Since the old layout shape no longer exists, there's no meaningful way to migrate slot assignments.

## Out of scope

- Drag-to-rearrange widgets directly on the dashboard grid (stays in settings only).
- User-created custom layouts (presets are code-defined).
- Per-project layout selection (layout is global, same for all projects).
- Adding the old asymmetric layout back as a preset (can be done later).
- Widget resize/span within a layout (a preset defines fixed slot sizes).
