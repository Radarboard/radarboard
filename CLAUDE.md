# Radarboard — Claude Instructions

## Module Boundaries (Integrations, Plugins, Widgets)
Extensions must remain fully independent. Two enforcement layers run on every commit via lefthook:
- **Biome `noRestrictedImports`** in `biome.json` — catches wrong-SDK and forbidden shared-package imports.
- **`scripts/check-module-boundaries.ts`** — validates `package.json` deps and catches cross-extension imports.

### Allowed workspace dependencies

| Category | Allowed `@radarboard/*` deps |
|---|---|
| `integrations/*/` | `integration-sdk`, `types`, `utils` |
| `plugins/*/` | `plugin-sdk`, `types`, `utils`, `ui`, `widget-engine`, `embedding-service`, `llm` |
| `widgets/*/` | `widget-sdk`, `widget-engine`, `types`, `utils`, `ui`, `charts`, `hooks`, `assistant-ui` |

### What is forbidden
- Cross-extension imports (widget A importing widget B, plugin importing an integration, etc.)
- Using the wrong SDK (e.g., a widget importing `plugin-sdk`)
- Direct API calls from extensions — use `@radarboard/utils/api-routes` helpers instead
- NEVER make direct API calls from `apps/app`; all external service interactions must go through integration packages

### Maintenance
When adding a **new shared package** to `packages/` that extensions should use:
1. Add it to the allowlist in `scripts/check-module-boundaries.ts` (`ALLOWED_WORKSPACE_DEPS`)
2. Remove it from the forbidden list in the relevant `biome.json` override block (search for `noRestrictedImports` under `integrations/*/src/**`, `plugins/*/src/**`, or `widgets/*/src/**`)

When adding a **new extension**, no config changes are needed — glob patterns cover all directories automatically.

## API Route Architecture
All API routes are dispatched through a single catch-all at `apps/app/app/api/[...path]/route.ts`. Route handlers live in their feature modules under `modules/{feature}-shell/routes/`. **Never create route files directly in `app/api/`.**

### Adding a new API route
1. Create a handler function in the appropriate module's `routes/` directory (e.g., `modules/notifications-shell/routes/my-handler.ts`)
2. Export a named handler (e.g., `handleMyAction`), not `GET`/`POST` directly
3. Register it in the module's `register.ts` file using `registerRoutes()`
4. Add the path constant to `packages/types/src/api-routes.ts` (`API_ROUTES` for static paths, `API_ROUTE_PATTERNS` for dynamic `:param` paths)
5. For dynamic routes with params, create an adapter in the registration that extracts params from context

### Route registration barrel
`apps/app/lib/router/routes.ts` imports all module registrations. Add new modules here.

## General Rules
- Always use `pnpm`, never `npm`
- Never use `--no-verify` on git commands
- Never use `LEFTHOOK=0`
- Use MCP for Supabase, not local Supabase
- Prefer fixing lint issues over adding `biome-ignore` suppressions
- Use `@radarboard/logger/logger` for logging in API routes
- Next.js uses `proxy.ts` not `middleware.ts`; prefer `withRateLimit` wrapper over middleware
- Storybook stories must be grounded in real Radarboard UI. Do not invent text, placeholders, fake panels, or shell elements that do not exist in the app.
- If a story needs a state that the app does not currently expose, add that state to the real component/page first, then compose the story from the real implementation.
- For full-surface stories, prefer actual app screens and dialogs over synthetic mock layouts.
- Never use Storybook-only wrapper layout to fake centering, spacing, or presentation behavior. Put that behavior in the real component or in a shared Storybook provider/decorator only when it mirrors real app setup.

## E2E Testing
- **NEVER use bash to run E2E tests** — always use Playwright MCP tools (`browser_navigate`, `browser_click`, `browser_snapshot`, `browser_run_code`) to interact with the app directly in the browser
- E2E tests live in `apps/e2e/tests/` organized by domain: `dashboard/`, `onboarding/`, `settings/`, `plugins/`, `widgets/`
- Shared helpers in `apps/e2e/tests/_helpers/` (fixtures, dashboard-helpers, onboarding-helpers)
- E2E dev server runs on port 1365 (`pnpm --filter @radarboard/app dev:e2e`), separate from dev server on 1355
- E2E state uses isolated files (`.radarboard-e2e/`) — never affects the regular dev environment
