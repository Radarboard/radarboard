# __PLUGIN_NAME__

> Scaffolded with `pnpm create-plugin __PLUGIN_KEBAB__`

## Quick Start

1. **Build the overlay** — Edit `src/components/__PLUGIN_KEBAB__-overlay.tsx` with your UI
2. **Add data types** — Define your domain types in `src/types.ts`
3. **Add MCP tools** — Wire AI assistant actions in `src/mcp-tools.ts` (optional)
4. **Test** — Run `pnpm --filter @radarboard/plugin-__PLUGIN_KEBAB__ test`

## Structure

```
src/
├── index.ts              # PluginDescriptor — metadata, presentation, launch surfaces
├── types.ts              # Plugin-specific TypeScript types
├── components/
│   └── __PLUGIN_KEBAB__-overlay.tsx  # Main UI component
├── mcp-tools.ts          # MCP tools for AI assistant integration (optional)
└── conformance.test.ts   # Validates descriptor against SDK rules
```

## PluginAPI

Your overlay component receives `api: PluginAPI` with these capabilities:

| API | Description |
|-----|-------------|
| `api.db.get/set/delete/list` | Key-value storage scoped to this plugin |
| `api.notify(msg, type?)` | Toast notifications (`"info"`, `"success"`, `"error"`) |
| `api.hotkeys.register(key, fn)` | Scoped keyboard shortcuts (auto-cleanup) |
| `api.close()` | Close the plugin overlay |
| `api.events.emit/on` | Notification event bus |
| `api.intents.sendTo/resolveTargets` | Cross-plugin communication |
| `api.rpc.call/listServices` | Call services on other plugins |
| `api.projects.list()` | Read the project list |

## Presentation Modes

Set in the descriptor's `presentation` field:

- **`side-panel`** — Slides in from the right (default)
- **`fullscreen`** — Takes over the viewport
- **`modal`** — Centered dialog
- **`mini-hud`** — Small overlay widget

## Key Files to Reference

- **SDK types**: `@radarboard/plugin-sdk/types` — `PluginDescriptor`, `PluginAPI`
- **Testing**: `@radarboard/plugin-sdk/testing` — `createMockPluginAPI()`, `createTestPluginHost()`
- **UI components**: `@radarboard/plugin-sdk/components/*` — shared plugin UI primitives
- **Real examples**: `plugins/tasks/`, `plugins/notes/`, `plugins/bookmarks/`
- **Extension guide**: `CONTRIBUTING-EXTENSIONS.md`

## Module Boundaries

Plugins can only import from:
- `@radarboard/plugin-sdk`
- `@radarboard/types`
- `@radarboard/utils`
- `@radarboard/ui`
- `@radarboard/widget-engine`
- `@radarboard/embedding-service`
- `@radarboard/llm`
