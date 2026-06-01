---
name: create-integration
description: "Create or update a Radarboard integration. Provider integrations should default to the community-extensions repo; core integrations are explicit platform exceptions. Use this when the user asks to add, build, scaffold, wire, or fix an external service connection, credentials or OAuth setup, data sources, MCP tools, config-flow steps, MCP connection config, and webhook or delta handling for services like GitHub, Stripe, Slack, Vercel, Sentry, or any API-backed provider."
---

# Create Integration

End-to-end guide for adding a new integration. Provider integrations belong in `/Users/thedaviddias/Projects/community-extensions` by default. Only put an integration in Radarboard core when it is provider-neutral platform infrastructure.

## Gather Inputs

Collect these before writing code:

- Integration name in kebab-case, for example `statuscake` or `buildkite`
- Upstream service and docs URL
- Auth type: `api_key`, `oauth`, or `none`
- Category: `revenue`, `deployment`, `analytics`, `monitoring`, or `communication`
- Which actions should become API routes, for example `data`, `checks`, `incidents`, `deployments`
- Which shared capability or capabilities the integration provides, if any
- Whether the integration also needs `mcp`, `mcpTools`, `configFlow`, `webhookHandler`, or delta detection

If the user already named a service, do not stall. Fill the rest from the repo, upstream docs, or existing Radarboard patterns.

## Step 1: Scaffold

For provider integrations, run from `/Users/thedaviddias/Projects/community-extensions`:

```bash
pnpm create-extension <name> --integration
```

This creates `integrations/<name>/` in the community catalog. It does not update core `radarboard.config.ts`; provider integrations must remain installable extensions.

For the rare core integration, run from Radarboard core:

```bash
pnpm create-integration <name>
```

That creates `integrations/<name>/`, updates `radarboard.config.ts`, runs `pnpm generate:extensions`, and links the workspace with `pnpm install`.

The scaffolded package includes:

```
integrations/<name>/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts
    ├── types.ts
    ├── conformance.test.ts
    ├── api/
    │   ├── client.ts
    │   └── data-sources.ts
    └── mcp/
        ├── mcp-tools.ts
        └── mcp-tools.test.ts
```

Replace placeholder text immediately. Do not leave `example.com`, fake labels, or generic descriptions in the finished package.

## Step 2: Configure the Descriptor

Edit `src/index.ts` and make the descriptor real:

```typescript
import type { IntegrationDescriptor } from "@radarboard/integration-sdk/types";
import { Globe } from "lucide-react";
import { statuscakeDataSources } from "./api/data-sources";

export const statuscakeDescriptor: IntegrationDescriptor = {
  id: "statuscake",
  name: "StatusCake",
  description: "Uptime checks, incidents, and alerts from StatusCake.",
  icon: Globe,
  category: "monitoring",
  apiDocsUrl: "https://developers.statuscake.com/api/",
  auth: {
    id: "statuscake",
    name: "StatusCake",
    type: "api_key",
    fields: [{ key: "apiKey", label: "API Key", type: "password", placeholder: "sk_..." }],
    docsUrl: "https://app.statuscake.com/",
    testEndpoint: "/api/credentials/test",
  },
  capabilities: [{ id: "uptime", action: "checks" }],
  dataSources: statuscakeDataSources,
  configFlow: {
    steps: [
      {
        id: "credentials",
        title: "Enter API credentials",
        description: "Paste the StatusCake API token used for check and incident access.",
        fields: [{ key: "apiKey", label: "API Key", type: "password", placeholder: "sk_..." }],
      },
    ],
  },
};
```

Rules:

- Keep the description tight and concrete.
- Only expose auth fields the user actually needs to enter.
- If the integration can also connect through MCP, add the `mcp` block instead of inventing custom wiring.
- Remove placeholder metadata you do not intend to maintain. Do not ship `example.com`.
- Add `capabilities` whenever the integration should power an existing canonical widget or any shared cross-service surface.

Capability rules:

- `capabilities` is the integration-side contract that tells Radarboard which widget capability this service can satisfy and through which `action`.
- The `action` in `capabilities` must match a real `DataSourceDescriptor.action`.
- If the service overlaps an existing canonical widget, wire the integration into that widget’s capability model instead of creating a new widget by default.
- Shared capabilities currently include `revenue`, `stars`, `errors`, `uptime`, `app-reviews`, `downloads`, `sponsorship`, `shipping`, `analytics`, and `seo`.

## Step 3: Define Types

Keep `src/types.ts` focused on:

