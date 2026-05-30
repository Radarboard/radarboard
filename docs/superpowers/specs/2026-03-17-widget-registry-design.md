# Widget Registry and Standard Contract

**Date:** 2026-03-17
**Status:** Approved
**Scope:** Phase 1 -- Registry, contract, widget modules, dashboard refactor. Phase 2 (separate spec): Settings UI for enable/disable/configure.

## Overview

Replace the hardcoded widget composition in `dashboard.tsx` with a descriptor-based registry. Each widget becomes a self-contained module that declares its metadata, integration requirements, and components. The dashboard becomes a thin renderer that maps grid slots to registered widgets.

**Goals:**
- Standard interface for all widgets -- adding a new widget means implementing one module and adding one registry entry
- Widgets own their data -- each widget calls its own hooks internally, dashboard has no knowledge of data sources
- Code-defined defaults with a structure that supports user overrides in Phase 2
- Existing presentational components (ShippingLog, AnalyticsLive, etc.) stay unchanged -- modules wrap them

## Widget Descriptor Type

Defined in `packages/widgets/src/registry/types.ts`:

```typescript
import type { PlatformIntegrations } from "@radarboard/types/project";
import type { ComponentType } from "react";

/** The 6 content grid slots. Chrome widgets (TopBar, Tabs, KPIs, Ticker) are not slotted. */
export type GridSlot = "revenue" | "shipping" | "ideas" | "analytics" | "seo" | "detail";

/** Props every widget module component receives. */
export interface WidgetRenderProps<TConfig = Record<string, unknown>> {
  /** Active project filter. null = "All" projects. */
  projectSlug: string | null;
  /** Per-instance configuration. */
  config: TConfig;
}

/** Describes a widget template in the registry. */
export interface WidgetDescriptor<TConfig = Record<string, unknown>> {
  /** Unique identifier. Used as registry key and WidgetCard widgetId. */
  id: string;
  /** Display name shown in WidgetCard header and settings UI. */
  name: string;
  /** Short description for settings UI (Phase 2). */
  description: string;
  /** Integration keys that must be present on the active project for this widget to be relevant.
   *  Empty array = always available. When "All" projects is selected, all integrations are assumed present. */
  requiredIntegrations: (keyof PlatformIntegrations)[];
  /** Default grid slot assignment. */
  defaultSlot: GridSlot;
  /** Compact view component. Rendered inside WidgetCard in the grid. */
  component: ComponentType<WidgetRenderProps<TConfig>>;
  /** Expanded view component. Rendered inside ExpandedPortal when the widget is expanded. Optional. */
  expandedComponent?: ComponentType<WidgetRenderProps<TConfig>>;
  /** Default config for new instances. */
  defaultConfig: TConfig;
}
```

Widgets access shared dashboard state (`timeRange`, `granularity`, `currency`) via `useDashboard()` inside their components. The `projectSlug` prop determines project-level filtering. The `config` prop carries per-instance settings (e.g., source filters, display preferences).

## Registry

Defined in `packages/widgets/src/registry/index.ts`:

```typescript
export const WIDGET_REGISTRY = new Map<string, WidgetDescriptor>([
  [revenueDescriptor.id, revenueDescriptor],
  [shippingDescriptor.id, shippingDescriptor],
  [ideasDescriptor.id, ideasDescriptor],
  [analyticsDescriptor.id, analyticsDescriptor],
  [seoDescriptor.id, seoDescriptor],
  [detailDescriptor.id, detailDescriptor],
]);

export const GRID_SLOTS: GridSlot[] = ["revenue", "shipping", "ideas", "analytics", "seo", "detail"];

export const DEFAULT_LAYOUT: Record<GridSlot, string | null> = {
  revenue: "revenue",
  shipping: "shipping",
  ideas: "ideas",
  analytics: "analytics",
  seo: "seo",
  detail: "detail",
};
```

**Adding a new widget:** Create a module file in `registry/`, define the descriptor, add one entry to `WIDGET_REGISTRY`. The widget is available in the library but doesn't appear on the dashboard until assigned to a slot (either via code or, in Phase 2, via settings).

