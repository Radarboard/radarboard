---
name: create-plugin
description: "Create or update a Radarboard plugin. Provider-specific or optional workflow plugins should default to the community-extensions repo; core plugins are explicit platform/product exceptions. Use this when the user asks to add, build, scaffold, wire, or fix a Radarboard plugin package, overlay, plugin-scoped data model, plugin MCP tools, settings, intents, RPC services, deep-linkable item views, query-param-sync behavior, or plugin-contributed widgets."
---

# Create Plugin

End-to-end guide for adding a plugin. Optional/provider-specific plugins belong in `/Users/thedaviddias/Projects/community-extensions` by default. Only put a plugin in Radarboard core when it is part of the provider-neutral product baseline.

## Gather Inputs

Collect these before editing:

- Plugin name in kebab-case
- Category: `productivity`, `monitoring`, or `data`
- Launch surfaces: `palette`, `topbar`, and optionally `dock`
- Presentation mode: `side-panel`, `fullscreen`, `modal`, or `mini-hud`
- Whether the plugin is mostly local DB state, external data, or both
- Whether it also needs `mcpTools`, `settings`, `widgets`, `intents`, `services`, or `shortcut`

If the plugin exposes item detail views or shareable selection state, plan query-param sync from the beginning.

## Step 1: Scaffold

For community plugins, run from `/Users/thedaviddias/Projects/community-extensions`:

```bash
pnpm create-extension <name> --plugin
```

This creates `plugins/<name>/` in the community catalog. It does not update core `radarboard.config.ts`.

For the rare core plugin, run from Radarboard core:

```bash
pnpm create-plugin <name>
```

That creates `plugins/<name>/`, updates `radarboard.config.ts`, runs `pnpm generate:extensions`, and links the new workspace with `pnpm install`.

The scaffolded package includes:

```
plugins/<name>/
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── src/
    ├── index.ts
    ├── types.ts
    ├── mcp-tools.ts
    ├── mcp-tools.test.ts
    ├── conformance.test.ts
    └── components/
        └── <name>-overlay.tsx
```

The generated overlay is a working CRUD starter. Replace placeholders and simplify or expand it based on the real workflow.

## Step 2: Build the Overlay

Use `PluginRenderProps` from `@radarboard/plugin-sdk/types`:

```tsx
"use client";

import { PluginEmptyState } from "@radarboard/plugin-sdk/components/plugin-empty";
import { createCrudHelper } from "@radarboard/plugin-sdk/crud-helpers";
import type { PluginRenderProps } from "@radarboard/plugin-sdk/types";
import { useMemo, useState } from "react";
import type { MeetingNote } from "../types";

export function MeetingNotesOverlay({ api }: PluginRenderProps) {
  const [items, setItems] = useState<MeetingNote[]>([]);
  const crud = useMemo(() => createCrudHelper<MeetingNote>(api, "note"), [api]);

  async function addNote() {
    const note = await crud.create({
      title: "Untitled note",
      body: "",
    });
    setItems((prev) => [note, ...prev]);
    api.notify(`Created ${note.title}`, "success");
  }

  if (items.length === 0) {
    return (
      <PluginEmptyState
        title="Meeting Notes"
        description="No notes yet."
        action={{ label: "Create note", onClick: addNote }}
      />
    );
  }

  return <div className="flex h-full flex-col">...</div>;
}
```

Use:

- `createCrudHelper` for straightforward local collections
- `api.db` directly when the storage model is not CRUD-shaped
- `@radarboard/plugin-sdk/components/*` for list panes, detail shells, filters, and workspaces instead of inventing new layout primitives

If the plugin supports deep links into a selected item, keep URL query params and selection synchronized with `@radarboard/plugin-sdk/use-plugin-search-param`.

If you discover reusable behavior like delayed mark-read, autosave, or list/detail coordination, move it into a shared hook or SDK helper instead of duplicating it inside one overlay.

UI rules:

- Use semantic tokens only. No raw hex values and no Tailwind arbitrary values.
- Prevent horizontal overflow.
- Add `scrollbar-thin` to scrollable regions.
- Stay within current Radarboard UI patterns instead of inventing a separate design system.