- Credential config passed into the API client
- Raw or lightly-normalized upstream response types
- The normalized route payloads returned by your data sources

Example:

```typescript
export interface StatusCakeConfig {
  apiKey: string;
}

export interface StatusCakeCheck {
  id: string;
  name: string;
  status: "up" | "down" | "paused";
  uptime: number;
}

export interface StatusCakeChecksResponse {
  configured: boolean;
  items: StatusCakeCheck[];
}
```

Do not bury important route shapes inside `any`.

## Step 4: Implement the API Client

Edit `src/api/client.ts` as a stateless wrapper around the upstream API:

```typescript
import type { StatusCakeCheck, StatusCakeConfig } from "../types";

const BASE_URL = "https://api.statuscake.com/v1";

export async function fetchChecks(config: StatusCakeConfig): Promise<StatusCakeCheck[]> {
  const res = await fetch(`${BASE_URL}/uptime`, {
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`StatusCake API error: ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as { data: StatusCakeCheck[] };
  return json.data;
}
```

Rules:

- One exported function per upstream endpoint or resource family.
- Keep auth outside global state. Pass credentials into each function.
- Throw actionable errors. Include status codes when possible.
- Prefer explicit return types over inferred `any`.

## Step 5: Wire Data Sources

Each `DataSourceDescriptor` becomes `/api/integrations/<id>/<action>`.

```typescript
import type { DataSourceDescriptor } from "@radarboard/integration-sdk/types";
import { fetchChecks } from "./client";

export const statuscakeChecksDataSource: DataSourceDescriptor = {
  action: "checks",
  description: "List uptime checks from StatusCake.",
  cacheTtlSeconds: 300,
  pollingSourceId: "statuscake",
  buildCacheKey: (params) =>
    `statuscake:checks:${params.projectSlug ?? "all"}:${params.range}:${params.timeZone}`,

  async fetch(_params, ctx) {
    const creds = await ctx.resolveCredential("statuscake");
    if (!creds?.apiKey) {
      return { configured: false, items: [] };
    }

    const items = await fetchChecks({ apiKey: creds.apiKey });
    return {
      configured: true,
      items,
    };
  },
};
```

If the integration is meant to satisfy a canonical widget, keep the route payload normalized enough that the widget can consume it without forking into provider-specific UI. The Revenue widget is the reference for provider selection; the integration’s job is to expose a stable capability action, not to force a new widget.

Rules:

- Resolve credentials through `ctx.resolveCredential("<integration-id>")`.
- Return a stable empty or `configured: false` shape when credentials or project config are missing.
- Set real cache keys and `pollingSourceId` values so polling stays predictable.
- Use `parseParams` when the route needs extra query params beyond the common ones.
- Add `delta` only when fresh responses can produce useful notification events.

## Step 6: Optional MCP, Webhooks, and Delta

- `src/mcp/mcp-tools.ts`: Add MCP tools when the assistant should be able to query or mutate the service directly.
- `src/events/webhook.ts`: Add a `WebhookHandler` when the provider can push events into Radarboard.
- `src/events/delta.ts`: Add a `DeltaDetector` when you need change detection from polled data.
- Update `src/index.ts` and `src/api/data-sources.ts` to reference those files.

For MCP-backed integrations, prefer the first-class `mcp` connection config instead of inventing custom environment wiring.

## Step 7: Verify

```bash
pnpm check:extensions --filter=integration --extension <name>
pnpm --filter @radarboard/integration-<name> test
pnpm validate --extension <name>
```

For core-only integrations, use `pnpm typecheck` instead of `pnpm validate --extension <name>`.

`pnpm check:extensions` includes capability governance checks. It will:

- error if a capability action points at a missing data source
- warn if the integration declares a capability with no canonical widget owner
- warn if the canonical widget for that capability does not list this integration/action as a provider

If the change touched multiple extensions, also consider `pnpm test:extensions`.

## Rules

- Use `pnpm`, never `npm`.
- Do not start dev servers. The user keeps them running already.
- Never hardcode tokens, secrets, or workspace-specific URLs.
- Keep auth, data source IDs, and package names aligned with the integration ID.
- Follow current SDK types in `@radarboard/integration-sdk/types` over stale template comments.

## References

- API + webhook: `integrations/github/`
- OAuth + analytics data: `integrations/google-search-console/`
- API-only: `integrations/open-collective/`
- MCP-oriented: `integrations/astro/`
- Composite integration: `integrations/shipping/`
- Capability-backed canonical examples: `integrations/revenuecat/`, `integrations/stripe/`, `integrations/sentry/`, `integrations/betterstack/`