**Phase 2 layout overrides:** A user override is a partial `Record<GridSlot, string | null>` persisted in settings. Resolution: `{ ...DEFAULT_LAYOUT, ...userOverrides }`. Setting a slot to `null` hides that slot's content (shows empty placeholder). Setting a slot to a different widget ID swaps what's displayed there.

## Widget Module Components

Each widget gets a module file in `packages/widgets/src/registry/` that encapsulates:
1. Data fetching (hook calls)
2. Mock fallback resolution
3. Integration-based conditional rendering
4. Compact and expanded view composition

### File Structure

Each widget is a self-contained directory under `widgets/`. A contributor opens `src/widgets/`, sees every widget listed, and can copy `_template/` to create a new one.

```
packages/widgets/src/
  widgets/
    _template/
      index.ts           -- commented starter file: copy this to create a new widget
    revenue/
      index.ts           -- revenueDescriptor + RevenueModule + RevenueModuleExpanded
    shipping/
      index.ts           -- shippingDescriptor + ShippingModule + ShippingModuleExpanded
    ideas/
      index.ts           -- ideasDescriptor + IdeasModule + IdeasModuleExpanded
    analytics/
      index.ts           -- analyticsDescriptor + AnalyticsModule + AnalyticsModuleExpanded
    seo/
      index.ts           -- seoDescriptor + SeoModule + SeoModuleExpanded
    detail/
      index.ts           -- detailDescriptor + DetailModule + DetailModuleExpanded
    registry.ts          -- WIDGET_REGISTRY map, DEFAULT_LAYOUT, GRID_SLOTS (imports from each widget)
    types.ts             -- WidgetDescriptor, WidgetRenderProps, GridSlot
    helpers.ts           -- shared utilities (resolveOcSlug, resolveWithFallback, filterByProject, formatTimeAgo, hasIntegration)
    mock-data.ts         -- mock/fallback data (migrated from apps/app/lib/mock-data.ts)
```

**Why one folder per widget:** A widget's descriptor, compact view, and expanded view are co-located. Contributors don't need to hunt across directories. Existing widgets import shared presentational components (e.g., `import { ShippingLog } from "../shipping-log"`) when useful, but new widgets can define everything inline.

**The `_template/` directory:** A copy-and-rename starting point with inline comments explaining each section. Creating a new widget:
1. Copy `_template/` -> `my-widget/`
2. Implement the module component with your data hooks
3. Export the descriptor
4. Add one import + one line in `registry.ts`

**Mock data migration:** The current mock data lives in `apps/app/lib/mock-data.ts` (an app-level file). Since widget modules need mock fallbacks, the mock data moves to `packages/widgets/src/widgets/mock-data.ts`. This avoids a cross-boundary dependency (package importing from app). The `apps/app/lib/mock-data.ts` file is deleted after migration.

Existing exports in `packages/widgets/package.json` remain for backward compatibility. New exports added:
- `"./widgets/registry": "./src/widgets/registry.ts"`
- `"./widget-slot": "./src/widget-slot.tsx"`

### Module Pattern

Each widget directory exports a descriptor object. The compact and expanded components are defined in the same file, alongside the descriptor. Existing presentational components (e.g., `ShippingLog`, `AnalyticsLive`) can be imported when wrapping them, but new widgets can define their UI inline.

**Example -- Revenue module** (`widgets/revenue/index.ts`):

```typescript
import type { WidgetDescriptor, WidgetRenderProps } from "./types";

interface RevenueConfig {
  showOC: boolean;
}

function RevenueModule({ projectSlug, config }: WidgetRenderProps<RevenueConfig>) {
  const { timeRange, currency, projects } = useDashboard();
  const { data, series, loading } = useRevenue(timeRange, currency, projectSlug);
  const ocSlug = resolveOcSlug(projects, projectSlug);
  const { data: ocData } = useOpenCollective(config.showOC ? ocSlug : null);

  const revenue = data ?? MOCK_REVENUE;
  const chartSeries = series.length > 0 ? series : MOCK_REVENUE_SERIES;
  const hasRevenueCat = hasIntegration(projects, projectSlug, "revenuecat");
  const hasOC = config.showOC && hasIntegration(projects, projectSlug, "openCollective");

  return (
    <>
      {hasRevenueCat && (/* KPI cards + chart */)}
      {hasOC && ocData && (/* OC KPIs */)}
    </>
  );
}

function RevenueModuleExpanded({ projectSlug, config }: WidgetRenderProps<RevenueConfig>) {
  // Same data hooks, richer layout
}

export const revenueDescriptor: WidgetDescriptor<RevenueConfig> = {
  id: "revenue",
  name: "Revenue",
  description: "Revenue metrics from RevenueCat and/or Open Collective",
  requiredIntegrations: [], // shows OC or RevenueCat depending on what's configured
  defaultSlot: "revenue",
  component: RevenueModule,
  expandedComponent: RevenueModuleExpanded,
  defaultConfig: { showOC: true },
};
```

