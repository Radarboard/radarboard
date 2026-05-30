# Widget Fullscreen Expansion

**Date:** 2026-03-17
**Status:** Approved

## Overview

Any widget can expand into a full-viewport overlay showing a richer, more detailed view of its data. Expanded views can compose existing sub-components (KPI cards, charts, tables) into a dashboard-within-a-dashboard layout. The system is designed to be extensible: adding expansion support to a new widget requires only passing two props to WidgetCard.

## Architecture

### Approach: WidgetCard as Expansion Boundary

Each WidgetCard optionally declares its own expanded content. The dashboard context tracks which widget is expanded (by string ID). The matching WidgetCard renders its expanded content into a portal. No central registry or overlay component needed.

**Key principle:** The expansion system has zero knowledge of specific widgets. WidgetCard is the only integration point.

### Context Additions (`use-dashboard.tsx`)

```typescript
expandedWidgetId: string | null;       // any string ID, not a fixed union
expandWidget: (id: string) => void;    // sets expandedWidgetId
collapseWidget: () => void;            // sets expandedWidgetId to null
```

This is internal state managed via `useState` inside `DashboardProvider`. No changes to `DashboardProviderProps` -- the expansion state is not lifted to the provider's parent.

Only one widget can be expanded at a time. Calling `expandWidget` while another is expanded replaces it.

### WidgetCard Changes (`widget-card.tsx`)

Two new optional props:

```typescript
interface WidgetCardProps {
  // ...existing props (title, children, className, contentClassName, action)
  widgetId?: string;              // enables expansion when provided
  expandedContent?: ReactNode;    // content rendered in expanded overlay
}
```

When `widgetId` is provided:
- A `Maximize2` icon button appears in the header bar (right side, before any existing `action` content)
- Double-clicking the card body triggers expansion (uses a click-count check to avoid interfering with text selection -- only fires if the double-click target is not an interactive element or text selection)
- A `ref` on the card root captures position for the scale-up animation
- When `expandedWidgetId === widgetId`, renders `expandedContent` inside an `ExpandedPortal`

When no `widgetId` is provided, WidgetCard behaves exactly as it does today (backward compatible).

### ExpandedPortal Component (`packages/widgets/src/expanded-portal/index.tsx`)

A shared component that handles all overlay mechanics. Not widget-specific.

