# Widgets Package — Agent Reference

> Auto-generated. Regenerate with `pnpm generate-agents-md`.

## Overview

`@radarboard/widget-engine` provides the dashboard widget system. Each widget is a self-contained directory under `src/widgets/` with a predictable structure. Widgets are rendered in a 3x3 grid (9 slots) with compact and expanded views.

## Storybook Rules

- Stories must use real Radarboard components and real product states. Do not invent placeholder chrome, labels, dashboard copy, or fake screen structures that are not implemented in the product.
- If a widget, layout, or screen state is missing, add it to the actual component or page first, then build the story from that real implementation.
- Screen-level stories should compose from actual app surfaces such as dashboard, settings, onboarding, and debug components, with controls only toggling between real states.
- Do not add Storybook-only wrapper layout around widget-engine or app components to force centering, spacing, or shell behavior. If the story needs that behavior, add a real presentation mode to the component or move the concern into the shared Storybook provider/decorator layer.

## Canonical Directory Structure

```
<widget>/
├── index.ts          # WidgetDescriptor (id, name, component, config, auth)
├── types.ts          # Widget-specific config & data types
├── README.md
├── components/
│   ├── <widget>-compact.tsx    # Compact grid view
│   └── <widget>-expanded.tsx   # Expanded overlay view
├── hooks/
│   └── use-<widget>.ts         # SWR-based data fetching hook
├── mcp/
│   ├── mcp-tools.ts            # MCP tool definitions
│   └── mcp-tools.test.ts       # Tool validation tests
└── __tests__/
    └── <widget>.test.tsx        # Component integration tests
```

## Key Types (src/widgets/types.ts)

| Type | Purpose |
|------|---------|
| `WidgetDescriptor<TConfig>` | Full widget definition: id, name, component, defaultConfig, auth, polling |
| `WidgetRenderProps` | Props passed to compact component: projectSlug, timeRange, config, onRefetch |
| `GridSlot` | Grid position: `slot1` through `slot9` |
| `WidgetAuth` | Auth requirement: integrationId, type, scopes, label |
| `WidgetPollingConfig<T>` | Dynamic polling: sourceIds, getInterval(config) |
| `WidgetVisualEditorBinding` | Visual editor config: kind, getConfig, setConfig |

## Widget Registry

All widgets are registered in `src/init.ts` via `registerWidget(descriptor)`. The registry is a `Map<string, WidgetDescriptor>`.

## Widget Summary

| Widget | Default Slot | Required Integrations | Expanded |
|---|---|---|---|
| `analytics` | slot4 | openPanel | - |
| `aso-keywords` | slot8 | _(none)_ | yes |
| `builds` | slot8 | vercel | yes |
| `deployments` | slot8 | vercel | yes |
| `domains` | slot9 | vercel | yes |
| `downloads` | slot8 | npm | yes |
| `ideas` | slot3 | _(none)_ | yes |
| `logs` | slot7 | _(none)_ | yes |
| `observability` | slot6 | _(none)_ | yes |
| `projects` | slot9 | vercel | yes |
| `pulls` | slot7 | github | yes |
| `revenue` | slot1 | _(none)_ | yes |
| `seo` | slot5 | _(none)_ | yes |
| `shipping` | slot2 | _(none)_ | yes |
| `sponsorship` | slot7 | _(none)_ | yes |
| `stars` | slot7 | _(none)_ | yes |

## Template System

Most widgets use the **template system** (`src/templates/`) which provides declarative, config-driven rendering:

### WidgetTemplateConfig

```typescript
{
  dataSources: DataSourceDeclaration[];  // What data to fetch: [{ id: "revenue" }]
  sections: SectionConfig[];              // Compact view layout
  expandedSections?: SectionConfig[];     // Expanded view layout
}
```

### Available Section Types

`alert`, `headline-stat`, `kpi-row`, `summary-quad`, `list`, `row-list`, `stream-list`, `filter-bar`, `dense-ranked-table`, `table`, `chart`, `activity-chart`, `tabs`, `stack`, `grid`, `split`

## Hooks Pattern

Widget hooks follow a consistent pattern using SWR for caching and polling:

```typescript
export function useWidgetData(projectSlug, config) {
  const refreshInterval = usePollingInterval("source-id");
  const { data, error, isLoading, mutate } = useSWR(key, fetcher, { refreshInterval });
  const refetch = useCallback(async () => { /* force refresh with ?refresh=1 */ }, [mutate]);
  return { data, loading, error, refetch, fetchedAt };
}
```

## Adding a New Widget

```bash
pnpm create-widget <name>
```

This scaffolds from `_template/` with the canonical structure. Then:
1. Define the descriptor in `index.ts`
2. Create compact/expanded components and forward `widgetId` into `TemplateWidget` / `TemplateWidgetExpanded` when wrapping them
3. Use [`@radarboard/widget-engine/widget-modal`](/Users/thedaviddias/Projects/radarboard/packages/widgets/src/widget-modal/index.tsx) for custom widget detail/config dialogs instead of importing `DialogContent` directly
4. Add data-fetching hook
5. Register in `src/init.ts`
