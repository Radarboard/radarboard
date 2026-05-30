# Template Detail Selection

**Date:** 2026-03-18  
**Status:** Approved  
**Scope:** Add reusable, URL-synced detail selection to the widget template system using a shared dialog host and registry-backed detail renderers.

## Overview

The current template system can render shared widget structures, but it cannot replace widgets that need row/item selection tied to URL state and a detail dialog. Existing widgets such as analytics, shipping, SEO, ideas, and sponsorship all implement that pattern manually.

This spec adds a shared template-level detail-selection system so template widgets can:

- mark list or table rows as selectable
- encode selected state into the existing `selectedDetailId` URL flow
- resolve the selected item from the configured dataset
- render a shared dialog using a registry-backed detail renderer

The goal is to make detail-driven widgets template-compatible without falling back to widget-specific dialog wiring.

## Goals

- Support URL-synced detail selection in template widgets
- Cover both simple single-source selection and sponsorship-style prefixed multi-source selection
- Reuse the existing dashboard routing model: `widgetId:itemId`
- Keep detail rendering registry-backed and testable
- Preserve backwards compatibility with existing custom widgets

## Non-Goals

- Replacing every existing detail dialog immediately
- Inline or embedded detail panes in the first pass
- Cross-widget global detail surfaces
- Arbitrary runtime expressions for selection or item lookup

## Existing Patterns In The Repo

There are two real patterns today:

### 1. Simple item selection

Widgets such as analytics, shipping, SEO, and ideas:

- derive an ID from the clicked row
- call `onSelectedDetailIdChange(id)`
- resolve the selected item from a map using `useSelectedItem`
- render a dialog owned by the widget

Examples:

- `packages/widgets/src/widgets/analytics/analytics-live/index.tsx`
- `packages/widgets/src/widgets/shipping/shipping-log.tsx`
- `packages/widgets/src/widgets/seo/seo-queries.tsx`
- `packages/widgets/src/widgets/ideas/ideas-bugs.tsx`

### 2. Prefixed multi-source selection

The sponsorship widget has multiple selectable tabs and uses prefixes to avoid collisions:

- `ghsponsor:<login>`
- `member:<id>`
- `txn:<id>`

Example:

- `packages/widgets/src/widgets/sponsorship/index.tsx`

The template system must support both patterns.

## Design

### Selection Model

Selection is configured per selectable section. The encoded selection value inside a template widget is always:

```text
<selectionId>:<itemKey>
```

Examples:

- `page:/docs::main-site`
- `shipping:linear-123`
- `txn:oc_txn_987`

The dashboard continues to own the outer URL format:

```text
<widgetId>:<selectedDetailId>
```

So the full query state stays consistent with the current app contract.

### Config Types

Add a reusable selection config that can be attached to list and table sections.

```typescript
interface TemplateSelectionConfig {
  /** Stable namespace within the widget, e.g. "page", "txn", "member" */
  selectionId: string;
  /** Item-relative field used as the selected key */
  keyField: string;
  /** Which registered detail renderer to use */
  detailRendererId: string;
  /**
   * Dataset used to resolve the selected item.
   * Defaults to the section source.
   */
  source?: DataSource;
  /** Optional dialog configuration */
  dialog?: {
    title?: string;
    size?: "sm" | "md" | "lg";
  };
}
```

Extend the relevant section configs:

```typescript
interface ListSectionConfig {
  type: "list";
  source: DataSource;
  itemTemplate: ListItemTemplate;
  maxItems?: number;
  emptyMessage?: string;
  selection?: TemplateSelectionConfig;
}

interface TableSectionConfig {
  type: "table";
  source: DataSource;
  columns: TableColumnConfig[];
  searchable?: boolean;
  defaultSort?: { key: string; direction: "asc" | "desc" };
  emptyMessage?: string;
  selection?: TemplateSelectionConfig;
}
```

### Detail Renderer Registry

Add a registry parallel to `DATA_SOURCE_REGISTRY`.

```typescript
type TemplateDetailRendererProps<TItem = unknown, TSourceData = unknown> = {
  item: TItem;
  sourceData: TSourceData;
  projectSlug: string | null;
  close: () => void;
};

type TemplateDetailRenderer = ComponentType<TemplateDetailRendererProps>;

const DETAIL_RENDERER_REGISTRY = new Map<string, TemplateDetailRenderer>();
```

Each renderer is a focused adapter around an existing detail component or dialog body.

Examples:

- `analytics.top-page`
- `shipping.item`
- `seo.query`
- `ideas.item`
- `sponsorship.sponsor`
- `sponsorship.member`
- `sponsorship.transaction`

### Shared Detail Host

`TemplateWidget` gets a shared detail host that:

1. Reads `selectedDetailId`
2. Finds the matching selection config among rendered sections
3. Resolves the selected item from the configured dataset
4. Resolves the renderer from `DETAIL_RENDERER_REGISTRY`
5. Renders the detail dialog
6. Clears selection via `onSelectedDetailIdChange(null)` on close

This keeps all selection mechanics inside the template system instead of duplicating them inside each template widget.

### Resolution Rules

Selection resolution must be deterministic and narrow:

