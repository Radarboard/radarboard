# __WIDGET_NAME__

> Scaffolded with `pnpm create-widget __WIDGET_KEBAB__`

## Quick Start

1. **Define the recipe** — Edit the template recipe in `index.ts` to set your layout (list, chart, summary, etc.)
2. **Wire data** — Implement the data-fetching hook in `hooks/use-__WIDGET_KEBAB__.ts`
3. **Register the data source** — Connect hook data in `data-resolver.tsx`
4. **Test** — Run `pnpm --filter @radarboard/widget-__WIDGET_KEBAB__ test`

## Structure

```
src/
├── index.ts              # WidgetDescriptor — recipe, layout, config
├── types.ts              # Widget-specific data types
├── routes.ts             # API route constants
├── data-resolver.tsx      # Bridges SWR hook → template data source
├── components/
│   ├── __WIDGET_KEBAB__-compact.tsx   # Grid card view (3x3 grid)
│   └── __WIDGET_KEBAB__-expanded.tsx  # Expanded overlay view
├── hooks/
│   └── use-__WIDGET_KEBAB__.ts        # SWR data-fetching hook
├── mcp/
│   └── mcp-tools/        # MCP tools for AI assistant (optional)
└── conformance.test.ts   # Validates descriptor against SDK rules
```

## How Widgets Work

Widgets use a **template recipe** system — you declare your layout as a data structure, not JSX:

```ts
const recipe: TemplateRecipeModel = {
  kind: "summary_list",       // Layout pattern
  summary: [{ type: "kpi-row", metrics: [...] }],
  content: [{ type: "list", source: { sourceId: "my-data", field: "items" }, ... }],
};
```

### Recipe Kinds

| Kind | Description |
|------|-------------|
| `content_only` | Single content area (list, chart, table) |
| `summary_list` | KPI summary + scrollable list |
| `summary_content` | KPI summary + rich content area |
| `summary_chart_list` | KPI summary + chart + list |
| `rail_content` | Side rail + main content |
| `rail_list` | Side rail + scrollable list |
| `summary_only` | KPI-only display |
| `feed_list` | Activity feed style |

### Section Types

`list`, `chart`, `table`, `kpi-row`, `headline-stat`, `summary-quad`, `activity-chart`, `stream-list`, `card-list`, `alert`, `filter-bar`, `tabs`, and more.

## Data Flow

```
Integration API → SWR Hook → Data Resolver → Template Engine → Widget UI
```

1. **Hook** (`use-__WIDGET_KEBAB__.ts`) — Fetches from `/api/integrations/__WIDGET_KEBAB__/data`
2. **Resolver** (`data-resolver.tsx`) — Reports data to the template system via `reportResolverState`
3. **Template** — Renders sections using the recipe and resolved data

## Key Files to Reference

- **SDK types**: `@radarboard/widget-sdk` — `WidgetDescriptor`, `WidgetRenderProps`
- **Recipes**: `@radarboard/widget-sdk/recipes` — Layout factory functions
- **Composition**: `@radarboard/widget-sdk/composition-catalog` — Available primitives and patterns
- **Real examples**: `widgets/github-activity/`, `widgets/revenue/`, `widgets/analytics/`
- **Extension guide**: `CONTRIBUTING-EXTENSIONS.md`

## Module Boundaries

Widgets can only import from:
- `@radarboard/widget-sdk`
- `@radarboard/widget-engine`
- `@radarboard/types`
- `@radarboard/utils`
- `@radarboard/ui`
- `@radarboard/charts`
- `@radarboard/hooks`
- `@radarboard/assistant-ui`
