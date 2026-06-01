---
name: create-widget
description: "Create or update a Radarboard widget. Provider-specific widgets should default to the community-extensions repo; core widgets are provider-neutral baseline widgets. Use this when the user asks to add, build, scaffold, wire, or refactor a dashboard widget package, including template recipes, data resolvers, SWR hooks, compact or expanded views, widget auth, `expandAction`, visual-editor config, or widget MCP tools."
---

# Create Widget

End-to-end guide for adding a widget. Provider-specific widgets belong in `/Users/thedaviddias/Projects/community-extensions` by default. Only put a widget in Radarboard core when it is provider-neutral and part of the default product baseline.

## Gather Inputs

Collect these up front:

- Widget name in kebab-case
- Which integration or plugin data it visualizes
- Which shared capability it owns, if any (for example `revenue`, `errors`, `stars`, `downloads`)
- Whether it is the canonical widget for that capability or a specialized view
- Whether the widget should stay template-backed or become custom
- Whether it needs auth, polling, variants, or `expandAction: { type: "open-plugin" }`
- Which slot is the best default

Default to a template-backed widget. Move to custom components only when the recipe and standard sections cannot express the interaction.

If `widget-caching` and `react-doctor` skills are available, use them alongside this one.

## Step 1: Scaffold

For community widgets, run from `/Users/thedaviddias/Projects/community-extensions`:

```bash
pnpm create-extension <name> --widget
```

This creates `widgets/<name>/` in the community catalog. It does not update core `radarboard.config.ts`.

For the rare core widget, run from Radarboard core:

```bash
pnpm create-widget <name>
```

That creates `widgets/<name>/`, updates `radarboard.config.ts`, runs `pnpm generate:extensions`, and links the workspace with `pnpm install`.

The scaffolded package includes:

```
widgets/<name>/
├── package.json
└── src/
    ├── index.ts
    ├── types.ts
    ├── routes.ts
    ├── data-resolver.tsx
    ├── conformance.test.ts
    ├── hooks/
    │   └── use-<name>.ts
    ├── components/
    │   ├── <name>-compact.tsx
    │   └── <name>-expanded.tsx
    └── mcp/
        └── mcp-tools/
            ├── index.ts
            └── mcp-tools.test.ts
```

## Step 2: Define the Recipe and Descriptor

The default scaffold is template-backed. Start there unless the widget truly needs bespoke interaction.

Edit `src/index.ts` with current widget SDK types:

```typescript
import {
  buildTemplateRecipe,
  type TemplateRecipeModel,
  type WidgetTemplateConfig,
} from "@radarboard/widget-engine/templates";
import type { WidgetDescriptor } from "@radarboard/widget-sdk/widget-types";
import { kpiRow, list } from "@radarboard/widget-sdk/section-helpers";
import { DeployLatencyCompact } from "./components/deploy-latency-compact";
import { DeployLatencyExpanded } from "./components/deploy-latency-expanded";

const SRC = "deploy-latency";

const recipe: TemplateRecipeModel = {
  kind: "summary_list",
  summary: [
    kpiRow(SRC, [
      { label: "P95", field: "p95Latency" },
      { label: "Failures", field: "failedCount" },
    ]),
  ],
  rail: [],
  content: [
    list(SRC, "items", {
      title: "title",
      subtitle: "subtitle",
      emptyMessage: "No recent deploys",
    }),
  ],
};

export const DEPLOY_LATENCY_TEMPLATE_CONFIG: WidgetTemplateConfig = {
  dataSources: [{ id: SRC }],
  recipe,
  sections: buildTemplateRecipe(recipe),
  expandedRecipe: recipe,
  expandedSections: buildTemplateRecipe(recipe),
};

export const deployLatencyDescriptor: WidgetDescriptor<WidgetTemplateConfig> = {
  id: "deploy-latency",
  name: "Deploy Latency",
  description: "Recent deploy latency and failures from Vercel.",
  catalogCategory: "deployment",
  capabilities: [
    {
      id: "shipping",
      role: "specialized",
      providers: [{ integration: "vercel", action: "deployments" }],
    },
  ],
  requiredIntegrations: ["vercel"],
  defaultSlot: "slot8",
  defaultPollInterval: 300_000,
  polling: { sourceIds: ["vercel-deployments"] },
  component: DeployLatencyCompact,
  expandedComponent: DeployLatencyExpanded,
  defaultConfig: DEPLOY_LATENCY_TEMPLATE_CONFIG,
  visualEditor: {
    kind: "template",
    getConfig: ({ config }) => config,
    setConfig: ({ editorConfig }) => editorConfig as WidgetTemplateConfig,
  },
};
```

Use:

- `capabilities` for capability ownership and provider wiring. This is now the canonical contract for shared widget surfaces.
- `requiredIntegrations` when the widget depends on connected services
- `requiredIntegrations` is not a substitute for `capabilities`. Use it only for relevance and availability filtering.
- `auth` only when the widget itself owns credentials
- `expandedSize` when the detail view needs a non-default size
- `expandAction: { type: "open-plugin", pluginId }` when the expand button should launch a plugin instead of the standard expanded overlay

