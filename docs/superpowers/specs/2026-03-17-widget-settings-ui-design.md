# Widget Settings UI (Phase 2)

**Date:** 2026-03-17
**Status:** Approved
**Depends on:** Widget Registry spec (2026-03-17)

## Overview

Add a "Widgets" section to the settings modal that lets users enable/disable widgets, drag them to different grid slots, and configure per-widget options. Changes apply live (auto-persist) with a "Reset to Defaults" escape hatch.

## UI Layout

**Hybrid: widget list + grid preview** inside the existing SettingsModal.

The settings modal gets a new sidebar entry: "Widgets" (added to `SettingsSection` type). When selected, the content area splits into two panels:

- **Left panel (widget list):** All registered widgets from `WIDGET_REGISTRY`, each shown as a row with drag handle, status dot (green=enabled, red=disabled), widget name, assigned slot badge, and expand chevron. Clicking a row expands inline config (accordion). Draggable via `@dnd-kit`.
- **Right panel (grid preview):** Miniature version of the 6-slot CSS grid. Each slot shows the assigned widget name and status. Empty slots have a dashed border and "empty" label. Slots are drop targets for `@dnd-kit`.

The modal width increases from `max-w-[700px]` to `max-w-[800px]` to accommodate the two-panel layout.

## Interactions

### Enable/Disable
Click the status dot on a widget row to toggle it. When disabled:
- The widget's slot in `widgetLayout` is set to `null`
- The widget row dims (reduced opacity, strikethrough name)
- The grid preview shows the slot as empty (dashed border)
- Re-enabling restores the widget to its previous slot (tracked via `defaultSlot`)

### Move (drag-and-drop)
Drag a widget row from the list onto a slot in the grid preview:
- Uses `@dnd-kit` with `DndContext` wrapping the widgets section
- Widget rows are `<Draggable>` sources
- Grid preview slots are `<Droppable>` targets
- When dropped: the widget's slot assignment updates, the grid preview refreshes
- If the target slot already has a widget: the two widgets swap slots
- Disabled widgets cannot be dragged (drag handle hidden)

### Configure (inline expand)
Click a widget row (not the drag handle or status dot) to expand/collapse its config section:
- Shows the widget's `description` text
- Renders config controls based on the widget's `defaultConfig` shape
- For Phase 2, only Revenue has config (`showOC: boolean` toggle)
- Future widgets define their own config in their descriptor; the UI renders a Switch for each boolean field
- Config changes auto-persist immediately

### Reset to Defaults
Button at the bottom of the widget list. Resets `widgetLayout` to `DEFAULT_LAYOUT` and all per-widget configs to their `defaultConfig`. Confirm before executing (simple "Are you sure?" inline prompt, not a dialog).

## Data Model

### Widget Layout State

```typescript
// What gets persisted
interface WidgetLayoutConfig {
  layout: Record<GridSlot, string | null>;  // slot -> widgetId or null
  configs: Record<string, Record<string, unknown>>;  // widgetId -> config overrides
}
```

Default value (no user overrides):
```typescript
{
  layout: { revenue: "revenue", shipping: "shipping", ideas: "ideas", analytics: "analytics", seo: "seo", detail: "detail" },
  configs: {}  // empty = all widgets use their defaultConfig
}
```

### Persistence Layer Changes

**`SettingsRepository` interface** (`packages/types/src/database.ts`):
```typescript
export interface SettingsRepository {
  getProjectOrder(): Promise<string[]>;
  setProjectOrder(order: string[]): Promise<void>;
  getWidgetLayout(): Promise<WidgetLayoutConfig | null>;
  setWidgetLayout(layout: WidgetLayoutConfig): Promise<void>;
}
```

Two new methods. Returns `null` when no user overrides exist (use `DEFAULT_LAYOUT`).

**API route** (`apps/app/app/api/settings/route.ts`):
- `GET /api/settings` response adds: `{ projectOrder, widgetLayout: WidgetLayoutConfig | null }`
- `POST /api/settings` body accepts: `{ projectOrder?, widgetLayout? }` (partial updates)

**Settings hook** (`apps/app/hooks/use-settings.ts`):
- Add `widgetLayout: WidgetLayoutConfig` state (resolved: user overrides merged with defaults)
- Add `updateWidgetLayout(layout: WidgetLayoutConfig): void` with same debounced auto-persist pattern as `updateProjectOrder`
- On mount: fetch GET, merge `widgetLayout` response with `DEFAULT_LAYOUT` defaults

### Dashboard Context Changes

**`DashboardProvider`** receives `widgetLayout` and `onWidgetLayoutChange` as props (same pattern as `projectOrder`).

**`DashboardContextValue`** adds:
```typescript
widgetLayout: Record<GridSlot, string | null>;
widgetConfigs: Record<string, Record<string, unknown>>;
updateWidgetLayout: (layout: Record<GridSlot, string | null>) => void;
updateWidgetConfig: (widgetId: string, config: Record<string, unknown>) => void;
```

