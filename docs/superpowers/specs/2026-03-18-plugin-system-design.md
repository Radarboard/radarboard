# Plugin System Design

**Date:** 2026-03-18  
**Status:** Draft  
**Scope:** First-party plugins (hybrid — designed to open up as a runtime later)

---

## Overview

Radarboard gains a first-class **Plugin system** — a set of built-in, opt-in feature modules that extend the dashboard beyond data display. Plugins can:

- Open a full UI overlay (fullscreen, side panel, modal, or mini-HUD)
- Contribute widget components into the dashboard grid
- Persist their own data in a namespaced DB store
- Expose MCP tools to the in-app AI chat and to external LLMs via `/api/mcp`
- Be launched from a command palette, the TopBar, or a persistent plugin dock

The architecture is designed so the internal `PluginDescriptor` contract becomes the public API if/when the system is opened up to third-party plugins.

---

## Architecture

### Package Structure

```
packages/plugins/
  src/
    types.ts                    ← PluginDescriptor, PluginAPI, PluginWidgetContribution, McpToolDefinition
    registry.ts                 ← PLUGIN_REGISTRY Map
    host.tsx                    ← PluginHost context provider (wraps the whole app)
    use-plugin-api.ts           ← usePluginAPI() hook
    plugins/
      tasks/
        index.ts                ← PluginDescriptor
        components/             ← Full overlay UI (task list, pomodoro, etc.)
        widget.tsx              ← Grid widget contribution ("tasks__today")
        mcp-tools.ts            ← MCP tool definitions
      expenses/
        index.ts                ← PluginDescriptor
        components/             ← Full overlay UI (expense list, service costs, etc.)
        widget.tsx              ← Grid widget contribution ("expenses__overview")
        mcp-tools.ts            ← MCP tool definitions

packages/mcp-tools/
  src/
    index.ts                    ← buildMcpRouter() — aggregates plugin MCP tools
    auth.ts                     ← Bearer token auth for external LLM access
    types.ts                    ← McpToolDefinition, McpRequest, McpResponse

apps/app/
  app/
    api/
      mcp/
        route.ts                ← HTTP MCP endpoint — consumes packages/mcp-tools
  components/
    plugin-host.tsx             ← Wraps providers.tsx, initializes plugin runtime
    plugin-launcher.tsx         ← Command palette (Cmd+Shift+P)
    plugin-dock.tsx             ← Optional persistent icon strip (left/right edge)
    plugin-overlay.tsx          ← Renders active plugin UI (driven by ?plugin= URL param)
```

---

## Core Types

### `PluginDescriptor`

The public contract every plugin must satisfy. This becomes the third-party plugin API.

```ts
interface PluginDescriptor {
  id: string;                   // unique, kebab-case, e.g. "tasks"
  name: string;                 // display name
  description: string;          // shown in launcher + MCP tool descriptions
  icon: LucideIcon;
  version: string;              // semver

  // UI surface declarations — plugin appears in all declared surfaces
  launchSurfaces: Array<"palette" | "topbar" | "dock">;

  // How the plugin's main UI is presented when launched
  presentation: "fullscreen" | "side-panel" | "modal" | "mini-hud";
  presentationSize?: "sm" | "md" | "lg";   // for modal/side-panel

  // The plugin's main UI component
  component: ComponentType<PluginRenderProps>;

  // Optional: widget(s) this plugin contributes to the dashboard grid
  widgets?: PluginWidgetContribution[];

  // MCP tools exposed to in-app chat + external LLMs
  mcpTools?: McpToolDefinition[];

  // Optional: plugin requires specific integrations to be configured
  requiredIntegrations?: (keyof PlatformIntegrations)[];
}
```

### `PluginWidgetContribution`

Plugins can optionally contribute one or more widget components into the dashboard grid. They are registered into `WIDGET_REGISTRY` on startup with IDs namespaced as `"<pluginId>__<widgetId>"` (e.g. `"tasks__today"`, `"expenses__overview"`). They appear in the slot picker under a **Plugins** section and are draggable like any regular widget.