**Rendering:**
- Uses `createPortal` to render to `document.body` (escapes grid `overflow: hidden`)
- Full-viewport fixed overlay with 16px inset (slight padding from screen edges)
- Dark backdrop: `bg-black/80 backdrop-blur-sm`
- Header bar: widget title (inherited from WidgetCard) + close button (X icon)
- Content area: `flex-1 overflow-auto` for the expanded content
- Z-index: `z-overlay` (above the existing Dialog's `z-ticker`, so dialogs opened from within expanded widgets stack correctly)
- Body scroll lock: apply `overflow: hidden` to `document.body` while expanded, restore on close

**Interaction:**
- Close triggers: X button, Esc key, backdrop click
- Calls `collapseWidget()` from context on close

**Animation:**
1. On expand: measure source widget bounding rect via ref, set CSS custom properties (`--from-x`, `--from-y`, `--from-w`, `--from-h`)
2. First frame: overlay positioned/sized to match source rect using CSS `transform: translate() scale()`
3. Next frame: transition to full viewport position (`transform: none`), 250ms ease-out
4. On collapse: reverse animation back to source rect, then unmount after transition ends
5. When `prefers-reduced-motion` is active, skip the transform animation and use a simple opacity fade (150ms) instead
6. Fallback: if `getBoundingClientRect` returns a zero-sized rect (widget off-screen or hidden), skip the position animation and fade in from center

## Adding Expansion to a Widget

Single step -- pass `widgetId` and `expandedContent` to WidgetCard:

```tsx
<WidgetCard
  title="My Widget"
  widgetId="my-widget"
  expandedContent={<MyWidgetExpanded data={data} />}
>
  <MyWidgetCompact data={data} />
</WidgetCard>
```

No changes to context, overlay, routing, or any other file. The pattern is self-contained.

## Expanded Widget Content

Each expanded view lives in `packages/widgets/src/expanded/`. They compose existing sub-components into richer layouts. Expanded views can use WidgetCards as sub-widgets (without `widgetId`, so they are not themselves expandable).

### File Structure

```
packages/widgets/src/expanded/
  revenue-expanded.tsx
  shipping-expanded.tsx
  ideas-expanded.tsx
  analytics-expanded.tsx
  seo-expanded.tsx
  detail-expanded.tsx
```

Each expanded component gets its own export entry in `packages/widgets/package.json` exports map, following the existing per-file export convention (e.g., `"./expanded/revenue-expanded": "./src/expanded/revenue-expanded.tsx"`).

### Revenue Expanded

Layout: CSS grid, 4 columns.

- **Row 1 (full width):** `RevenueChart` at 400px height (vs. 180px compact)
- **Row 2 (4 cells):** `RevenueKPICard` for Gross Revenue, MRR, Net Revenue, `LastPaymentCard`
- **Row 3 (full width, conditional):** `OpenCollectiveKPIs` if OC is connected
- **Row 4 (full width, conditional):** Revenue breakdown table by project (only in "All" view)

Props: `revenue`, `chartSeries`, `currency`, `ocData`, `hasOC`, `hasRevenueCat`, same as compact `RevenueWidget`.

### Shipping Log Expanded

Layout: full-height scrollable list with header controls.

- **Header:** filter tabs by source (All / Vercel / GitHub / Linear / Manual), project filter
- **List:** existing `ShippingLog` component with all items (no truncation), showing additional detail per row (description, SHA when available)
- **Detail dialog:** existing click-to-open dialog still works

Props: `items` (full unfiltered list), `projects` (for filter).

### Ideas + Bugs Expanded

Layout: full-height table with header controls.

- **Header:** filter by type (All / Ideas / Bugs), project filter
- **Table:** sortable columns -- Type icon, Title, Project badge, Priority, Status, Age
- **Detail dialog:** existing click-to-open dialog still works

Props: `items`, `projects`.

### Analytics Expanded

The compact `AnalyticsWidget` conditionally renders different content depending on project integrations (OpenPanel analytics, OC transactions, or a "not configured" fallback). The expanded view follows the same conditional logic:

- **When OpenPanel is configured:** CSS grid -- 4 large metric cells (Visitors, Sessions, Page Views, Bounce Rate) with per-platform tooltips, live visitor count with pulsing dot, full top pages table (all pages, not top 5) sortable by sessions/bounce rate/duration. Existing page detail dialog still works.
- **When showing OC transactions (fallback):** Full-height transaction list with all transactions. Existing transaction detail dialog still works.
- **When not configured:** No expand button shown -- `expandedContent` is omitted so WidgetCard does not render the expand affordance.

Props: `hasOpenPanel`, `hasOC`, `ocData`, `analytics`, same as compact `AnalyticsWidget`.

### SEO Performance Expanded

The compact `SeoWidget` conditionally renders OC members or SEO queries. The expanded view follows the same conditional logic:

- **When showing SEO data:** Summary row (Clicks, Impressions, CTR, Position) + full query table with all columns, sortable, project color dots in "All" view. Existing query detail dialog still works.
- **When showing OC members (fallback):** Full-height member list. Existing member detail dialog still works.
- **When not configured:** No expand button shown -- `expandedContent` is omitted.

Props: `hasOC`, `hasOpenPanel`, `ocData`, `seoData`, same as compact `SeoWidget`.

### Detail Panel Expanded

Layout depends on active mode. Same mode-switching as compact, but with more space.

- **OpenCollective:** KPIs row at top (full width), then two-column layout: full transaction list | full member list. Existing detail dialogs still work.
- **Sentry:** Left panel: unresolved count + sparkline (wider). Right panel: full issue list. External links to Sentry.
- **App Store:** Left panel: rating + app info (wider). Right panel: all reviews, no line-clamp truncation.
- **Health:** Incident panel (if any) at top, full monitor grid below with response times and last-checked timestamps.

Props: same as compact `DetailPanel` (`mode`, `ocData`, `sentryData`, `appStoreData`, `healthChecks`, `healthIncidents`).

## Integration in dashboard.tsx

**Inline WidgetCards** (Shipping, Ideas) get `widgetId` and `expandedContent` directly:

```tsx
<WidgetCard
  title="Shipping Log"
  className="dashboard-shipping"
  widgetId="shipping"
  expandedContent={<ShippingExpanded items={shipping} projects={projects} />}
>
  <ShippingLog items={filteredShipping} />
</WidgetCard>
```

**Wrapper components** (`RevenueWidget`, `AnalyticsWidget`, `SeoWidget` in `dashboard.tsx`) already render a WidgetCard internally. These components add `widgetId` and `expandedContent` to their internal WidgetCard call. Example change inside `RevenueWidget`:

```tsx
// Before:
<WidgetCard title={title} className="dashboard-revenue">

// After:
<WidgetCard
  title={title}
  className="dashboard-revenue"
  widgetId="revenue"
  expandedContent={
    <RevenueExpanded
      revenue={revenue}
      chartSeries={chartSeries}
      currency={currency}
      ocData={ocData}
      hasOC={hasOC}
      hasRevenueCat={hasRevenueCat}
    />
  }
>
```

No changes needed to the call sites in `DashboardContent` -- the wrapper components handle it internally.

## Non-Expandable Widgets

These dashboard elements do not get expansion support:
- **TopBar** -- navigation/controls, not content
- **ProjectTabs** -- navigation
- **KPIStrip** -- summary indicators, data visible in other widgets
- **BottomTicker** -- ambient information display

## Accessibility

- Expanded overlay traps focus (consistent with existing Dialog pattern)
- Esc key closes the overlay
- Close button is keyboard-focusable
- `aria-modal="true"` and `role="dialog"` on the overlay
- Source widget gets `aria-expanded` attribute when its expanded view is open
- `prefers-reduced-motion`: skip transform animation, use opacity fade instead (see Animation section)

## Testing Considerations

- Unit: WidgetCard renders expand button only when `widgetId` is provided
- Unit: WidgetCard does not render expand button when `widgetId` is omitted (backward compat)
- Unit: ExpandedPortal renders content and handles close triggers
- Integration: expanding a widget sets context state, portal appears
- Integration: only one widget expanded at a time
- Visual: animation plays from correct source position
