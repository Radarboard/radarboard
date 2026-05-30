# __INTEGRATION_NAME__

> Scaffolded with `pnpm create-integration __INTEGRATION_KEBAB__`

## Quick Start

1. **Define credentials** — Edit `src/index.ts` to set the `auth` fields your API needs (API key, OAuth, etc.)
2. **Build the client** — Implement API calls in `src/api/client.ts`
3. **Wire up data sources** — Connect your client to the fetch function in `src/api/data-sources.ts`
4. **Test** — Run `pnpm --filter @radarboard/integration-__INTEGRATION_KEBAB__ test`

## Structure

```
src/
├── index.ts              # IntegrationDescriptor — metadata, auth config, data sources
├── types.ts              # Integration-specific TypeScript types
├── api/
│   ├── client.ts         # API client — HTTP calls to the external service
│   └── data-sources.ts   # DataSourceDescriptor[] — maps API routes to fetch functions
├── mcp/
│   └── mcp-tools.ts      # MCP tools for AI assistant integration (optional)
└── conformance.test.ts   # Validates descriptor against SDK rules
```

## How It Works

Each data source maps to an API route:

```
GET /api/integrations/__INTEGRATION_KEBAB__/<action>
```

The `fetch` function receives:
- **`params`** — Route params (`projectSlug`, `range`, `timeZone`, `forceRefresh`)
- **`ctx`** — Context with `resolveCredential()` to access stored API keys

```ts
async fetch(params, ctx) {
  const creds = await ctx.resolveCredential("__INTEGRATION_KEBAB__");
  // Call your API client with creds, return normalized data
}
```

## Key Files to Reference

- **SDK types**: `@radarboard/integration-sdk/types` — `IntegrationDescriptor`, `DataSourceDescriptor`
- **Testing**: `@radarboard/integration-sdk/testing` — `createMockDataSourceContext()`
- **Real examples**: `integrations/github/`, `integrations/stripe/`, `integrations/vercel/`
- **Extension guide**: `CONTRIBUTING-EXTENSIONS.md`

## Adding More Data Sources

Add another `DataSourceDescriptor` to the array in `data-sources.ts`:

```ts
const projectsSource: DataSourceDescriptor = {
  action: "projects",           // → GET /api/integrations/__INTEGRATION_KEBAB__/projects
  description: "List projects",
  cacheTtlSeconds: 300,
  async fetch(params, ctx) { /* ... */ },
};
```

## Module Boundaries

Integrations can only import from:
- `@radarboard/integration-sdk`
- `@radarboard/types`
- `@radarboard/utils`