```ts
interface PluginWidgetContribution {
  widgetId: string;             // namespaced automatically: "<pluginId>__<widgetId>"
  name: string;
  description: string;
  defaultSlot?: GridSlot;
  component: ComponentType<WidgetRenderProps<unknown>>;
  expandedComponent?: ComponentType<WidgetRenderProps<unknown>>;
  expandedSize?: "sm" | "md" | "lg";
  // Inherits plugin's requiredIntegrations + auth
}
```

### `PluginAPI`

Injected into every plugin via `PluginRenderProps`. This is what gives plugins power beyond pure UI.

```ts
interface PluginAPI {
  // Read widget data (same SWR cache as the grid)
  widgets: {
    getState: (widgetId: string) => unknown;
  };

  // Plugin-namespaced DB access (key-value, scoped to this plugin's ID)
  db: {
    get: <T>(key: string) => Promise<T | null>;
    set: <T>(key: string, value: T) => Promise<void>;
    delete: (key: string) => Promise<void>;
    list: <T>(prefix: string) => Promise<T[]>;
  };

  // Register hotkeys scoped to this plugin (auto-cleaned up on unmount)
  hotkeys: {
    register: (key: string, handler: () => void) => () => void;
  };

  // Fire a toast notification
  notify: (message: string, type?: "info" | "success" | "error") => void;

  // Close the plugin overlay
  close: () => void;
}

interface PluginRenderProps {
  api: PluginAPI;
}
```

### `McpToolDefinition`

```ts
interface McpToolDefinition {
  name: string;                 // namespaced automatically: "<pluginId>__<name>"
  description: string;          // shown to LLMs — must be clear and accurate
  parameters: ZodSchema;        // validated input
  execute: (params: unknown, api: PluginAPI) => Promise<unknown>;
}
```

---

## Plugin Runtime (PluginHost)

`PluginHost` is a React context provider inserted into `apps/app/app/providers.tsx`. On mount it:

1. Reads `PLUGIN_REGISTRY`
2. For each plugin, registers its `widgets` contributions into `WIDGET_REGISTRY` with namespaced IDs
3. Provides the `PluginAPI` implementation via React context
4. Sets up the command palette entry and TopBar/dock icon for each plugin based on `launchSurfaces`

Active plugin overlay state is tracked in the URL via `nuqs`: `?plugin=<pluginId>`. This means deep-linking to a plugin works, and back/forward navigation closes/opens it correctly.

---

## Plugin Launch Surfaces

### Command Palette (`Cmd+Shift+P`)

A `PluginLauncher` component renders a command-palette style modal listing all registered plugins with name, description, and icon. Fuzzy-searchable. All plugins appear here regardless of their `launchSurfaces` declaration.

### TopBar

Plugins declaring `"topbar"` in `launchSurfaces` get an icon button appended to the right section of `top-bar.tsx`, next to the existing chat and settings buttons.

### Plugin Dock

Plugins declaring `"dock"` in `launchSurfaces` contribute to a `PluginDock` component — a slim vertical icon strip on the left or right edge of the dashboard. The dock is hidden if no plugins declare it, so the default layout is unaffected.

---

## MCP Integration

### In-app

The in-app AI chat (Vercel AI SDK) is extended to automatically include all plugin MCP tools alongside the existing user-registered MCP servers. No user configuration needed — tools are available as soon as a plugin is registered.

### External LLMs

`packages/mcp-tools` exports a `buildMcpRouter()` function that aggregates all plugin tool definitions from `PLUGIN_REGISTRY`. `apps/app/app/api/mcp/route.ts` calls it and exposes a standard MCP-compatible HTTP endpoint.

External LLMs (Claude, ChatGPT, Cursor, etc.) connect to `/api/mcp` with a bearer token. They see all plugin tools, namespaced by plugin ID:

```
tasks__create_task
tasks__list_tasks
tasks__complete_task
tasks__start_pomodoro
expenses__list_services
expenses__get_monthly_summary
expenses__add_expense
```

