# Settings Modal with Project Reordering

**Date:** 2026-03-16
**Status:** Draft

## Overview

Add a settings modal to the dashboard with a fixed left sidebar and three sections: Projects, Appearance, and Integrations. The first section (Projects) allows users to reorder the project tabs via drag-and-drop with an arrow-button fallback for keyboard accessibility. Settings are persisted to Turso (distributed SQLite) for cross-device sync.

## Decisions

- **Layout**: Fixed sidebar modal (Option A) -- scales to many sections, always-visible navigation
- **Sections**: Projects (implemented now), Appearance (placeholder), Integrations (placeholder)
- **Reorder mechanism**: `@dnd-kit` drag-and-drop with up/down arrow buttons as accessible fallback
- **Persistence**: Turso via `@libsql/client` + Drizzle ORM
- **Project visibility**: Reorder only, no hide/show toggle

## Changes

### 1. New Dependencies

**`apps/app/package.json`**:
- `@dnd-kit/core` -- drag-and-drop engine
- `@dnd-kit/sortable` -- sortable preset for dnd-kit
- `@dnd-kit/utilities` -- CSS utilities for transforms
- `@libsql/client` -- Turso database client
- `drizzle-orm` -- lightweight TypeScript ORM

**`apps/app/package.json` (devDependencies)**:
- `drizzle-kit` -- schema migrations and introspection

Note: `@radix-ui/react-dialog` and `packages/ui/src/dialog/index.tsx` already exist. No new UI package dependencies needed.

### 2. Dialog Component (`packages/ui/src/dialog/index.tsx`) -- Existing, No Changes

The dialog component already exists with `DialogOverlay`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogBody`, `DialogFooter`, `DialogClose`, `DetailRow`, and `DetailLink`. The existing `DialogContent` defaults to `max-w-[500px]` but accepts a `className` prop for overrides. The settings modal will pass `className="max-w-[700px] h-[500px]"` to override the default width and set a fixed height.

The existing close button is embedded inside `DialogContent` (absolute-positioned top-right). The settings modal's `DialogHeader` will not add a redundant close button -- it only renders the title.

### 3. Settings Modal Component (`apps/app/components/settings-modal.tsx`)

Top-level modal component. Structure:

```
DialogContent (className="max-w-[700px] h-[500px]", overrides default max-w)
├── DialogHeader ("Settings" title, no extra close button -- DialogContent provides one)
└── div (flex, two-column, flex-1, overflow-hidden)
    ├── SettingsSidebar (w-[180px], left, border-r border-[#222])
    └── SettingsContent (flex-1, right, overflow-y-auto)
```

State: `activeSection: "projects" | "appearance" | "integrations"` (default `"projects"`).

Renders the appropriate content panel based on `activeSection`.

### 4. Settings Sidebar (`apps/app/components/settings-sidebar.tsx`)

Vertical nav list with three items:
- Projects
- Appearance
- Integrations

Styling: `text-[11px] font-mono uppercase tracking-wider` to match dashboard aesthetic. Active item gets `border-l-2 border-accent text-foreground`, inactive items get `text-muted-foreground`.

Each item is a `<button>` that calls `onSectionChange(section)`.

### 5. Projects Settings Panel (`apps/app/components/settings-projects.tsx`)

A sortable list of all projects using `@dnd-kit/sortable`.

Each row renders:
- Drag handle (grip/hamburger icon, `GripVertical` from lucide-react)
- Project color dot (8px circle with the project's `color`)
- Project name (`text-[11px] font-mono uppercase`)
- Up arrow button (disabled on first item, `aria-label="Move up"`)
- Down arrow button (disabled on last item, `aria-label="Move down"`)

The sortable list container gets `role="listbox"` and `aria-label="Project order"`. Each sortable row gets `role="option"` and `aria-roledescription="sortable item"`.

**DnD setup**:
- `DndContext` with `closestCenter` collision detection and `KeyboardSensor` + `PointerSensor`
- `SortableContext` with `verticalListSortingStrategy`
- Each row wrapped in a `useSortable` hook
- `onDragEnd` handler reorders the array and calls `updateProjectOrder`

**Arrow buttons**:
- `onMoveUp(index)` swaps item at `index` with `index - 1`
- `onMoveDown(index)` swaps item at `index` with `index + 1`
- Both call `updateProjectOrder` after swapping

**Debouncing**: `updateProjectOrder` is debounced (300ms) so rapid arrow-button clicks or multiple drag operations batch into a single API call.

### 6. Appearance Settings Panel (`apps/app/components/settings-appearance.tsx`)

Placeholder for now. Renders a centered "Coming soon" message in muted text.

### 7. Integrations Settings Panel (`apps/app/components/settings-integrations.tsx`)

Placeholder for now. Renders a centered "Coming soon" message in muted text.

### 8. Turso Database Schema

**New directory**: `apps/app/db/`

**Schema file** (`apps/app/db/schema.ts`):

```typescript
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const userSettings = sqliteTable("user_settings", {
  id: text("id").primaryKey(), // "default" for single-user (will become auth user ID when auth is added)
  projectOrder: text("project_order"), // JSON: string[] of project slugs
  updatedAt: integer("updated_at"), // Unix timestamp in seconds
});
```

**Client file** (`apps/app/db/client.ts`):

```typescript
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });
```

**Drizzle config** (`apps/app/drizzle.config.ts`):

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "turso",
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
});
```