### Per-Widget Module Specifications

| Widget | Directory | Hooks Called | Required Integrations | Config Options | Components Composed |
|---|---|---|---|---|---|
| **Revenue** | `revenue/` | `useRevenue`, `useOpenCollective` | `[]` (conditional on revenuecat/openCollective) | `showOC: boolean` | `RevenueKPICard`, `LastPaymentCard`, `RevenueChart`, `OpenCollectiveKPIs` |
| **Shipping** | `shipping/` | `useShipping` | `[]` (works with github, linear, vercel) | none | `ShippingLog` |
| **Ideas** | `ideas/` | `useIdeas` | `[]` (works with linear) | none | `IdeasBugs` |
| **Analytics** | `analytics/` | `useAnalytics`, optionally `useOpenCollective` | `[]` (conditional on openPanel/openCollective) | none | If `hasOpenPanel`: `AnalyticsLive`. Else if `hasOC`: `OpenCollectiveTransactions`. Else: "not configured" placeholder. |
| **SEO** | `seo/` | `useSeo`, optionally `useOpenCollective` | `[]` (conditional on googleSearchConsole/openCollective/openPanel) | none | If `hasOC && !hasOpenPanel`: `OpenCollectiveMembers`. Else: `SeoQueries`. |
| **Detail** | `detail/` | `useOpenCollective`, `useSentry`, `useAppStore`, `useHealth` | `[]` (mode-switching based on available integrations) | none | Mode priority cascade: `hasOC` -> opencollective, `hasSentry` -> sentry, `hasAppStore` -> appstore, else -> health. Renders `OpenCollective*`, `SentryIssues`, `AppStoreReviews`, or `HealthMonitors` accordingly. |

Note: `requiredIntegrations` is empty for all current widgets because they have internal fallback logic (mock data, "not configured" states, mode-switching). The field exists for future widgets that should only appear when a specific integration is configured (e.g., a dedicated "Stripe" widget would require `["stripe"]`).

### Shared Helpers (`widgets/helpers.ts`)

Utilities migrated from `dashboard.tsx`:

```typescript
/** Check if active project (or any project in "All" mode) has a given integration. */
export function hasIntegration(
  projects: Project[],
  activeProjectSlug: string | null,
  integration: keyof PlatformIntegrations
): boolean;

/** Resolve Open Collective slug from active project. */
export function resolveOcSlug(
  projects: Project[],
  activeProjectSlug: string | null
): string | null;

/** Return items if configured and non-empty, otherwise return fallback. */
export function resolveWithFallback<T>(items: T[], configured: boolean, fallback: T[]): T[];

/** Filter items by project name (pass-through when null). */
export function filterByProject<T extends { projectName: string }>(
  items: T[],
  projectName: string | null
): T[];
```

## WidgetSlot Component

New component in `packages/widgets/src/widget-slot/index.tsx`. Bridges the registry and the grid:

```typescript
interface WidgetSlotProps {
  slot: GridSlot;
  widgetId: string | null;
  projectSlug: string | null;
  config?: Record<string, unknown>;
}
```

**Behavior:**
1. If `widgetId` is `null`, render an empty placeholder div with the slot's grid-area class.
2. Look up the widget descriptor from `WIDGET_REGISTRY` by `widgetId`.
3. If not found, render an error placeholder.
4. Render the widget's `component` inside a `WidgetCard`:
   - `title` = descriptor's `name`
   - `className` = `dashboard-${slot}` (grid-area class)
   - `widgetId` = descriptor's `id` (for expand/collapse)
   - `expandedContent` = descriptor's `expandedComponent` rendered with same props (if defined)
   - Widget component receives `{ projectSlug, config: mergedConfig }`