Auth uses the existing credential system — a user-generated API token stored in settings.

### Future: Standalone MCP Server

`packages/mcp-tools` is intentionally decoupled from Next.js. When needed, it can be extracted into a standalone `apps/mcp-server` (e.g. a lightweight Node.js HTTP server) and deployed independently from the web app.

---

## Database Changes

### New `plugin_data` table

All four DB adapters (SQLite, Supabase, Turso, PlanetScale) get a new `PluginRepository` implementation:

```sql
CREATE TABLE plugin_data (
  plugin_id   TEXT    NOT NULL,
  key         TEXT    NOT NULL,
  value       TEXT    NOT NULL,
  updated_at  INTEGER NOT NULL,
  PRIMARY KEY (plugin_id, key)
);
```

### `DatabaseAdapter` extension

```ts
interface DatabaseAdapter {
  // ... existing repositories ...
  plugins: PluginRepository;
}

interface PluginRepository {
  get(pluginId: string, key: string): Promise<string | null>;
  set(pluginId: string, key: string, value: string): Promise<void>;
  delete(pluginId: string, key: string): Promise<void>;
  list(pluginId: string, prefix: string): Promise<{ key: string; value: string }[]>;
}
```

---

## First-Party Plugins

### Tasks Plugin (`id: "tasks"`)

A full task management system deeply integrated with the dashboard.

**Launch surfaces:** `palette`, `topbar`, `dock`  
**Presentation:** `fullscreen`

**Features:**
- Task list with title, description, priority, due date, status (todo / in-progress / done)
- Project grouping (optionally linked to Radarboard projects)
- Pomodoro timer — 25/5/15 cycle, visible in mini-HUD when running, optional widget
- Filter by project, priority, due date, status
- Keyboard-first: `n` new task, `Space` complete, `e` edit, `/` filter

**Widget contribution:** `tasks__today`
- Shows today's tasks + current Pomodoro state
- Compact: task count by status + active Pomodoro timer
- Expanded: full today's task list with checkboxes + Pomodoro controls

**MCP tools:**
- `tasks__create_task` — create a task (title, description?, priority?, due_date?, project_id?)
- `tasks__list_tasks` — list tasks with optional filters (status, project, priority, due_date)
- `tasks__complete_task` — mark a task as done by ID
- `tasks__update_task` — update task fields by ID
- `tasks__delete_task` — delete a task by ID
- `tasks__start_pomodoro` — start a Pomodoro timer for a task
- `tasks__get_pomodoro_status` — get current Pomodoro state

**DB schema (stored as JSON values in plugin_data):**
- `tasks:list` → `Task[]`
- `tasks:pomodoro:current` → `PomodoroSession | null`
- `tasks:settings` → `{ workMinutes, shortBreakMinutes, longBreakMinutes }`

---

### Expenses Plugin (`id: "expenses"`)

A service cost tracker that aggregates what Radarboard already knows (from integrations) and lets users add manual entries.

**Launch surfaces:** `palette`, `topbar`  
**Presentation:** `side-panel`, size `lg`

**Features:**
- Auto-populated services list from existing integrations (Vercel, GitHub, Sentry, BetterStack, etc.) — reads service names from the credential store, user adds cost manually
- Manual service entries: name, cost, billing cycle (monthly / annual / one-time), category, renewal date
- Monthly / annual summary with breakdown by category
- Currency respects the dashboard's active `DisplayCurrency`
- Renewal alerts: services renewing within 7 days surface in the TopBar

**Widget contribution:** `expenses__overview`
- Compact: total monthly spend + count of services
- Expanded: full breakdown by category with bar chart, upcoming renewals list

**MCP tools:**
- `expenses__list_services` — list all tracked services with cost and billing info
- `expenses__add_expense` — add a manual service expense
- `expenses__update_expense` — update cost/billing info for a service
- `expenses__delete_expense` — remove a service
- `expenses__get_monthly_summary` — total monthly spend, breakdown by category
- `expenses__get_upcoming_renewals` — services renewing in the next N days