### 9. Settings API Route (`apps/app/app/api/settings/route.ts`)

**GET `/api/settings`**:
- Reads the `"default"` row from `user_settings`
- Returns `{ projectOrder: string[] }` (parsed from JSON)
- If no row exists, returns `{ projectOrder: [] }` (meaning use config order)
- On database error, returns `500 { error: "Failed to load settings" }`

**POST `/api/settings`**:
- Parses request body as JSON
- **Validation**: body must have `projectOrder` as a non-empty array of strings. Rejects with `400 { error: "Invalid project order" }` if:
  - `projectOrder` is missing or not an array
  - Any element is not a string
  - Array is empty
- Upserts the `"default"` row with the new order and current timestamp (seconds)
- Returns `{ success: true }`
- On database error, returns `500 { error: "Failed to save settings" }`

Note: The API does not validate that slugs match known projects. Unknown slugs are harmlessly ignored during the merge step in the dashboard hook. This avoids coupling the API to the config.

### 10. Settings Hook (`apps/app/hooks/use-settings.ts`)

Placed in `apps/app/hooks/` (not `packages/hooks/`) because it calls the app-specific `/api/settings` route.

```typescript
function useSettings() {
  // State: projectOrder (string[]), isLoading (boolean)
  // Fetches GET /api/settings on mount
  // Returns: { projectOrder, updateProjectOrder, isLoading }
  //
  // updateProjectOrder(newOrder: string[]):
  //   1. Immediately updates local state (optimistic)
  //   2. Debounced (300ms): POSTs to /api/settings
  //   3. On POST failure: reverts local state to previous value, logs error to console
  //      (no toast system exists yet -- console.error is sufficient for now)
}
```

### 11. Dashboard Integration

**`packages/hooks/src/use-dashboard.tsx`**:
- Accept `projectOrder: string[]` and `updateProjectOrder` as props on `DashboardProvider` (injected from above, not fetched internally -- keeps the shared hook decoupled from app-specific API)
- New computed value: `orderedProjects` -- merges `projectOrder` with `projects` from config:
  1. Start with projects whose slugs appear in `projectOrder`, in that order
  2. Append any projects from config that are NOT in `projectOrder` (handles newly added projects)
- Expose `orderedProjects` and `updateProjectOrder` in the dashboard context

**`apps/app/app/providers.tsx`**:
- Call `useSettings()` here
- Pass `projectOrder` and `updateProjectOrder` down to `DashboardProvider`

**`apps/app/components/dashboard.tsx`**:
- Use `orderedProjects` from dashboard context instead of `projects` for `ProjectTabs`
- Render `SettingsModal` (controlled by local `open` state)
- Pass `onSettingsClick` to `TopBar`

**`packages/widgets/src/top-bar.tsx`**:
- Add a gear icon button (`Settings` from lucide-react) in the right section next to Save/Reset
- Accepts `onSettingsClick` callback prop
- This is the only trigger for the settings modal (no duplicate button in dashboard.tsx)

### 12. Environment Variables

Add to `.env` (and document in `.env.example`):

```
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-token
```

## File Summary

| File | Action | Package |
|------|--------|---------|
| `packages/ui/src/dialog/index.tsx` | No changes (existing) | `@radarboard/ui` |
| `apps/app/components/settings-modal.tsx` | Create | `@radarboard/app` |
| `apps/app/components/settings-sidebar.tsx` | Create | `@radarboard/app` |
| `apps/app/components/settings-projects.tsx` | Create | `@radarboard/app` |
| `apps/app/components/settings-appearance.tsx` | Create | `@radarboard/app` |
| `apps/app/components/settings-integrations.tsx` | Create | `@radarboard/app` |
| `apps/app/hooks/use-settings.ts` | Create | `@radarboard/app` |
| `apps/app/db/schema.ts` | Create | `@radarboard/app` |
| `apps/app/db/client.ts` | Create | `@radarboard/app` |
| `apps/app/drizzle.config.ts` | Create | `@radarboard/app` |
| `apps/app/app/api/settings/route.ts` | Create | `@radarboard/app` |
| `packages/hooks/src/use-dashboard.tsx` | Edit (add orderedProjects, accept settings props) | `@radarboard/hooks` |
| `apps/app/app/providers.tsx` | Edit (call useSettings, pass to DashboardProvider) | `@radarboard/app` |
| `apps/app/components/dashboard.tsx` | Edit (use orderedProjects, render SettingsModal) | `@radarboard/app` |
| `packages/widgets/src/top-bar.tsx` | Edit (add settings gear button) | `@radarboard/widget-engine` |
| `apps/app/package.json` | Edit (add dnd-kit, libsql, drizzle deps) | `@radarboard/app` |
| `.env.example` | Edit (add Turso vars) | root |

## Out of Scope

- Appearance section content (future work)
- Integrations section content (future work)
- Project hide/show toggling
- User authentication (single-user, `"default"` settings key)
- Migration tooling automation (manual `drizzle-kit push` for now)
- Toast/notification system for error feedback
