# Widget Standardization — Design Spec

**Date:** 2026-03-19
**Status:** Approved

---

## Overview

Radarboard has made strong progress toward a shared widget system, but the current state still mixes three modes of implementation:

1. widgets fully rendered by layout nodes, recipes, and section primitives
2. widgets that expose a visual editor path but still render custom runtime UIs
3. widgets that still rely on custom presentation or custom editor behavior for advanced cases

The goal of this effort is to finish the transition and make the widget platform truly standardized across:

- compact views
- expanded views
- editor model

The end state is a single widget platform where widgets are assembled from reusable layout nodes, reusable section primitives, shared recipes, and widget-specific data adapters. Differences between widgets should live in configuration and normalized data, not in bespoke rendering shells.

This spec defines the architecture and migration plan for reaching that state.

---

## Goals

- Every production widget compact view renders from the shared template/runtime primitive system.
- Every production widget expanded view also renders from the same shared system.
- Every production widget uses the same editor model.
- No new bespoke widget editor UIs are introduced as an end-state pattern.
- Remaining custom widget presentation code is converted into reusable section primitives or recipes.
- Future widgets can be created quickly by choosing recipes, layouts, and bindings instead of building bespoke components.
- The resulting primitive catalog makes redundancy visible so overlapping patterns can be consolidated over time.

---

## Non-Goals

- Rewriting widget-specific data adapters into one generic service abstraction.
- Eliminating all widget-specific data normalization logic.
- Forcing all behavior into a tiny set of hyper-generic sections.
- Standardizing every already-migrated widget in the same initial wave.

Phase 1 focuses first on the remaining holdouts. Cleanup of already-migrated widgets comes after the holdouts are standardized.

---

## Architectural Direction

The standardized widget platform consists of four layers:

1. **Layout nodes**
2. **Section primitives**
3. **Recipes**
4. **Data adapters**

### Layout Nodes

Layout nodes define structure only. They should stay generic and low-level.

Current and planned layout nodes:

- `stack`
- `split`
- `grid`
- `tabs`

Layout nodes should never own business behavior like filtering, ranking, metric formatting, or event streaming. They only define composition and spatial structure.

`tabs` as a layout node means a container that swaps child layouts or child sections by active tab. It does not define the appearance of the tab control itself.

### Section Primitives

Section primitives are the core visual/behavioral building blocks. They are the unit that both runtime rendering and the visual editor manipulate.

Existing primitives already in use include:

- `kpi-row`
- `list`
- `row-list`
- `activity-chart`
- `tabs`

Phase 1 expands this catalog to cover the remaining holdouts with reusable primitives rather than bespoke widget renderers.

`tabs` as a section primitive means the rendered tab control surface: labels, icons, counts, accent colors, active state, and tab metadata. The layout node decides what content exists per tab; the section primitive decides how the tab control is rendered and configured.

### Recipes

Recipes are composition presets built from layout nodes and section primitives. They exist to accelerate widget creation, not to become widget-specific wrappers.

Recipes should remain thin and compositional:

- good: `summary_list`, `rail_list`, `summary_chart_list`
- bad: `shipping_widget`, `aso_dashboard`, `revenue_widget`

If a pattern is structurally reusable, it should become a primitive or a recipe. If it is merely one widget’s preferred default arrangement, it should live in the widget’s default config.

### Data Adapters

Data adapters remain widget- or integration-specific. Their role is to normalize raw upstream data into shapes the primitives can render.

Per-widget complexity belongs here:

- API response normalization
- derived fields
- color/status mapping
- ranking deltas
- duration formatting
- chart buckets
- filter option derivation

Per-widget complexity should not live in bespoke JSX shells.

---

## Primitive Catalog Expansion

Phase 1 introduces these new reusable primitives.

### `summary-quad`

A generic 2×2 summary shell.

Supports:

- plain metric cards
- colored variants
- subtitles
- slot-level custom content

Primary consumers:

- `revenue`
- `sponsorship`

Longer-term potential:

- app summary cards
- billing/usage widgets
- milestone or portfolio dashboards

### `filter-bar`

A reusable top control row for dense, stateful widgets.

Supports:

- select inputs
- chips/toggles
- numeric/range controls
- persisted state bindings for user-facing control state
- counts and filter summaries