**DB schema:**
- `expenses:list` → `ExpenseEntry[]`
- `expenses:settings` → `{ currency, alertDaysAhead }`

---

## Implementation Todos

### Phase 1 — Foundation

- [ ] Create `packages/plugins` package with `tsconfig.json`, `package.json`, `src/types.ts`, `src/registry.ts`
- [ ] Define `PluginDescriptor`, `PluginAPI`, `PluginRenderProps`, `PluginWidgetContribution`, `McpToolDefinition` types in `packages/plugins/src/types.ts`
- [ ] Create `packages/plugins/src/registry.ts` — `PLUGIN_REGISTRY` Map
- [ ] Create `packages/plugins/src/use-plugin-api.ts` — `usePluginAPI()` hook backed by React context
- [ ] Create `packages/plugins/src/host.tsx` — `PluginHost` context provider
  - [ ] On mount: register plugin widget contributions into `WIDGET_REGISTRY` with namespaced IDs
  - [ ] Provide `PluginAPI` implementation via context
- [ ] Add `PluginRepository` interface to `packages/types/src/database.ts`
- [ ] Add `plugin_data` table migration to SQLite adapter (`apps/app/db/sqlite/`)
- [ ] Add `plugin_data` table migration to Supabase adapter
- [ ] Add `plugin_data` table migration to Turso adapter
- [ ] Add `plugin_data` table migration to PlanetScale adapter
- [ ] Implement `PluginRepository` in all four DB adapters
- [ ] Wire `PluginHost` into `apps/app/app/providers.tsx`
- [ ] Add `?plugin=<pluginId>` URL param via `nuqs` to `apps/app/app/page.tsx`

### Phase 2 — Plugin UI Surfaces

- [ ] Create `apps/app/components/plugin-overlay.tsx` — renders active plugin component based on `?plugin=` param, respects `presentation` + `presentationSize`
- [ ] Create `apps/app/components/plugin-launcher.tsx` — command palette (`Cmd+Shift+P`), lists all plugins, fuzzy search
- [ ] Update `apps/app/components/hotkeys-provider.tsx` (or equivalent) to register `Cmd+Shift+P` → open plugin launcher
- [ ] Update `packages/widgets/src/chrome/top-bar/index.tsx` — render icon buttons for plugins declaring `"topbar"` in `launchSurfaces`
- [ ] Create `apps/app/components/plugin-dock.tsx` — vertical icon strip, rendered only when at least one plugin declares `"dock"`
- [ ] Wire `plugin-overlay.tsx` and `plugin-dock.tsx` into `apps/app/components/dashboard.tsx`
- [ ] Add **Plugins** section to widget slot picker (filters `WIDGET_REGISTRY` for `tasks__*`, `expenses__*` prefixed entries)

### Phase 3 — MCP Integration

- [ ] Create `packages/mcp-tools` package with `tsconfig.json`, `package.json`
- [ ] Define `McpToolDefinition`, `McpRequest`, `McpResponse` types in `packages/mcp-tools/src/types.ts`
- [ ] Implement `buildMcpRouter()` in `packages/mcp-tools/src/index.ts` — takes `PLUGIN_REGISTRY`, returns MCP-compatible request handler
- [ ] Implement bearer token auth in `packages/mcp-tools/src/auth.ts`
- [ ] Create `apps/app/app/api/mcp/route.ts` — POST handler calling `buildMcpRouter()`
- [ ] Add MCP API token management to Settings → Integrations (generate / revoke token)
- [ ] Extend in-app AI chat (Vercel AI SDK tool list) to include plugin MCP tools automatically

### Phase 4 — Tasks Plugin