- `selection.keyField` is always resolved relative to the item
- `selection.source ?? section.source` provides the dataset for lookup
- the selected item is the first dataset entry whose `keyField` equals the decoded key
- the detail renderer receives:
  - `item`: the selected row/item
  - `sourceData`: the full resolved dataset behind the selection source
  - `projectSlug`
  - `close()`

This covers:

- single-item dialogs like shipping
- dialogs that need both the item and dataset-level metrics, like SEO
- prefixed multi-source tabs like sponsorship

### Section Behavior Changes

#### ListSection

When `selection` is defined:

- rows render as buttons that call `onSelectedDetailIdChange`
- the selected token is built as `${selection.selectionId}:${key}`
- row keys remain unchanged
- if `keyField` resolves to `null` or `undefined`, the row is not selectable

#### TableSection

When `selection` is defined:

- rows become clickable using `WidgetTable` row click support
- the selected token is built the same way as in lists
- row selection is based on the full row object, not on cell values

### Tabs And Multi-Selection Widgets

The template system must support multiple selectable sections in the same widget, including nested tabs.

The `selectionId` namespace is how collisions are prevented.

Examples:

- `page:<key>` for analytics top pages
- `query:<key>` for SEO queries
- `ghsponsor:<login>`, `member:<id>`, `txn:<id>` for sponsorship

This replaces the sponsorship widget’s current manual prefix helpers with a declarative template configuration.

## File Changes

### Template Types

- `packages/widgets/src/templates/types.ts`
  - add `TemplateSelectionConfig`
  - add `selection?` to list/table section configs

### Template Runtime

- `packages/widgets/src/templates/template-widget/index.tsx`
  - pass through `selectedDetailId` and `onSelectedDetailIdChange`
  - render shared detail host

- `packages/widgets/src/templates/section-renderer/index.tsx`
  - collect selection-capable sections

- `packages/widgets/src/templates/data-resolver/index.tsx`
  - expose source data needed for detail resolution

- `packages/widgets/src/templates/sections/list-section/index.tsx`
  - add optional selection behavior

- `packages/widgets/src/templates/sections/table-section/index.tsx`
  - add optional row click behavior

### New Files

- `packages/widgets/src/templates/detail-renderers.tsx`
  - registry and registration helpers

- `packages/widgets/src/templates/detail-host/index.tsx`
  - parse `selectedDetailId`
  - resolve config, dataset, item, and renderer
  - own the shared dialog wrapper

- `packages/widgets/src/templates/utils/selection.ts`
  - encode/decode helpers for `<selectionId>:<itemKey>`

## Example Configs

### Analytics Pages

```typescript
{
  type: "table",
  source: { sourceId: "analytics", field: "topPages" },
  columns: [...],
  selection: {
    selectionId: "page",
    keyField: "path",
    detailRendererId: "analytics.top-page",
  },
}
```

Note: analytics currently keys by `path + platformName` in some views. For template parity, the resolver should expose a stable `detailKey` field so selection does not depend on ad hoc composite logic inside the section.

### Shipping

```typescript
{
  type: "list",
  source: { sourceId: "shipping", field: "items" },
  itemTemplate: {...},
  selection: {
    selectionId: "shipping",
    keyField: "id",
    detailRendererId: "shipping.item",
  },
}
```

### Sponsorship Transactions

```typescript
{
  type: "list",
  source: { sourceId: "sponsorship", field: "recentTransactions" },
  itemTemplate: {...},
  selection: {
    selectionId: "txn",
    keyField: "id",
    detailRendererId: "sponsorship.transaction",
    dialog: { size: "md" },
  },
}
```

## Migration Strategy

### Phase 1: Add the shared selection system

- add selection config types
- add detail registry
- add shared detail host
- add list/table section support
- add encode/decode utilities and tests

### Phase 2: Register adapters for existing detail UIs

Wrap existing detail components in registry-backed renderers:

- `TopPageDetail`
- `ShippingDetail`
- `SeoQueryDetail`
- `IdeaBugDetail`
- `SponsorDetail`
- `MemberDetail`
- `TransactionDetail`

### Phase 3: Prove with template examples

Update template example widgets to use the new selection config:

- `analytics-template`
- `sponsorship-template`

### Phase 4: Production replacement

Only replace legacy widgets once:

- compact parity is acceptable
- expanded behavior matches
- selection and detail rendering are proven

## Testing

Add focused coverage for:

1. selection token encoding/decoding
2. list selection dispatch
3. table row selection dispatch
4. selected item lookup from the configured dataset
5. shared detail dialog open/close behavior
6. namespaced multi-selection within the same widget
7. renderer resolution failure fallback

## Failure Modes

- Unknown `detailRendererId`: render a safe empty state in the dialog
- Unknown `selectionId`: ignore the selection and clear on next close
- Missing selected item in dataset: render “item no longer available”
- Missing `keyField`: row becomes non-selectable

## Why This Option

This is the most scalable first implementation because it centralizes both halves of the pattern:

- selection mechanics
- detail rendering contract

It avoids a half-step where templates can select items but still require widget-specific custom dialog logic. At the same time, it stays constrained enough to fit the current app architecture by limiting v1 to dialog presentation only.