Primary consumers:

- `aso-keywords`

Likely future consumers:

- `logs`
- `health`
- `appstore`
- advanced analytics widgets

### `dense-ranked-table`

A configurable compact ranked/metric table primitive.

Supports:

- explicit columns
- rank display
- mini bars
- rank delta indicators
- flags/icons
- badges
- row click/detail behavior
- persisted sort behavior

Primary consumers:

- `aso-keywords`

This should become the standard primitive for dense compact ranking widgets.

### `stream-list`

A reusable live/event feed primitive.

Supports:

- append/prepend behavior
- timestamp formatting
- severity/source badges
- row expansion
- local scroll ownership
- log/event row structure

Primary consumers:

- `logs`

Future consumers:

- deployment feeds
- activity/event streams
- system or audit feeds

### `trend-panel`

A compact side or summary panel for small charts and metric summaries.

Supports:

- title
- primary metric
- sparkline or micro-bar chart
- optional footer/meta

Primary consumers:

- `revenue`
- `sponsorship`
- `errors`-style rail layouts

### `detail-table`

A shared expanded-mode table shell.

Supports:

- shared header/footer treatment
- filter area integration
- consistent empty states
- selection handling
- shared expanded table presentation

Primary consumers:

- `aso-keywords`

Future consumers:

- `seo`
- `github-stars`
- `npm-downloads`

---

## Standardization Rules

The primitive catalog should grow according to these rules:

- If behavior is genuinely reusable, add a section primitive.
- If only composition is reusable, add or reuse a layout node.
- If a pattern is mostly a preset of existing parts, add a recipe.
- Do not add widget-specific editor components as a long-term solution.
- Do not add giant “do everything” generic sections that hide unrelated behavior in configuration.

The bias is intentionally toward a somewhat larger primitive catalog. Even single-use primitives are acceptable if they define a real reusable pattern that future widgets can build on.

---

## Migration Strategy

Phase 1 standardizes the remaining holdouts first, then Phase 2 revisits already-migrated widgets for cleanup and deeper deduplication.

### Phase 1 Order

#### 1. `revenue` and `sponsorship`

These are the lowest-risk remaining holdouts because they already share strong visual structure.

Plan:

- migrate runtime compact and expanded summary layouts onto:
  - `summary-quad`
  - `trend-panel`
  - recipe-backed layout composition
- keep their data adapters distinct
- remove bespoke layout/render shells completely before Phase 1 sign-off

#### 2. `logs`

This is the reference case for a reusable live feed primitive.

Plan:

- introduce `stream-list`
- standardize:
  - scrolling
  - row expansion
  - source/severity rendering
  - live update behavior
- remove bespoke list container logic from the widget

#### 3. `aso-keywords`

This is the most bespoke remaining widget and the best forcing function for the next primitive wave.

Plan:

- introduce:
  - `filter-bar`
  - `dense-ranked-table`
  - `detail-table`
- migrate compact and expanded views onto those primitives
- make selection, filtering, sorting, and store behavior config-driven instead of widget-specific JSX

### Temporary Exception Policy

Temporary exceptions are allowed during implementation but not at sign-off.

- A widget may temporarily keep a custom compact or expanded renderer while the replacement primitive is being built.
- A widget may temporarily keep a custom editor panel while equivalent shared editor controls are being implemented.
- These exceptions must be tracked as explicit migration tasks and cannot be counted as complete.

Phase 1 is only complete when the named holdouts in this phase:

- render through shared primitives at runtime
- edit through the shared editor model
- no longer depend on bespoke presentation shells

If a holdout cannot be fully migrated with the current primitive set, the correct action is to add or refine a primitive instead of declaring the holdout permanently custom.

### Phase 2

Once the remaining holdouts are standardized, Phase 2 refactors already-migrated widgets onto the richer primitive catalog where it materially reduces duplication, especially for expanded views.

---

## Editor and Runtime Convergence

The long-term system should have one source of truth for runtime and editor behavior.

### Widget Descriptor Responsibility

A widget descriptor should declare:

- data sources
- default recipe/layout
- default sections
- available section variants/options

It should not need to declare a bespoke editor component in the final standardized system.