5. Config is merged: `{ ...descriptor.defaultConfig, ...config }`.

## Dashboard Refactoring

`apps/app/components/dashboard.tsx` changes:

**Removed:**
- `RevenueWidget`, `AnalyticsWidget`, `SeoWidget` local function definitions
- All data hook calls (`useRevenue`, `useAnalytics`, `useSeo`, `useShipping`, `useIdeas`, `useOpenCollective`, `useSentry`, `useAppStore`) -- except hooks used by chrome widgets
- `getActiveProjectFlags()`, `getDetailPanelMode()`, `getOcSlug()`
- `resolveWithFallback()`, `filterByProject()`, `formatTimeAgo()`
- `deriveHealthKPI()`, `deriveLastDeployKPI()`
- All `MOCK_*` imports (moved to widget modules)

**Kept:**
- `DashboardContent` (slimmed down)
- Chrome widgets: `TopBar`, `ProjectTabs`, `KPIStrip`, `BottomTicker`
- `SettingsModal`

**Added:**
- Import of `WidgetSlot`, `GRID_SLOTS`, `DEFAULT_LAYOUT` from widgets registry
- Layout resolution logic (trivial in Phase 1 -- just use `DEFAULT_LAYOUT`)

**New DashboardContent structure:**

```tsx
function DashboardContent() {
  const { activeProjectSlug, orderedProjects, timeRange, granularity, currency,
    setTimeRange, setGranularity, setCurrency, setActiveProject } = useDashboard();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const layout = DEFAULT_LAYOUT; // Phase 2: resolveLayout(DEFAULT_LAYOUT, userOverrides)

  return (
    <>
      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
      <div className="dashboard-grid">
        <div className="dashboard-topbar">
          <TopBar ... />
        </div>
        <div className="dashboard-tabs">
          <ProjectTabs ... />
        </div>
        <div className="dashboard-kpis">
          <KPIStrip projectSlug={activeProjectSlug} />
        </div>

        {GRID_SLOTS.map(slot => (
          <WidgetSlot
            key={slot}
            slot={slot}
            widgetId={layout[slot]}
            projectSlug={activeProjectSlug}
          />
        ))}

        <div className="dashboard-ticker">
          <BottomTicker projectSlug={activeProjectSlug} />
        </div>
      </div>
    </>
  );
}
```

## Chrome Widget Refactoring

`KPIStrip` and `BottomTicker` currently receive pre-computed data as props from `DashboardContent`. Since the dashboard will no longer call data hooks, these widgets need to call their own hooks internally.

Both chrome widgets call `useDashboard()` internally to access `timeRange`, `currency`, `projects`, and `activeProjectSlug`. This is the same pattern used by registry widget modules.

### KPIStrip

Currently receives: `health`, `errors`, `appRating`, `lastDeploy`, `liveVisitors` as computed props.

After refactor: Takes `projectSlug` prop, calls its own hooks internally:
- `useDashboard()` -> access `timeRange` for analytics hook, `projects` for integration checks
- `useHealth()` -> derives health KPI (total/up/down/degraded counts). Uses `configured` flag to gate mock fallback.
- `useSentry(projectSlug)` -> derives error KPI (unresolved count)
- `useAppStore(projectSlug)` -> derives app rating KPI
- `useShipping(projectSlug)` -> derives last deploy KPI. Uses `configured` flag and `resolveWithFallback()` for mock data. Applies `formatTimeAgo()` from `registry/helpers.ts`.
- `useAnalytics(timeRange, projectSlug)` -> reads live visitors

Mock fallback logic: KPIStrip replicates the same `resolveWithFallback()` / `configured` flag pattern currently in `DashboardContent`. Each hook returns `{ data, configured }` -- KPIStrip uses these to decide between real and mock data for each KPI.

Note: Each hook call here may duplicate API requests made by content widgets calling the same hooks. This is acceptable for the current scale (infrequent polling, small payloads). If it becomes a concern, hook-level caching (e.g., SWR, React Query) can be added without changing the widget contract.

### BottomTicker

