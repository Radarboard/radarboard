# Plugin System

The plugin system allows extending the dashboard with self-contained features that contribute UI surfaces, dashboard widgets, and MCP tools.

## Architecture

```
@radarboard/plugins          — types, registry, host, plugin implementations
@radarboard/mcp-tools        — MCP router that aggregates plugin tools
apps/app                 — API routes, settings UI, overlay rendering
```

Plugins are **independent but connected**: each plugin owns its types, state, and UI, but communicates through well-defined seams (`PluginAPI`, `WIDGET_REGISTRY`, MCP tool registration).

## PluginDescriptor Contract

Every plugin exports a `PluginDescriptor` — the single object that defines everything about the plugin:

```typescript
interface PluginDescriptor {
  id: string;                // Unique kebab-case ID, e.g. "tasks"
  name: string;              // Display name
  description: string;       // Shown in launcher and MCP descriptions
  icon: ComponentType;       // Lucide icon component
  version: string;           // Semver string

  launchSurfaces: Array<"palette" | "topbar" | "dock">;
  presentation: "fullscreen" | "side-panel" | "modal" | "mini-hud";
  presentationSize?: "sm" | "md" | "lg";

  component: ComponentType<PluginRenderProps>;     // Main UI
  widgets?: PluginWidgetContribution[];            // Grid widgets
  mcpTools?: McpToolDefinition[];                  // AI tools
  requiredIntegrations?: (keyof PlatformIntegrations)[];
}
```

### Launch Surfaces

- **palette** — appears in the command palette (`Cmd+Shift+P`)
- **topbar** — adds a button to the top bar actions row
- **dock** — adds an icon to the left-edge vertical dock

### Presentation Modes

- **fullscreen** — takes over the entire viewport (e.g. Tasks)
- **side-panel** — slides in from the right with configurable width (e.g. Expenses)
- **modal** — centered dialog overlay
- **mini-hud** — small floating panel

## PluginAPI

Every plugin receives a `PluginAPI` instance via props. This is the plugin's interface to the host application:

```typescript
interface PluginAPI {
  widgets: { getState: (widgetId: string) => unknown };
  db: {
    get: <T>(key: string) => Promise<T | null>;
    set: <T>(key: string, value: T) => Promise<void>;
    delete: (key: string) => Promise<void>;
    list: <T>(prefix: string) => Promise<T[]>;
  };
  hotkeys: { register: (key: string, handler: () => void) => () => void };
  notify: (message: string, type?: "info" | "success" | "error") => void;
  close: () => void;
}
```

### Database

Plugin data is stored in a key-value table (`plugin_data`) with composite keys scoped by plugin ID. The `PluginHost` automatically namespaces all `db` calls so plugins cannot access each other's data.

Client-side: calls go through `/api/plugins/data` REST endpoints.
Server-side (MCP): calls go directly to the `PluginRepository`.

## Widget Contributions

Plugins can contribute widgets to the dashboard grid:

```typescript
interface PluginWidgetContribution {
  widgetId: string;          // Auto-namespaced as "pluginId__widgetId"
  name: string;
  description: string;
  defaultSlot?: GridSlot;    // Preferred grid position
  component: ComponentType;  // Compact widget for the grid
  expandedComponent?: ComponentType;
  expandedSize?: "sm" | "md" | "lg";
}
```

On mount, `PluginHost` registers these into `WIDGET_REGISTRY` with namespaced IDs. On unmount, they are removed.

## MCP Tools

Plugins can expose tools to LLMs via the MCP protocol:

```typescript
interface McpToolDefinition {
  name: string;              // Auto-namespaced as "pluginId__name"
  description: string;
  parameters: z.ZodType;     // Zod v4 schema for input validation
  execute: (params: unknown, api: PluginAPI) => Promise<unknown>;
}
```

The `@radarboard/mcp-tools` package provides `buildMcpRouter()` which:
1. Collects all tools from `PLUGIN_REGISTRY`
2. Namespaces them (`tasks__create_task`, `expenses__add_expense`)
3. Validates inputs against Zod schemas
4. Routes execution to the correct plugin with its own `PluginAPI` instance

## Registration

Plugins are registered in `packages/plugins/src/init.ts`:

```typescript
import { registerPlugin } from "./registry";
import { tasksDescriptor } from "./plugins/tasks";
import { expensesDescriptor } from "./plugins/expenses";

registerPlugin(tasksDescriptor);
registerPlugin(expensesDescriptor);
```

This file is imported in `apps/app/app/providers.tsx` to ensure plugins are registered before any rendering.

## Creating a New Plugin

1. Create a directory under `packages/plugins/src/plugins/<name>/`
2. Define your types in `types.ts`
3. Build your UI components
4. Create the descriptor in `index.ts` exporting a `PluginDescriptor`
5. Add MCP tools in `mcp-tools.ts` (optional)
6. Register in `packages/plugins/src/init.ts`

## Testing

Use `createMockPluginAPI()` from `@radarboard/plugins/testing` for unit tests:

```typescript
import { createMockPluginAPI } from "@radarboard/plugins/testing";

const api = createMockPluginAPI();
// api.db is backed by an in-memory Map
// api.notify is a no-op
// api.close is a no-op
```

Run plugin tests: `pnpm --filter @radarboard/plugins test`
Run MCP router tests: `pnpm --filter @radarboard/mcp-tools test`

## Built-in Plugins

### Tasks
- **ID**: `tasks`
- **Presentation**: fullscreen
- **Surfaces**: palette, topbar, dock
- **Widget**: "Today" summary at grid slot 8
- **MCP Tools**: create_task, list_tasks, complete_task, update_task, delete_task, start_pomodoro, get_pomodoro_status

### Expenses
- **ID**: `expenses`
- **Presentation**: side-panel (lg)
- **Surfaces**: palette, topbar
- **Widget**: Monthly overview at grid slot 9
- **MCP Tools**: list_services, add_expense, update_expense, delete_expense, get_monthly_summary, get_upcoming_renewals
