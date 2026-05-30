# Widget Templates Capability Matrix

**Date:** 2026-03-18
**Status:** Working draft
**Scope:** Current capabilities, validation strategy, and migration gates for the reusable widget template system.

## Purpose

The goal of the template system is not to migrate one widget at a time. The goal is to prove that recurring Radarboard widget patterns can be expressed through shared template primitives without regressing behavior.

## Current Coverage

| Capability | Status | Notes |
| --- | --- | --- |
| Config-defined widget descriptor | Supported | `createTemplateDescriptor()` produces standard widget descriptors. |
| Multi-source resolver composition | Supported | `DataResolverProvider` aggregates `fetchedAt` and `refetch`. |
| KPI row rendering | Supported | Covers labels, formatted values, deltas, sparklines, and breakdown tooltips. |
| Alert banners | Supported | Covers interpolation, severity variants, and simple conditions. |
| Lists | Supported | Supports item-relative field resolution, empty states, and status dots. |
| Tables | Supported | Supports sorting, search, and field formatting via `WidgetTable`. |
| Charts | Supported | Supports area, line, bar, and sparkline sections. |
| Tabs | Supported | Recursive composition works for section stacks within tab panels. |
| Loading states | Supported | KPI/list/table/chart sections have template-owned loading placeholders. |
| Widget auth metadata | Supported | Template widgets can define normal widget auth declarations. |
| Currency-aware formatting | Supported | Template sections resolve sibling `currency` fields instead of assuming USD. |
| URL-synced detail selection | Not supported | This still blocks widgets that drive `selectedDetailId` / detail panels. |
| Rich custom row rendering | Partial | Tables and lists support formatted fields, not bespoke row layouts. |
| Specialized compact cards | Partial | Templates cover common KPI/list patterns, not one-off card designs like `Last Payment`. |

## Example Widgets

| Widget | Role |
| --- | --- |
| `analytics-template` | Proves KPI + table + tabs + chart coverage for analytics-style widgets. |
| `revenue-template` | Proves KPI + breakdown + trend chart + payment list coverage. |
| `sponsorship-template` | Proves alert + KPI + multi-tab list/table coverage for sponsorship data. |

These template widgets are examples and comparison probes. They are not automatic replacements for the production widgets with the same domains.

## Migration Gates

A production widget should only be replaced by a template implementation when all of these are true:

1. Data parity: the resolver exposes every field and derived value needed by the legacy widget.
2. Compact-view parity: the default widget card preserves the information density and important cues of the legacy widget.
3. Expanded-view parity: the expanded state preserves navigation, tabs, tables, and interaction affordances.
4. State parity: loading, empty, unconfigured, and limited-access states match the legacy widget behavior.
5. Interaction parity: refresh, fetched-at, sorting, filtering, and any URL/detail behavior are preserved.

## Current Migration Readiness

| Widget family | Readiness | Reason |
| --- | --- | --- |
| Revenue-style KPI/trend widgets | Near-ready | Template system covers most of the shape, but compact-card parity still needs work. |
| Analytics-style summary widgets | Near-ready | Tables, KPI rows, charts, and tabs are covered. |
| Sponsorship-style multi-source widgets | Example-only | Summary states work, but the production widget still has richer UX than the template version. |
| Detail-driven widgets (`detail`, SEO drill-ins, ideas drill-ins) | Blocked | URL-synced detail selection is not supported yet. |

## Validation Strategy

The template system should be validated at three levels:

1. Utility tests: path resolution, formatting, and condition evaluation.
2. Template conformance tests: `TemplateWidget` rendering with mock data sources for alerts, KPI rows, lists, tables, charts, tabs, and resolver aggregation.
3. Registry and UI comparison: template example widgets stay reachable in the registry and can be compared side-by-side with legacy widgets before any replacement.

## Replacement Policy

Do not replace a legacy widget just because a template version renders. Replace only after the parity gates pass for that widget family. Until then, keep template widgets as side-by-side comparison implementations and extend the template system where it still falls short.