### Runtime Config

The template/runtime config becomes the single source of truth for:

- compact rendering
- expanded rendering
- editor preview

Expanded mode should be another layout composition of the same system rather than a separate rendering path with bespoke widget modules.

### Persisted Config Migration and Versioning

The platform needs an explicit migration contract for existing saved widget configs.

- Introduce a schema version field on standardized widget configs.
- Add a migration layer that upgrades persisted widget configs to the latest runtime/editor shape at load time.
- Keep migration functions idempotent and deterministic.
- Preserve unknown fields only when they are explicitly safe to round-trip; otherwise deprecated fields should be removed during migration.
- If a persisted config cannot be migrated safely, fall back to the widget descriptor’s default standardized config and emit a recoverable warning.

Migration requirements:

- existing saved dashboards must continue to render after deployment
- existing widget settings must survive migration without silently changing user intent
- editor save operations must always emit the latest schema version
- migration functions must have focused tests

Rollback requirements:

- migration happens in memory on load, not as a destructive one-way storage rewrite during boot
- older commits must still be able to read persisted source data if rollback is required

### Data Adapters

Data adapters stay integration-specific. They are the correct place for service-specific logic and shaping, including:

- raw response normalization
- derived metrics
- severity or color mapping
- ranking deltas
- chart bucket construction
- filter choice derivation

### Visual Editor

The visual editor should edit the same config the runtime consumes.

As the primitive catalog grows, the editor gains section-aware controls for those new primitives:

- `summary-quad` slot editing
- `filter-bar` control editing
- `dense-ranked-table` column editing
- `stream-list` feed behavior editing
- `trend-panel` metric/chart binding
- `detail-table` column/filter/footer editing

The editor should stop diverging into “custom editor vs template editor” as a permanent architecture split.

### State Ownership Rules

To keep editor/runtime parity consistent, state ownership must be explicit.

**Persisted widget config**

- default filter definitions
- default sort definitions
- available columns and controls
- control layout
- binding metadata
- compact and expanded section composition

**Primitive-local UI state**

- currently open row
- hover and focus state
- temporary accordion state inside the editor
- ephemeral in-session control state when that state is intentionally not persisted

**Persisted user widget state**

- user-selected sort order
- persisted filter selections
- selected store or segment
- only when the widget explicitly requires user-level persistence

**Adapter/query state**

- loading
- error
- polling or stream status
- fetched timestamps
- normalized derived data

Rules:

- primitives must not invent ad hoc persistence outside the standardized persistence layer
- persisted user widget state must be declared by section config, not hidden in widget JSX
- adapter/query state must never leak into editor schema

---

## Validation Standard

Each migration in this effort must pass the same standard.

### Runtime Validation

- Compact and expanded views render through shared primitives.
- No horizontal overflow is introduced.
- Scroll ownership remains local to the intended pane or list.
- Empty and loading states remain correct.

### Editor Validation

- The widget opens in the shared editor host.
- The editor preview matches runtime structure.
- Bindings/settings can reproduce the widget’s default view.

### Test Validation

- Primitive-level tests for each new section primitive.
- Focused widget tests for compact and expanded behavior.
- Registry tests continue asserting that every production widget exposes a visual editor path.
- Migration tests verify existing saved widget configurations still render correctly after upgrade.
- Persistence tests verify user settings that are intended to survive migration still survive migration.
- Backward-compat tests verify the migration layer can upgrade pre-standardization configs to the latest schema version.

---

## Definition of Done

This initiative is done when all of the following are true:

- No production widget depends on a bespoke presentation shell.
- Custom widget editors are gone as an architectural category.
- Expanded views use the same section/layout system as compact views.
- Widget differences live primarily in:
  - data adapters
  - default recipes
  - config bindings

At that point, the widget platform becomes a true composition system rather than a mixed world of shared primitives plus residual bespoke widgets.

---

## Out of Scope for Phase 1

- Standardizing every already-migrated widget in the same wave
- Redesigning service adapters into a universal data API
- Reducing the primitive catalog prematurely to force elegance over usefulness

Phase 1 prioritizes correctness of abstraction and coverage of the remaining holdouts. Catalog cleanup comes after the platform is complete enough to observe real redundancy.