Currently receives: `alerts: HealthCheck[]`, `activities: ShippingItem[]`.

After refactor: Takes `projectSlug` prop, calls:
- `useDashboard()` -> access `projects` to resolve active project name for filtering
- `useHealth()` -> health alerts. Uses `resolveWithFallback()` with `configured` flag.
- `useShipping(projectSlug)` -> shipping activity items. Uses `resolveWithFallback()` with `configured` flag, then applies `filterByProject()` using the active project's *name* (resolved from `projects` via `projectSlug`). This matches the current dashboard-level filtering behavior.

## Existing Code Preserved

All presentational components in `packages/widgets/src/` remain unchanged:
- `shipping-log.tsx`, `ideas-bugs.tsx`, `analytics-live.tsx`, `seo-queries.tsx`
- `revenue-kpi.tsx`, `revenue-chart.tsx`
- `open-collective.tsx`, `sentry-issues.tsx`, `app-store-reviews.tsx`, `health-monitors.tsx`
- `widget-card.tsx`, `expanded-portal.tsx`
- All `details/` modal components
- `top-bar.tsx`, `project-tabs.tsx`

**Expanded component migration:** The existing `expanded/*.tsx` components (`RevenueExpanded`, `ShippingExpanded`, etc.) receive pre-fetched data as props -- they cannot be used directly as module expanded components because module components receive `WidgetRenderProps<TConfig>` (just `projectSlug` + `config`).

Each module's `expandedComponent` is a new wrapper that:
1. Calls the same data hooks as the compact component
2. Passes the fetched data to the existing presentational expanded component

Example:
```tsx
function RevenueModuleExpanded({ projectSlug, config }: WidgetRenderProps<RevenueConfig>) {
  // Same hooks as RevenueModule
  const { data, series } = useRevenue(...);
  const { data: ocData } = useOpenCollective(...);
  // Delegates to existing presentational component
  return <RevenueExpanded revenue={data} chartSeries={series} ocData={ocData} ... />;
}
```

The existing `expanded/*.tsx` presentational components are preserved as-is -- they become the rendering layer that module expanded wrappers delegate to. The `expanded/` package.json exports can be removed once migration is complete (no external consumers).

## Migration Strategy

1. Create `widgets/types.ts`, `widgets/helpers.ts`, `widgets/mock-data.ts` (new files, no existing code changes)
2. Create the `_template/` directory with a commented starter file
3. Create all 6 widget directories (`widgets/revenue/` through `widgets/detail/`), migrating logic from `dashboard.tsx` into each
4. Create `widgets/registry.ts` with the registry and default layout
5. Create `widget-slot.tsx`
6. Refactor `KPIStrip` to call its own hooks (prop interface change)
7. Refactor `BottomTicker` to call its own hooks (prop interface change)
8. Refactor `DashboardContent` to use the slot-based renderer
9. Delete dead code from `dashboard.tsx` (meta-widgets, helpers, hook calls)
10. Delete `apps/app/lib/mock-data.ts` (replaced by `widgets/mock-data.ts`)
11. Build + typecheck + verify

Steps 1-5 are additive (no existing code changes). Steps 6-10 are the migration (existing code changes). This allows incremental progress with a working codebase at each step.

## Testing Considerations

- Unit: Each widget module renders correctly with mock data
- Unit: WidgetSlot renders the correct widget for a given widgetId
- Unit: WidgetSlot renders placeholder for null widgetId
- Unit: WidgetSlot renders placeholder for unknown widgetId
- Integration: DEFAULT_LAYOUT produces the same visual result as the current hardcoded dashboard
- Integration: Expand/collapse still works through the registry layer
- Integration: KPIStrip and BottomTicker self-fetch their data correctly

## What This Enables (Phase 2)

With the registry in place, Phase 2 becomes straightforward:

- **Enable/disable widgets:** Toggle a slot to `null` in user settings
- **Swap widgets between slots:** Change the `widgetId` mapped to a slot
- **Configure widget instances:** Store per-slot config in settings, pass through WidgetSlot
- **Settings UI:** Iterate `WIDGET_REGISTRY` to list available widgets, show config forms using `defaultConfig` shape
- **New widget onboarding:** Implement one module, register it, assign to a slot
