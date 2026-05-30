# npm Integration and Widget Filtering — Design Spec

**Date:** 2026-03-19
**Status:** Approved

---

## Overview

Radarboard currently has an npm downloads widget, but it does not yet model npm as a first-class integration. The current implementation also mixes two different concerns:

- discovering which packages belong to the account
- deciding which packages a given widget instance should show

Those responsibilities need to be separated.

The goal of this work is to introduce a real npm integration that defines the package catalog, while allowing each npm widget instance to decide which packages to include or exclude from its own presentation. This supports multiple npm widgets showing different package subsets without duplicating package discovery logic.

---

## Goals

- Add npm as a first-class integration in Settings > Integrations.
- Make npm package discovery a shared integration concern rather than a widget concern.
- Support a global package catalog sourced from npm scope and manual additions.
- Let each npm widget instance filter packages independently.
- Support exact package names and glob-style patterns in widget filters.
- Preserve the current widget purpose: aggregate package-level stats such as weekly and monthly downloads.

---

## Non-Goals

- Building a full npm package management surface inside Radarboard.
- Supporting arbitrary npm org administration features.
- Introducing per-project npm download scoping as the primary model.
- Implementing long-term historical download trend storage in this first pass.

This phase focuses on package discovery and per-widget visibility rules over the current real-time snapshot model.

---

## Product Model

The npm feature is split into two layers.

### 1. Global npm integration

The npm integration defines the package universe available to npm widgets.

It owns:

- `scope`
- `extraPackages`

It does not own widget-specific hiding rules.

### 2. Widget-instance filtering

Each npm widget instance defines which packages from the discovered catalog should appear in that widget.

It owns:

- `includePackages`
- `excludePackages`

This allows one npm widget to show all packages, another to show only core packages, and another to suppress experimental or internal packages.

---

## Why This Boundary

This split matches Radarboard’s current architecture better than either extreme.

If filtering lived only in the integration:

- every npm widget would be forced to show the same package subset
- the integration would incorrectly own presentation behavior

If package discovery lived only in each widget:

- package definitions would be duplicated across widget instances
- discovery and normalization logic would drift
- future npm-backed widgets would have no shared source of truth

The integration should answer "what packages exist?".

The widget should answer "which of those packages should I show here?".

---

## Configuration Design

### Integration config

The npm integration stores metadata in the shared credentials-backed integration store so it appears in the existing Integrations UI.

Initial fields:

- `scope`
  - string
  - example: `@radarboard`
  - optional, but strongly recommended
- `extraPackages`
  - text field
  - newline- or comma-separated package names
  - used for unscoped packages or exceptions not discoverable from scope

This integration is metadata-oriented rather than secret-oriented. It still uses the existing integration storage path so it behaves consistently with the current settings architecture.

### Widget config

The npm widget gains:

- `includePackages`
  - exact names or glob patterns
  - optional
- `excludePackages`
  - exact names or glob patterns
  - optional

If `includePackages` is empty, the widget starts from the full discovered catalog.

If `includePackages` is non-empty, the widget starts from only matching packages.

`excludePackages` always wins.

---

## Package Resolution Rules

Package resolution happens in this order.

1. Build the discovered catalog from the npm integration.
2. Normalize and deduplicate package names.
3. Apply widget `includePackages`, if any.
4. Apply widget `excludePackages`.
5. Fetch download and package metadata for the final package set.

### Catalog sources

The discovered catalog is the union of:

- packages discovered from `scope`
- packages listed in `extraPackages`
- optionally, existing per-project `platform.integrations.npm.packageName` entries during migration

The migration compatibility behavior is important because the codebase already contains npm package names on project platform configs. The new integration should absorb that responsibility without creating a breaking transition.

### Deduplication

Package names are deduplicated before any upstream API calls.

This avoids duplicate network traffic and prevents a package configured from multiple sources from being double-counted.

---

## Pattern Matching

Widget filters must support:

- exact names
- glob-style patterns

Examples:

- `@radarboard/widget-engine`
- `@radarboard/*`
- `@radarboard/experimental-*`

Matching rules:

- case-sensitive
- package name based
- simple shell-style wildcard matching is sufficient for phase 1

Regex support is intentionally out of scope for this first pass. Globs are easier to explain in the UI and safer to validate.

---

## UI Design

### Integrations settings

Add a new npm integration card in Settings > Integrations.

The card should explain:

- this integration defines the package catalog for npm widgets
- `scope` is the primary discovery mechanism
- `extraPackages` handles packages outside that scope

Used-by labeling should include widgets that depend on an integration through `requiredIntegrations`, not only widgets that declare direct widget auth. This keeps the npm integration card properly linked to the npm downloads widget even though npm is a metadata integration.

### npm widget editor

The widget visual editor should expose:

- `includePackages`
- `excludePackages`

Both fields should accept newline- or comma-separated values.

Help text should clarify:

- exact package names are allowed
- globs are allowed
- exclusions override inclusions

The default behavior should be no filters, meaning the widget shows all discovered packages.

---

## Data Flow

The end-to-end flow is:

1. User configures npm integration in Settings > Integrations.
2. Integration config resolves the base package catalog.
3. npm widget instance reads its own include/exclude filters.
4. Widget resolves the final package set.
5. Data source fetches npm stats per package.
6. Widget renders aggregate KPIs and per-package rows.

This preserves the current package-level downloads model while making the source of truth explicit.

---

## Error Handling

The npm feature should fail soft.

Cases:

- no npm integration configured
- scope configured but no packages discovered
- widget filters remove all packages
- one or more package stats requests fail

Behavior:

- render empty state rather than crash
- keep partial results when some package fetches succeed
- treat unknown or invalid filter entries as non-matching, not fatal

The widget should surface "No packages" when the final resolved package set is empty.

---

## Migration Strategy

The repository already contains npm package names under project platform integrations and an in-progress npm integration data-source path.

To avoid breaking existing dashboards:

1. Introduce the new npm integration.
2. Continue reading legacy per-project `platform.integrations.npm.packageName` entries during migration.
3. Merge them into the discovered catalog.
4. Prefer integration-level discovery as the long-term canonical path.
5. Update docs and setup guidance to point new configuration to the npm integration.

This makes the transition additive rather than disruptive.

---

## Testing

Minimum coverage for this work:

- npm integration descriptor registers in the integration registry
- npm integration appears in settings service collection
- package catalog resolution merges scope/manual/legacy sources and deduplicates names
- widget include/exclude filtering supports exact matches
- widget include/exclude filtering supports glob patterns
- exclusions override inclusions
- widget empty state renders when the final package set is empty
- downloads aggregation still sums the filtered final package set correctly

---

## Recommended Implementation Order

1. Add first-class npm integration descriptor and settings presence.
2. Add package catalog resolver utility.
3. Add widget config fields for `includePackages` and `excludePackages`.
4. Apply filtered package resolution in the npm data source or widget fetch path.
5. Add tests for catalog resolution and widget filtering.
6. Update docs.

---

## Open Questions

No blocking open questions remain for phase 1.

The main future extension is optional widget-level local overrides beyond filtering, such as custom ordering or pinned packages, but that is intentionally deferred.