**`WidgetSlot`** reads `widgetLayout` and `widgetConfigs` from context instead of receiving `widgetId` as a prop. It resolves: `widgetId = widgetLayout[slot]`, `config = { ...descriptor.defaultConfig, ...widgetConfigs[widgetId] }`.

**`DashboardContent`** no longer passes `widgetId` and `config` to each `WidgetSlot` -- the slots read from context directly.

## New Components

### `SettingsWidgets` (`apps/app/components/settings-widgets.tsx`)
The main widget settings panel. Renders the two-panel layout inside a `DndContext`.

**Props:** none (reads from `useDashboard()` context).

**Internal state:**
- `expandedWidgetId: string | null` -- which widget row is expanded for config

**Renders:**
- `WidgetListPanel` (left)
- `GridPreviewPanel` (right)
- Reset to Defaults button

### `WidgetListPanel` (internal to settings-widgets.tsx)
Renders all widgets from `WIDGET_REGISTRY` as draggable rows.

Each row shows:
- Drag handle (`⠿` icon, `@dnd-kit` `useDraggable`)
- Status dot (green/red, clickable to toggle)
- Widget name
- Slot badge (current slot assignment or "disabled")
- Expand chevron

When expanded, shows:
- Widget description
- Config controls (Switch for booleans)

### `GridPreviewPanel` (internal to settings-widgets.tsx)
Renders the 6-slot grid miniature. Each slot is a `@dnd-kit` `useDroppable` target.

Shows:
- Slot name (uppercase label)
- Assigned widget name (or "empty")
- Status indicator (green dot for filled, dashed border for empty)

### `Switch` component (`packages/ui/src/switch.tsx`)
New UI primitive needed for toggle controls. Based on `@radix-ui/react-switch`. Simple on/off toggle styled to match the dark theme.

## New Package Dependencies

- `@radix-ui/react-switch` in `packages/ui` (for `Switch` component)

No new dependencies in other packages. `@dnd-kit` is already installed in the web app.

## File Changes Summary

| File | Change |
|------|--------|
| `packages/types/src/database.ts` | Add `WidgetLayoutConfig` type, extend `SettingsRepository` with 2 methods |
| `packages/ui/src/switch.tsx` | New `Switch` component |
| `packages/ui/package.json` | Add `@radix-ui/react-switch` dependency, add export |
| `packages/hooks/src/use-dashboard.tsx` | Add `widgetLayout`, `widgetConfigs`, `updateWidgetLayout`, `updateWidgetConfig` to context |
| `apps/app/hooks/use-settings.ts` | Add `widgetLayout` state + `updateWidgetLayout` with debounced persist |
| `apps/app/app/api/settings/route.ts` | Extend GET/POST to handle `widgetLayout` |
| `apps/app/app/providers.tsx` | Pass `widgetLayout` and `onWidgetLayoutChange` to `DashboardProvider` |
| `apps/app/components/settings-sidebar.tsx` | Add `"widgets"` to `SettingsSection` type and `SECTIONS` array |
| `apps/app/components/settings-modal.tsx` | Import and render `SettingsWidgets` for the widgets section, increase modal width |
| `apps/app/components/settings-widgets.tsx` | New file: the full widget settings panel with DnD |
| `apps/app/components/dashboard.tsx` | Remove `widgetId` prop from `WidgetSlot` calls (reads from context) |
| `packages/widgets/src/widget-slot/index.tsx` | Read `widgetLayout` and `widgetConfigs` from `useDashboard()` instead of props |

All existing `SettingsRepository` implementations (SQLite, Supabase, Turso, PlanetScale) need the two new methods. They can serialize `WidgetLayoutConfig` as JSON in a single settings key-value row (same pattern as `projectOrder`).

## Migration Strategy

1. Add `WidgetLayoutConfig` type to `packages/types/src/database.ts`
2. Add `Switch` component to `packages/ui`
3. Extend `SettingsRepository` interface + all implementations
4. Extend API route (GET/POST)
5. Extend `useSettings` hook
6. Extend `DashboardProvider` context
7. Update `WidgetSlot` to read from context
8. Update `DashboardContent` to not pass `widgetId` props
9. Update `providers.tsx` to pass widget layout to provider
10. Add `"widgets"` to settings sidebar
11. Create `SettingsWidgets` component with DnD
12. Update `SettingsModal` to render widgets section
13. Build + typecheck + verify

Steps 1-6 are data layer (additive). Steps 7-12 are UI (existing code changes).

## Testing Considerations

- Unit: `SettingsWidgets` renders all registered widgets
- Unit: toggling a widget updates layout to null/restore
- Unit: expanding a widget shows config controls
- Unit: `Switch` component toggles on/off
- Integration: drag-and-drop between list and grid preview swaps slots
- Integration: layout changes persist via API and survive page reload
- Integration: dashboard grid reflects layout changes live