- [ ] Create `packages/plugins/src/plugins/tasks/` directory
- [ ] Define `Task`, `PomodoroSession`, `TasksSettings` types
- [ ] Implement `tasks` `PluginDescriptor` in `packages/plugins/src/plugins/tasks/index.ts`
- [ ] Build task list UI component (`components/task-list.tsx`)
- [ ] Build task creation/edit form (`components/task-form.tsx`)
- [ ] Build Pomodoro timer component (`components/pomodoro.tsx`)
  - [ ] 25/5/15 cycle logic
  - [ ] Visible mini-HUD mode when timer is running (floating badge over dashboard)
  - [ ] Persist state to `plugin_data` via `PluginAPI.db`
- [ ] Build filter/sort bar (`components/task-filters.tsx`)
- [ ] Build main overlay component (`components/tasks-overlay.tsx`) — composes all above
- [ ] Implement keyboard shortcuts (`n`, `Space`, `e`, `/`) scoped via `PluginAPI.hotkeys`
- [ ] Build `tasks__today` widget — compact view (task counts + Pomodoro state)
- [ ] Build `tasks__today` widget — expanded view (full today list + Pomodoro controls)
- [ ] Implement all 7 MCP tools in `packages/plugins/src/plugins/tasks/mcp-tools.ts`
- [ ] Register `tasks` plugin in `PLUGIN_REGISTRY`

### Phase 5 — Expenses Plugin

- [ ] Create `packages/plugins/src/plugins/expenses/` directory
- [ ] Define `ExpenseEntry`, `BillingCycle`, `ExpensesSettings` types
- [ ] Implement `expenses` `PluginDescriptor` in `packages/plugins/src/plugins/expenses/index.ts`
- [ ] Build service list UI (`components/service-list.tsx`) — auto-populated from credential store + manual entries
- [ ] Build add/edit expense form (`components/expense-form.tsx`)
- [ ] Build monthly summary view with category breakdown and bar chart (`components/expenses-summary.tsx`)
- [ ] Build upcoming renewals list (`components/upcoming-renewals.tsx`)
- [ ] Build renewal alert in TopBar (badge/tooltip for services renewing within 7 days)
- [ ] Build main overlay component (`components/expenses-overlay.tsx`)
- [ ] Build `expenses__overview` widget — compact view (total monthly spend + service count)
- [ ] Build `expenses__overview` widget — expanded view (category breakdown + renewals)
- [ ] Implement all 6 MCP tools in `packages/plugins/src/plugins/expenses/mcp-tools.ts`
- [ ] Register `expenses` plugin in `PLUGIN_REGISTRY`

### Phase 6 — Polish & Future-Proofing

- [ ] Add plugin section to Settings modal — enable/disable installed plugins, manage plugin-specific settings
- [ ] Write unit tests for `PluginHost` registration logic (widget namespacing, registry merging)
- [ ] Write unit tests for `buildMcpRouter()` (tool namespacing, auth, routing)
- [ ] Write unit tests for Tasks plugin MCP tools
- [ ] Write unit tests for Expenses plugin MCP tools
- [ ] Document the `PluginDescriptor` contract in `docs/` as the future third-party plugin API
- [ ] Add `packages/plugins` and `packages/mcp-tools` to Turborepo pipeline in `turbo.json`
- [ ] Export `PluginDescriptor`, `PluginAPI`, `McpToolDefinition` from a public entry point (`packages/plugins/index.ts`) ready for external consumption

---

## Open Questions

- **Plugin settings UI:** Should each plugin declare a settings component rendered inside the Settings modal (under a "Plugins" section), or should plugins manage their own settings inside their overlay UI?
- **MCP token scope:** Should the MCP API token give access to all plugin tools, or should users be able to scope tokens per plugin?
- **Pomodoro notifications:** Browser notifications (`Notification` API) for Pomodoro timer completion — needs permission handling.
- **Expense auto-detection:** Can we read actual billing amounts from any existing integrations (e.g. Vercel usage API) or is everything manual?

---

## Non-Goals (v1)

- Third-party / user-installed plugins (runtime plugin loading, sandboxing, plugin marketplace)
- Plugin-to-plugin communication
- Plugin versioning / migration system
- Remote/cloud plugin data sync (plugins use the same DB as the rest of the app)
