# Contributing Extensions

This guide covers how to create and contribute integrations, plugins, and widgets to Radarboard.

## Quick Start

```bash
# Scaffold a new extension
pnpm create-integration <name>   # e.g. pnpm create-integration stripe
pnpm create-plugin <name>        # e.g. pnpm create-plugin calendar
pnpm create-widget <name>        # e.g. pnpm create-widget github-releases

# Verify your extension passes quality checks
pnpm check:extensions

# Run tests
pnpm test
```

Each scaffolding command will:
1. Copy the template into the correct directory
2. Replace placeholder tokens with your extension name
3. Add the entry to `radarboard.config.ts`
4. Regenerate init files (including `transpilePackages`)
5. Run `pnpm install` to link the new workspace package

## Extension Types

| Type | Directory | SDK | Purpose |
|------|-----------|-----|---------|
| **Integration** | `integrations/<name>/` | `@radarboard/integration-sdk` | Connect to external services (GitHub, Vercel, etc.) |
| **Plugin** | `plugins/<name>/` | `@radarboard/plugin-sdk` | Dashboard overlays, tools, and data connections |
| **Widget** | `widgets/<name>/` | `@radarboard/widget-sdk` | Data visualization on the dashboard grid |

## Architecture

Extensions are statically compiled into the Next.js bundle via a declarative config system:

```
radarboard.config.ts          ← source of truth (which extensions are active)
        ↓
pnpm generate:extensions      ← generates init files + transpilePackages
        ↓
apps/app/lib/*-init.ts        ← auto-generated imports & registrations
apps/app/lib/transpile-packages.ts  ← auto-generated Next.js transpile list
        ↓
Next.js build                 ← compiles everything into the bundle
```

**Never edit `*-init.ts` or `transpile-packages.ts` manually** — they are regenerated from `radarboard.config.ts`.

## Allowed Dependencies

Each extension type has a strict allowlist of `@radarboard/*` workspace dependencies:

| Type | Allowed workspace deps |
|------|----------------------|
| Integration | `integration-sdk`, `types`, `utils` |
| Plugin | `plugin-sdk`, `types`, `utils`, `ui`, `hooks`, `widget-engine`, `embedding-service`, `llm` |
| Widget | `widget-sdk`, `widget-engine`, `types`, `utils`, `ui`, `charts`, `hooks`, `assistant-ui` |

**Forbidden:**
- Cross-extension imports (widget A importing widget B)
- Wrong SDK (widget importing `plugin-sdk`)
- Direct API calls — use `@radarboard/utils/api-routes` helpers

These rules are enforced by:
- **Biome `noRestrictedImports`** — catches wrong SDK imports at lint time
- **`check-module-boundaries.ts`** — validates package.json deps and source imports at commit time
- **`check:extensions`** — validates everything in CI

## Quality Checks

Every extension must pass `pnpm check:extensions`, which validates:

1. **Package structure** — `package.json` exists with correct name and exports
2. **Export validation** — all `package.json` exports resolve to real files
3. **Module boundaries** — dependencies and imports follow the allowlist
4. **Test existence** — at least one `.test.ts` file exists
5. **Conformance test** — tests call the SDK's conformance checker
6. **Bundle impact** — flags extensions with many external dependencies

### Conformance Tests

Every extension includes a conformance test that validates its descriptor:

```ts
// integrations/<name>/src/conformance.test.ts
import { runIntegrationConformance } from "@radarboard/integration-sdk/conformance";
import { myDescriptor } from ".";

runIntegrationConformance([myDescriptor]);
```

```ts
// plugins/<name>/src/conformance.test.ts
import { runPluginConformance } from "@radarboard/plugin-sdk/conformance";
import { myDescriptor } from ".";

runPluginConformance([myDescriptor]);
```

```ts
// widgets/<name>/src/__tests__/conformance.test.ts
import { runWidgetConformance } from "@radarboard/widget-engine/conformance";
import { myDescriptor } from "..";

runWidgetConformance([myDescriptor]);
```

## Development Workflow

```bash
# 1. Create your extension
pnpm create-widget my-widget

# 2. Implement your extension
#    Edit src/index.ts, components, hooks, data-resolver, etc.

# 3. Run quality checks
pnpm check:extensions --filter=widget

# 4. Run tests
pnpm test

# 5. Commit (pre-commit hooks run automatically)
git add .
git commit -m "feat(widgets): add my-widget"

# 6. Push (pre-push runs typecheck, tests, and extension quality)
git push
```

## Descriptor Reference

### IntegrationDescriptor

```ts
{
  id: "my-service",           // kebab-case, unique
  name: "My Service",         // display name
  description: "...",         // short description
  icon: Globe,                // Lucide icon component
  category: "analytics",      // catalog grouping
  auth: { ... },              // authentication config
  dataSources: [ ... ],       // data source definitions
  mcpTools: [ ... ],          // optional MCP tool definitions
}
```

### PluginDescriptor

```ts
{
  id: "my-plugin",
  name: "My Plugin",
  description: "...",
  icon: Puzzle,
  version: "1.0.0",           // semver
  launchSurfaces: ["palette"], // where to show: palette, topbar, dock
  presentation: "modal",      // modal or panel
  component: MyOverlay,       // React component
  mcpTools: [ ... ],          // optional
  settings: [ ... ],          // optional user settings
}
```

### WidgetDescriptor

```ts
{
  id: "my-widget",
  name: "My Widget",
  description: "...",          // max 120 chars
  requiredIntegrations: [],    // which integrations must be connected
  defaultSlot: "slot1",        // grid position
  component: MyCompact,        // compact view component
  expandedComponent: MyExpanded, // optional expanded view
  defaultConfig: { ... },      // default widget configuration
  visualEditor: { ... },       // template-based visual editor
}
```

## CI Pipeline

The CI workflow (`.github/workflows/ci.yml`) runs on every PR:

1. **Lint** — Biome checks
2. **Typecheck** — TypeScript compilation
3. **Extension Quality** — `pnpm check:extensions`
4. **Tests** — `pnpm test` (includes conformance tests)