Capability rules:

- Shared capability surfaces such as `revenue`, `errors`, `stars`, `downloads`, `analytics`, `seo`, `shipping`, and `sponsorship` should usually have exactly one widget with `role: "canonical"`.
- If you are adding a narrower or provider-specific view for a capability that already has a canonical widget, mark it `role: "specialized"`.
- The `providers` array must point at real integration/action pairs that exist in active first-party integrations or virtual integrations.
- If you are extending an existing capability with a new provider, prefer wiring that provider into the canonical widget instead of creating a new widget.

## Step 3: Define Data Shapes and Hook

Keep `src/types.ts` focused on normalized widget data, not raw API noise:

```typescript
export interface DeployLatencyItem {
  id: string;
  title: string;
  subtitle: string;
  latencyMs: number;
}

export interface DeployLatencyData {
  items: DeployLatencyItem[];
  p95Latency: number;
  failedCount: number;
}
```

Use `src/routes.ts` to centralize the route path, then fetch through `hooks/use-<name>.ts`:

```typescript
"use client";

import { usePollingInterval } from "@radarboard/hooks/use-polling-interval";
import useSWR from "swr";
import { ROUTES } from "../routes";
import type { DeployLatencyData } from "../types";

async function fetcher(url: string): Promise<DeployLatencyData> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
  return res.json() as Promise<DeployLatencyData>;
}

export function useDeployLatency(projectSlug: string | null) {
  const refreshInterval = usePollingInterval("deploy-latency");
  const url = projectSlug ? `${ROUTES.deployLatency}?project=${projectSlug}` : ROUTES.deployLatency;
  const { data, error, isLoading, mutate } = useSWR(url, fetcher, {
    refreshInterval,
  });

  return {
    data: data ?? null,
    error: error ?? null,
    isLoading,
    refetch: () => mutate(),
  };
}
```

For canonical widgets that support multiple providers, put provider resolution in a small helper and keep the hook API provider-aware. Follow the Revenue widget pattern: resolve a provider from widget capability metadata and current project connectivity, then fetch through `integrationRoute(providerIntegrationId, action)`.

## Step 4: Register the Data Resolver

Use the generated `src/data-resolver.tsx` to connect your hook to the template engine:

```typescript
"use client";

import {
  type DataSourceResolverProps,
  registerTemplateDataSource,
  reportResolverState,
} from "@radarboard/widget-sdk/data-source-registry";
import { useDeployLatency } from "./hooks/use-deploy-latency";

function DeployLatencyResolver({ config, onData }: DataSourceResolverProps) {
  const { data, error, isLoading } = useDeployLatency(config?.projectSlug ?? null);

  reportResolverState(onData, "deploy-latency", {
    loading: isLoading,
    error: error?.message ?? null,
    configured: true,
    fetchedAt: null,
    stale: false,
    data: data ?? null,
  });

  return null;
}

registerTemplateDataSource("deploy-latency", DeployLatencyResolver);
```

The data source ID must match the ID used in `defaultConfig.dataSources`.

## Step 5: Decide Whether You Need Custom Components

Stay template-backed when the widget is mostly KPIs, lists, tables, or charts.

Switch to custom components when:

- the compact card has unique interaction state
- the expanded view needs bespoke layout or controls
- a standard recipe cannot express the information hierarchy cleanly

For custom widgets, use `WidgetRenderProps` from `@radarboard/widget-sdk/widget-types` and `useWidgetCallbacks` from `@radarboard/widget-engine/hooks/use-widget-callbacks`.

UI rules for every widget:

- Use semantic tokens only. No hex colors and no Tailwind arbitrary values.
- Prevent horizontal overflow.
- Any scrollable region must use `scrollbar-thin`.
- Keep visual language aligned with existing widget-engine patterns.

## Step 6: Optional MCP Tools

Add tools in `src/mcp/mcp-tools/index.ts` when the assistant should query widget-specific data or actions.

Prefer calling shared data sources or route helpers instead of duplicating fetch logic inside MCP tools.

## Step 7: Verify

```bash
pnpm check:extensions --filter=widget --extension <name>
pnpm --filter @radarboard/widget-<name> test
pnpm react-doctor
pnpm validate --extension <name>
```

For core-only widgets, use `pnpm typecheck` instead of `pnpm validate --extension <name>`.

`pnpm check:extensions` audits capability governance. Expect:

- error on invalid provider references
- error on duplicate canonical widgets for the same capability
- warning when an integration declares a capability that no canonical widget owns
- warning when a canonical widget does not list a first-party integration that declares the same capability

For visual sanity checks, use the existing widget sandbox at `/debug/widget-sandbox`. Do not start new dev servers.

## References

- Template-heavy widgets: `widgets/revenue/`, `widgets/logs/`
- Mixed template + editor widgets: `widgets/stars/`, `widgets/deployments/`
- Custom component widgets: `widgets/seo/`, `widgets/pulls/`, `widgets/sponsorship/`
- Capability-driven canonical widgets: `widgets/revenue/`, `widgets/observability/`, `widgets/stars/`
