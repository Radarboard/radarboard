# USD/CAD Currency Toggle Design

**Date:** 2026-03-16
**Status:** Approved

## Overview

Add a USD/CAD toggle to the dashboard so users can view all monetary values in either American or Canadian dollars. RevenueCat already supports requesting data in CAD natively. Open Collective stays in its native currency (no conversion).

## Changes

### 1. Types (`packages/types/src/dashboard.ts`)

Add `DisplayCurrency` type and include it in `DashboardState`:

```typescript
export type DisplayCurrency = "USD" | "CAD";
```

### 2. Dashboard State (`packages/hooks/src/use-dashboard.tsx`)

Add `currency: DisplayCurrency` to the context with default `"USD"`, plus a `setCurrency` setter.

### 3. TopBar (`packages/widgets/src/top-bar.tsx`)

Add a USD/CAD toggle group (same `ToggleGroup` component used for time range/granularity). New props: `currency: DisplayCurrency` and `onCurrencyChange`.

### 4. Revenue API Route (`apps/app/app/api/revenue/route.ts`)

- Accept `currency` query param (default `"USD"`)
- Pass it to `getOverviewMetrics(config, currency)` and `getChartData(config, "revenue", { ...options, currency })`
- Use the actual currency from the API response instead of hardcoding `"USD"` for MRR and netRevenue

### 5. Revenue Hook (`packages/hooks/src/use-revenue.ts`)

- Accept `currency: DisplayCurrency` parameter
- Include in fetch URL: `/api/revenue?range={range}&currency={currency}`
- Refetch when currency changes (already handled by the useCallback dependency)

### 6. `formatCurrency` Fix (`packages/utils/src/format-currency.ts`)

Fix compact mode to use `Intl.NumberFormat` for the currency symbol instead of hardcoding `$`. This ensures `CA$` displays for CAD and `$` for USD.

### 7. Line Chart (`packages/charts/src/line-chart.tsx`)

Accept optional `currency` prop, use it in the default `formatValue` instead of hardcoding `"USD"`.

### 8. Revenue Chart (`packages/widgets/src/revenue-chart.tsx`)

Accept `currency` prop and pass it to `MonitorLineChart`.

### 9. Dashboard (`apps/app/components/dashboard.tsx`)

Wire `currency` from dashboard state to: `TopBar`, `useRevenue(timeRange, currency)`, and `RevenueChart`.

### 10. Open Collective

No changes. OC data is displayed in whatever currency the collective uses. The widget already handles this correctly via `Intl.NumberFormat`.

## Files Changed

| File | Change |
|---|---|
| `packages/types/src/dashboard.ts` | Add `DisplayCurrency` type, add to `DashboardState` |
| `packages/hooks/src/use-dashboard.tsx` | Add `currency` state + `setCurrency` setter |
| `packages/widgets/src/top-bar.tsx` | Add USD/CAD toggle group |
| `apps/app/app/api/revenue/route.ts` | Read `currency` param, pass to RC API |
| `packages/hooks/src/use-revenue.ts` | Accept `currency` param |
| `packages/utils/src/format-currency.ts` | Fix compact mode currency symbol |
| `packages/charts/src/line-chart.tsx` | Accept `currency` prop |
| `packages/widgets/src/revenue-chart.tsx` | Pass `currency` to chart |
| `apps/app/components/dashboard.tsx` | Wire currency through all components |