## Step 3: Define Types and Storage

Put the plugin's domain types in `src/types.ts`:

```typescript
export interface MeetingNote {
  id: string;
  title: string;
  body: string;
  createdAt: number;
  updatedAt: number;
}
```

Rules:

- Keep persisted entities explicit and typed.
- Use stable key prefixes such as `note:` or `feed:` for plugin DB records.
- Treat `_config:` keys as settings storage, not general app data.

## Step 4: Configure the Descriptor

Edit `src/index.ts` using the current `PluginDescriptor` contract:

```typescript
import type { PluginDescriptor } from "@radarboard/plugin-sdk/types";
import { NotebookPen } from "lucide-react";
import { meetingNotesMcpTools } from "./mcp-tools";
import { MeetingNotesOverlay } from "./components/meeting-notes-overlay";

export const meetingNotesDescriptor: PluginDescriptor = {
  id: "meeting-notes",
  name: "Meeting Notes",
  description: "Capture, search, and organize meeting notes.",
  icon: NotebookPen,
  category: "productivity",
  version: "0.1.0",
  launchSurfaces: ["palette", "topbar"],
  presentation: { default: "side-panel", alternates: ["fullscreen"], size: "md" },
  shortcut: "Mod+Shift+M",
  component: MeetingNotesOverlay,
  mcpTools: meetingNotesMcpTools,
  settings: [
    {
      key: "defaultView",
      label: "Default View",
      type: "select",
      defaultValue: "recent",
      options: [
        { label: "Recent", value: "recent" },
        { label: "Folders", value: "folders" },
      ],
    },
  ],
  permissions: ["db", "hotkeys", "notify"],
};
```

Add only the fields the plugin actually needs:

- `requiredIntegrations` when it depends on connected services
- `dataSources` when users can connect plugin data through OAuth, API keys, or MCP
- `radarboardIntegrations` for notifications or ticker contributions
- `widgets` when the plugin contributes dashboard cards
- `intents` and `services` for cross-plugin workflows
- `lifecycle` and `dependencies` when init ordering matters
- `permissions` when you want the PluginAPI surface to be explicit

Do not leave generic placeholder metadata in the final descriptor.

## Step 5: Optional MCP Tools, Intents, Services, and Widgets

### MCP tools

Use `src/mcp-tools.ts` when the assistant should query or mutate plugin data:

```typescript
import { z } from "zod";
import type { McpToolDefinition } from "@radarboard/plugin-sdk/types";

export const meetingNotesMcpTools: McpToolDefinition[] = [
  {
    name: "list-notes",
    description: "List notes from the Meeting Notes plugin",
    parameters: z.object({
      limit: z.number().int().positive().optional(),
    }),
    execute: async (params, api) => {
      const items = await api.db.list("note:");
      return { items: items.slice(0, (params as { limit?: number }).limit ?? 100) };
    },
  },
];
```

### Intents and services

Use `intents` when other plugins or the assistant should send data into this plugin. Use `services` when other plugins should call typed RPC methods exposed by this plugin.

### Widget contributions

If the plugin contributes dashboard widgets, add a dedicated file such as `src/widget-contribution.tsx` and wire it into the descriptor's `widgets` array. Keep the widget configuration self-contained instead of bloating `src/index.ts`.

## Step 6: Verify

```bash
pnpm check:extensions --filter=plugin --extension <name>
pnpm --filter @radarboard/plugin-<name> test
pnpm validate --extension <name>
```

For core-only plugins, use `pnpm typecheck` instead of `pnpm validate --extension <name>`.

If the plugin adds deep-link behavior or overlay navigation, run or update the relevant existing tests rather than assuming the shared host code will cover it.

## References

- Local CRUD patterns: `plugins/bookmarks/`, `plugins/backup/`
- Large multi-pane plugins: `plugins/notes/`, `plugins/tasks/`
- Widget-contributing plugins: `plugins/rss-reader/`, `plugins/status-page/`, `plugins/expenses/`
- Cross-plugin behavior and intents: `apps/docs/developer-guide/intent-bus-cookbook.mdx`
