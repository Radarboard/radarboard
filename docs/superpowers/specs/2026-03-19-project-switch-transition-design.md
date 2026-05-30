# Project Switch Transition — Design Spec

**Date:** 2026-03-19
**Status:** Approved

---

## Overview

Switching between project tabs currently feels slower than before because the dashboard treats the pending project as the live project before the route finishes. That causes the widget tree, KPI strip, and ticker to start re-resolving data for the target project while the route transition is still in flight. At the same time, the current loading treatment covers the whole widget area with a dark blocker that does not reflect the target layout.

This change separates visual transition state from live data state. The dashboard should swap to the target layout immediately, show a layout-aware skeleton overlay for that target project, and keep live widget data bound to the current route slug until navigation completes.

---

## Goals

- Make project tab switching feel immediate without showing incorrect project data.
- Render the target project's layout shape immediately after a tab click.
- Replace the current full-grid blocker with a grid-aware skeleton that matches the target layout.
- Keep widget, KPI, and ticker data bound to the route-backed project until navigation completes.
- Reuse the same layout resolution rules as the live dashboard so the transition scales with custom layouts.

---

## Non-Goals

- Building a full prefetch pipeline for per-project widget data.
- Reworking widget internals or adding widget-specific transition UIs.
- Changing the app-startup `DashboardSkeleton` used during initial settings/bootstrap load.

---

## Architectural Direction

The transition should split dashboard state into two tracks:

1. **Visual target state**
2. **Live data state**

### Visual target state

`pendingProjectSlug` drives:

- pending tab styling
- immediate target layout resolution
- the transition skeleton overlay

This state exists only to show where the user is going next.

### Live data state

`routeProjectSlug` remains the source of truth for:

- widget `projectSlug`
- KPI strip `projectSlug`
- bottom ticker `projectSlug`
- any other project-bound data hook

This prevents eager data churn before the router confirms the new route.

---

## State Model

### Current problem

`Providers` currently derives:

```ts
const activeProjectSlug = pendingProjectSlug ?? routeProjectSlug;
```

That makes the pending project become the active dashboard context immediately, which cascades into layout resolution and every project-scoped widget data hook.

### New model

The dashboard should derive two distinct values:

```ts
const dataProjectSlug = routeProjectSlug;
const visualProjectSlug = pendingProjectSlug ?? routeProjectSlug;
```

`dataProjectSlug` is passed into the dashboard provider as the active project for data and widget props.

`visualProjectSlug` is used only for:

- tab highlighting
- pending target naming
- target layout resolution for the skeleton overlay

`isProjectSwitching` remains true while `pendingProjectSlug !== routeProjectSlug`.

---

## Layout Resolution

Add a shared layout resolver helper so the live dashboard and the transition overlay follow identical rules.

Inputs:

- `widgetLayoutConfig`
- project slug

Outputs:

- `layoutId`
- resolved `LayoutDefinition`
- normalized slot mapping for that project and layout

Resolution rules:

| Condition | Layout |
|---|---|
| slug is null and no global override | `BASIC_3X3` |
| slug has `projectLayouts[slug].layoutId` | matching saved layout |
| slug has no project-specific layout | fallback layout used by the global dashboard |

The overlay only needs the resolved layout shape. It should not mount widget components.

---

## Transition UI

Replace the current full-grid dark blocker with a dedicated `ProjectSwitchSkeletonOverlay`.

### Behavior

- Render inside the existing dashboard grid container.
- Use the resolved target layout immediately when a project tab is clicked.
- Block pointer interaction with the underlying grid during the transition.
- Disappear as soon as `routeProjectSlug` catches up to `pendingProjectSlug`.

### Visual treatment

- Show card-like skeletons in the target slot geometry.
- Use dark dashboard surfaces, thin borders, and subtle shimmer or pulse.
- Avoid a centered takeover state.
- Keep any project label small and secondary, near the top of the grid or tabs.

Each placeholder card should suggest real widget chrome:

- a compact header line
- a smaller status/meta line
- a small set of content bars or blocks

The exact content can vary slightly by slot span so larger cells do not look identical to smaller ones.

---

## Component Boundaries

### Keep

- `DashboardSkeleton` for initial bootstrap and settings loading.
- existing widget components and widget error boundaries.

### Add

- a shared dashboard layout resolver helper
- a transition-only `ProjectSwitchSkeletonOverlay` component

### Update

- `Providers` so pending project state no longer drives live data state
- `DashboardContent` so tab selection can remain visually pending while KPI strip, ticker, and widgets stay route-bound until navigation completes

---

## Error Handling

- If the target project has no specific saved layout, use the same fallback layout as the live dashboard.
- If route navigation fails or stalls and pending state is cleared, remove the overlay and keep the current dashboard interactive.
- If widgets error after the route lands, existing widget error boundaries continue to handle those failures.

---

## Testing

Add coverage for:

1. shared layout resolution for global and per-project layouts
2. provider behavior where pending state does not change the live data slug
3. dashboard behavior where the transition overlay appears in the target layout immediately
4. overlay teardown when the route slug matches the pending slug

Existing tests for project tabs and dashboard/provider behavior should be extended rather than duplicated where possible.

---

## Files Expected To Change

| File | Change |
|---|---|
| `apps/app/app/providers.tsx` | split visual pending state from live data state |
| `apps/app/components/dashboard.tsx` | replace current blocker with transition overlay and target-layout rendering |
| `apps/app/components/dashboard-skeleton.tsx` | keep startup skeleton unchanged unless minor shared styles are extracted |
| `packages/hooks/src/use-dashboard.tsx` | use route-backed active slug for live data; expose only the state needed for pending visuals |
| `apps/app/hooks/settings-store.ts` or shared helper file | source layout config for resolver helper if needed |
| tests under `apps/app` and `packages/hooks` | cover resolver and pending transition behavior |

---

## Out of Scope

- background warming of all widget queries for every tab
- optimistic reuse of old widget content under the new tab
- changing the route structure or removing project-specific URLs
