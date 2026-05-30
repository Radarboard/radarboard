# Dashboard Wiring + KPI Strip + Contextual Bottom Row

**Date:** 2026-03-16
**Status:** Approved

## Overview

Wire the 8 newly added integrations (Linear, GitHub, Resend, Google Search Console, Vercel, Sentry, App Store Connect, BetterStack) into the dashboard UI. The challenge is fitting 11 data sources into a fixed-viewport TV display without creating noise.

The approach: add a compact **KPI summary strip** for at-a-glance status of all services, make the **bottom row contextual** (adapting to the selected project's integrations), and **wire existing widgets to real data** by replacing mock data with the new hooks.

## Design Decisions

- **Wall display + interactive**: The dashboard serves both as a passive TV display (glanceable, no interaction) and an interactive browser tool. The KPI strip satisfies wall-display needs; the contextual bottom row and project filtering satisfy interactive needs.
- **No new widget slots in the main grid**: The 6-widget grid (revenue, shipping, ideas, analytics, seo + the contextual row) is the right density for a TV display. Adding more columns or rows would make each widget too small.
- **Graceful degradation**: Every widget falls back to mock data when its integration is not configured. No blank panels.
- **Resend is not a widget**: It is an outbound email service for alerts. It will be triggered server-side by health check failures, not displayed on the dashboard.

## Grid Layout Change

### Before

```
topbar          topbar          topbar
tabs            tabs            tabs
revenue         shipping        ideas
revenue         analytics       seo
opencollective  opencollective  opencollective
ticker          ticker          ticker
```

### After

```
topbar          topbar          topbar
tabs            tabs            tabs
kpis            kpis            kpis            <-- NEW
revenue         shipping        ideas
revenue         analytics       seo
detail          detail          detail          <-- renamed
ticker          ticker          ticker
```

Changes:
1. New `kpis` row between tabs and the main grid.
2. `opencollective` area renamed to `detail` — it now shows contextual content.
3. Grid template rows updated to accommodate the KPI strip (fixed height `auto`).

### CSS Update (`globals.css`)

```css
.dashboard-grid {
  grid-template-rows: auto auto auto 1fr 1fr auto auto;
  grid-template-columns: 1fr 1.5fr 1fr;
  grid-template-areas:
    "topbar  topbar    topbar"
    "tabs    tabs      tabs"
    "kpis    kpis      kpis"
    "revenue shipping  ideas"
    "revenue analytics seo"
    "detail  detail    detail"
    "ticker  ticker    ticker";
}
```

New CSS classes: `.dashboard-kpis` and `.dashboard-detail`.
Remove old `.dashboard-opencollective` class.

Responsive breakpoints must also be updated:
- **900px**: 2-column layout — KPI strip spans full width, detail panel spans full width.
- **600px**: Single-column layout — KPI strip hidden (data is visible in detail panel and ticker), detail panel rendered as a standard stacked widget.

## Component 1: KPI Summary Strip

### Purpose

A compact horizontal bar showing the status of all integrated services at a glance. Designed to be scannable in 2 seconds on a wall display.

### Location

New widget component: `packages/widgets/src/kpi-strip.tsx`

### Layout

A horizontal row of 5 compact metric cards, evenly spaced. Each card is ~120px wide with monospace text.

### Cards

| Card | Data Source | Hook | Normal Display | Alert Display |
|---|---|---|---|---|
| **Health** | BetterStack | `useHealth()` | Green dot + "5/5 up" | Red dot + "1 down" |
| **Errors** | Sentry | `useSentry()` | "0 unresolved" (dim) | "12 unresolved" (red) |
| **App Rating** | App Store Connect | `useAppStore()` | "4.8 (23 reviews)" | "3.2" (amber) |
| **Last Deploy** | Vercel (from shipping) | `useShipping()` | "2m ago goshuin.com" | — |
| **Live Visitors** | OpenPanel | `useAnalytics()` | "47 live" | — |

### Visual Design

- Background: `var(--widget-bg)` (`#111111`), same as other widgets.
- Each card: inline-flex, `font-mono text-[11px]`.
- Status dots: 6px circles. Green (`#4ade80`) for healthy, red (`#e05555`) for alert, amber (`#f5c542`) for warning.
- Cards that have no data (integration not configured) are hidden, not shown as empty.
- The strip collapses gracefully — if only 2 cards have data, they still look fine.

### Props

```typescript
interface KPIStripProps {
  health: { total: number; up: number; down: number; degraded: number } | null;
  errors: { unresolvedCount: number } | null;
  appRating: { average: number; totalReviews: number } | null;
  lastDeploy: { timeAgo: string; projectName: string; projectColor: string } | null;
  liveVisitors: number | null;
}
```

## Component 2: Contextual Detail Panel

### Purpose

The full-width bottom row adapts to show relevant detail content based on the selected project's integrations.

### Location

New widget component: `packages/widgets/src/detail-panel.tsx`

### Content Selection Logic

Priority-based selection (first match wins):

```
1. Project has openCollective → OpenCollective details (KPIs + transactions + members)
2. Project has sentry          → Sentry unresolved issues list
3. Project has appStoreConnect → App Store reviews + rating breakdown
4. "All Projects" selected     → Health monitors overview (BetterStack)
5. Fallback                    → Health monitors overview (BetterStack)
```

Rationale for priority order:
- Open Collective is financial data, similar weight to revenue — gets top priority.
- Sentry errors are actionable — second priority.
- App Store reviews are informational — third priority.
- Health monitors are the universal fallback since BetterStack covers all projects.

### Sub-views

Each sub-view reuses existing widget components or creates minimal new ones:

**Open Collective view**: Already implemented. Reuses `OpenCollectiveKPIs`, `OpenCollectiveTransactions`, `OpenCollectiveMembers` in a horizontal split layout.

**Sentry view**: New component `SentryIssueList` in `packages/widgets/src/sentry-issues.tsx`.
- Horizontal layout: left side shows unresolved count + 24h error trend sparkline, right side shows issue list (title, level badge, count, last seen).
- Level badges: `fatal` = red, `error` = red dim, `warning` = amber, `info` = blue.
- Each issue row links to Sentry permalink.

**App Store view**: New component `AppStoreReviews` in `packages/widgets/src/app-store-reviews.tsx`.
- Horizontal layout: left side shows average rating (large number) + total reviews + latest version badge, right side shows scrollable recent reviews (rating stars, title, body excerpt, date).

**Health monitors view**: New component `HealthMonitors` in `packages/widgets/src/health-monitors.tsx`.
- Horizontal grid of monitor cards. Each card: name, status dot, response time, last checked.
- Active incidents shown as a highlighted row at the top.

### Props

```typescript
interface DetailPanelProps {
  mode: "opencollective" | "sentry" | "appstore" | "health";
  // Data for each mode (only the relevant one is non-null)
  ocData: OpenCollectiveOverviewData | null;
  sentryData: SentryOverview | null;
  appStoreData: AppStoreOverview | null;
  healthData: { checks: HealthCheck[]; incidents: HealthIncident[] } | null;
}
```

## Component 3: Wiring Existing Widgets

### Shipping Log

**Current**: Uses `MOCK_SHIPPING` filtered by project name.
**After**: Uses `useShipping(activeProjectSlug)`. Falls back to `MOCK_SHIPPING` when `configured === false`.

Changes to `dashboard.tsx`:
```typescript
const { items: shippingItems, configured: shippingConfigured } = useShipping(activeProjectSlug);
const shipping = shippingConfigured ? shippingItems : MOCK_SHIPPING;
```

### Ideas + Bugs

**Current**: Uses `MOCK_IDEAS_BUGS` filtered by project name.
**After**: Uses `useIdeas(activeProjectSlug)`. Falls back to `MOCK_IDEAS_BUGS`.

Changes to `dashboard.tsx`:
```typescript
const { items: ideaItems, configured: ideasConfigured } = useIdeas(activeProjectSlug);
const ideas = ideasConfigured ? ideaItems : MOCK_IDEAS_BUGS;
```

### SEO Performance

**Current**: Uses `MOCK_SEO` always.
**After**: Uses `useSeo(activeProjectSlug)`. Falls back to `MOCK_SEO`.

The `SeoWidget` function in `dashboard.tsx` already handles conditional rendering (OC members vs SEO). Add the hook and pass real data when available.

### Bottom Ticker

**Current**: Uses `MOCK_HEALTH_CHECKS` for alerts and `MOCK_SHIPPING` for activities.
**After**: Uses `useHealth()` checks for alerts and real shipping items for activities.

The ticker shows scrolling text. Health alerts from BetterStack flow into the alert items; shipping items from the shipping hook flow into the activity items.

## Data Flow Summary

```
                     ┌─────────────┐
                     │  Dashboard   │
                     │  Component   │
                     └──────┬──────┘
                            │
         ┌──────────────────┼──────────────────────┐
         │                  │                       │
    ┌────┴────┐       ┌─────┴─────┐          ┌─────┴──────┐
    │ KPI Strip│       │ Main Grid │          │Detail Panel│
    └────┬────┘       └─────┬─────┘          └─────┬──────┘
         │                  │                       │
  ┌──────┼──────┐     ┌─────┼──────┐         ┌─────┼──────┐
  │      │      │     │     │      │         │     │      │
health errors rating  ship  ideas  seo      OC  sentry  ASC
  │      │      │     │     │      │         │     │      │
  BS   Sentry  ASC   GH+   Linear GSC      OC   Sentry  ASC
              Lin+V                API      API   API    API
```

## New Files

| File | Package | Purpose |
|---|---|---|
| `kpi-strip.tsx` | `@radarboard/widget-engine` | KPI summary strip component |
| `detail-panel.tsx` | `@radarboard/widget-engine` | Contextual bottom row container |
| `sentry-issues.tsx` | `@radarboard/widget-engine` | Sentry issue list sub-view |
| `app-store-reviews.tsx` | `@radarboard/widget-engine` | App Store reviews sub-view |
| `health-monitors.tsx` | `@radarboard/widget-engine` | Health monitors sub-view |

## Modified Files

| File | Change |
|---|---|
| `apps/app/app/globals.css` | Add `kpis` row, rename `opencollective` to `detail` |
| `apps/app/components/dashboard.tsx` | Wire hooks, add KPI strip, replace OC row with detail panel |
| `packages/widgets/package.json` | Add exports for new widget components |

## Implementation Notes

- **`HealthIncident` type extraction**: The `HealthIncident` interface is currently defined locally inside `packages/hooks/src/use-health.ts`. It must be extracted to `packages/types/src/health.ts` so `detail-panel.tsx` can import it.
- **Last Deploy derivation**: The "Last Deploy" KPI card data is derived from `useShipping()` — pick the first item from the sorted array (most recent) with `source === "vercel"` and extract `timeAgo`, `projectName`, and `projectColor`.
- **`useSeo` siteUrl parameter**: The hook accepts an optional second `siteUrl` parameter. The API route already resolves the siteUrl from project config when not provided, so passing only `activeProjectSlug` is sufficient.

## Not In Scope

- **Resend email triggers**: Sending health alerts via Resend is a separate concern. This spec covers the dashboard UI only. Automated alerting (e.g., "send email when BetterStack reports a monitor down") would be a follow-up feature.
- **Settings/preferences UI**: No user-configurable dashboard layout in this iteration.
- **Widget expand/drill-down**: Clicking a KPI card to focus or expand is a future enhancement. This iteration shows all data in a read-only layout.
- **Responsive breakpoints for KPI strip**: The KPI strip will hide on mobile (single-column layout). Detail on responsive behavior is deferred.

## Testing Strategy

- **Type check**: `pnpm turbo run typecheck` must pass.
- **Build**: `pnpm turbo run build` must pass with all new routes registered.
- **Visual verification**: Run `pnpm dev` and verify:
  - KPI strip renders with placeholder/mock data when integrations are not configured.
  - Detail panel shows correct sub-view based on selected project.
  - Shipping, Ideas, SEO widgets display mock data (since real API keys won't be present in dev).
  - Ticker shows mock health alerts.
- **Integration verification** (with real API keys): Each hook fetches real data and displays it in the correct widget. Verified per-service by adding env vars one at a time.
