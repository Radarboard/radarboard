# Radarboard: Widget & Integration Isolation — Migration Plan

> **Goal:** Migrate all widgets and integrations to follow the same
> convention-over-configuration, self-contained directory structure
> used by the plugin system. Every widget and integration becomes
> independently discoverable, scaffoldable, and testable.

---

## Architecture Before / After

```
Before
──────
packages/api/        13 API clients (no shared interface)
packages/hooks/      24 hooks (mixed widget + app-level)
packages/widgets/    21 widgets (3 inconsistent patterns)
                     no integration registry
                     integrations implicit via WidgetAuth scanning

After
─────
packages/integrations/   14 integration descriptors + clients (NEW)
packages/hooks/          ~6 non-widget hooks remain (shrunk)
packages/widgets/        15 widgets in strict 6-file convention
                         + 4 template widgets exempt (2-file)
packages/api/            DELETED
```

## New File Conventions

### Widget — 6-file structure

```
packages/widgets/src/widgets/<name>/
├── types.ts
├── index.ts                    ← WidgetDescriptor
├── use-<name>.ts               ← SWR data-fetching hook (co-located)
├── components/
│   ├── <name>-compact.tsx
│   └── <name>-expanded.tsx
├── mcp-tools.ts
└── mcp-tools.test.ts
```

### Integration — 5-file structure

```
packages/integrations/src/<name>/
├── types.ts                    ← config + API response types
├── index.ts                    ← IntegrationDescriptor
├── client.ts                   ← API client (moved from @radarboard/api)
├── mcp-tools.ts
└── mcp-tools.test.ts
```

### Template widgets — exempt (2-file)

`analytics-template`, `revenue-template`, `sponsorship-template`
keep `index.ts` + `types.ts` only. The template engine is
infrastructure, not a widget.

### IntegrationDescriptor shape

```typescript
interface IntegrationDescriptor {
  id: string;          // kebab-case, matches PlatformIntegrations key
  name: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  category: "revenue" | "deployment" | "analytics" | "monitoring" | "communication";
  auth: IntegrationAuth;   // absorbs WidgetAuth (fields, type, docsUrl, oauth)
  mcpTools?: IntegrationMcpTool[];
}
```

---

## Dependency Graph After Migration

```
packages/integrations   ← no internal @radarboard deps
packages/widgets        ← depends on @radarboard/integrations (types only)
                          clients stay server-side in apps/app/app/api/
apps/app                ← imports both + @radarboard/hooks (shrunk)
```

---

## Hook Co-location Map

| Hook | Destination | Strategy |
|---|---|---|
| `use-aso-keywords` | `widgets/aso-keywords/` | move (1:1) |
| `use-github-open-issues` + `use-github-open-prs` | `widgets/github-activity/` | move both |
| `use-ideas` | `widgets/ideas/` | move (1:1) |
| `use-logs` + `use-sse` | `widgets/logs/` | move (use-sse internal to use-logs) |
| `use-seo` + `use-seo-query` | `widgets/seo/` | move both |
| `use-vercel-domains` | `widgets/vercel-domains/` | move (1:1) |
| `use-vercel-deployments` | `vercel-build-perf/`, `vercel-deployments/`, `vercel-projects/` | **duplicate** into all 3 |
| `use-revenue` | `widgets/revenue/` | move; templates/data-sources imports from widget |
| `use-shipping` | `widgets/shipping/` | move; chrome/bottom-ticker + kpi-strip import from widget |
| `use-health` | `widgets/detail/` | move; chrome/bottom-ticker + kpi-strip import from widget |
| `use-app-store` | `widgets/detail/` | move; chrome/kpi-strip imports from widget |
| `use-analytics` | `widgets/analytics/` | move; chrome/kpi-strip + templates/data-sources import from widget |
| `use-github-sponsors` + `use-open-collective` | `widgets/sponsorship/` | move; templates/data-sources imports from widget |
| `use-sentry` | `integrations/sentry/` | move to integration (no widget home) |

**Stays in `packages/hooks` (~6 files):**
`use-credentials`, `use-dashboard` (global state), `use-mcp-servers`,
`use-sentry-projects`, `use-polling`, `fetcher.ts`

---

## Execution Timeline

```
Phase 0  Infrastructure + Scaffolding    ~2 days
Phase 1  14 Integrations                 ~3 days
Phase 2  15 Widgets                      ~5 days
Phase 3  Marketing site sync             ~0.5 day
Phase 4  Complete incomplete plugins     ~1 day
──────────────────────────────────────────────────
Total                                    ~11.5 days
```

---

## Full TODO

### Phase 0 — Infrastructure & Scaffolding

#### 0.1 Create `packages/integrations/` package

- [ ] Create `packages/integrations/package.json` (name: `@radarboard/integrations`)
- [ ] Create `packages/integrations/tsconfig.json`
- [ ] Create `packages/integrations/src/types.ts`
      — `IntegrationDescriptor`, `IntegrationAuth`, `IntegrationAuthField`,
        `IntegrationOAuthConfig`, `IntegrationMcpTool`
- [ ] Create `packages/integrations/src/registry.ts`
      — `INTEGRATION_REGISTRY` (empty Map), `registerIntegration()`,
        `getIntegration()`, `getAllIntegrations()`
- [ ] Create `packages/integrations/src/index.ts` (barrel export)
- [ ] Create `packages/integrations/src/init.ts` (empty, filled in Phase 1)
- [ ] Add `packages/integrations` to `pnpm-workspace.yaml`
- [ ] Add `@radarboard/integrations` to `turbo.json` pipeline

#### 0.2 Update Widget Registry to imperative pattern

- [ ] Add `registerWidget()`, `getWidget()`, `getAllWidgets()` to
      `packages/widgets/src/widgets/registry.ts`
- [ ] Change static `WIDGET_REGISTRY` Map constructor to empty `new Map<>()`
      (remove all hard-coded descriptor entries)
- [ ] Create `packages/widgets/src/init.ts`
      — imports all 15 (non-template) widget descriptors
      — calls `registerWidget()` for each
- [ ] Add `./init` export path to `packages/widgets/package.json`
- [ ] Update `apps/app/providers.tsx` to add
      `import "@radarboard/widget-engine/init"` (same pattern as plugins)

#### 0.3 Update `_template/` to full 6-file scaffold

- [ ] Delete `packages/widgets/src/widgets/_template/index.ts`
- [ ] Create `packages/widgets/src/widgets/_template/types.ts`
- [ ] Create `packages/widgets/src/widgets/_template/index.ts`
- [ ] Create `packages/widgets/src/widgets/_template/use-template.ts`
- [ ] Create `packages/widgets/src/widgets/_template/components/template-compact.tsx`
- [ ] Create `packages/widgets/src/widgets/_template/components/template-expanded.tsx`
- [ ] Create `packages/widgets/src/widgets/_template/mcp-tools.ts`
- [ ] Create `packages/widgets/src/widgets/_template/mcp-tools.test.ts`

#### 0.4 Create scaffolding scripts

- [ ] Create `scripts/create-widget.ts`
      — accepts `<name>` arg (kebab-case)
      — copies `_template/` into `packages/widgets/src/widgets/<name>/`
      — replaces all `template`/`Template` references with new name
        (kebab → camelCase → PascalCase transforms)
      — prints: "Next: add to packages/widgets/src/init.ts"
- [ ] Create `scripts/create-integration.ts`
      — same pattern for `packages/integrations/src/<name>/`
      — prints: "Next: add to packages/integrations/src/init.ts"
- [ ] Add to root `package.json`:
      `"create-widget": "tsx scripts/create-widget.ts"`
      `"create-integration": "tsx scripts/create-integration.ts"`

#### 0.5 Update `settings-integrations.tsx`

- [ ] Update `collectServices()` to read from `INTEGRATION_REGISTRY`
      instead of scanning `WIDGET_REGISTRY.auth` fields
- [ ] Move the `CATEGORIES` hardcoded grouping into
      `IntegrationDescriptor.category` field
- [ ] Keep backwards compat fallback during Phase 1 migration
      (registry starts empty)

#### 0.6 Move `env.ts` utilities to `packages/utils`

- [ ] Move `getEnv()`, `requireEnv()`, `validateServiceEnv()` helpers
      to `packages/utils/src/env.ts`
- [ ] Update all imports across `packages/api/` and any other callers
- [ ] `ENV_KEYS` constants will be distributed to each
      integration's `client.ts` in Phase 1

---

### Phase 1 — Migrate Integrations

> One integration per commit. Register in `init.ts` after each one.
> Delete `packages/api/` only after all 14 are complete.

#### 1.1 `github` integration

- [ ] Create `packages/integrations/src/github/types.ts`
- [ ] Create `packages/integrations/src/github/index.ts` (descriptor, category: deployment)
- [ ] Move `packages/api/src/github.ts` → `packages/integrations/src/github/client.ts`
- [ ] Move `WidgetAuth` from github-activity descriptor into integration descriptor
- [ ] Create `packages/integrations/src/github/mcp-tools.ts`
- [ ] Create `packages/integrations/src/github/mcp-tools.test.ts`
- [ ] Register in `packages/integrations/src/init.ts`
- [ ] Update all imports in `apps/app/app/api/` from `@radarboard/api` → `@radarboard/integrations/github`

#### 1.2 `vercel` integration

- [ ] Create `packages/integrations/src/vercel/types.ts`
- [ ] Create `packages/integrations/src/vercel/index.ts` (category: deployment)
- [ ] Move `packages/api/src/vercel.ts` → `packages/integrations/src/vercel/client.ts`
- [ ] Move `WidgetAuth` from vercel widget descriptors into integration descriptor
- [ ] Create `packages/integrations/src/vercel/mcp-tools.ts`
- [ ] Create `packages/integrations/src/vercel/mcp-tools.test.ts`
- [ ] Register in `init.ts`
- [ ] Update all imports in `apps/app/app/api/`

#### 1.3 `revenuecat` integration

- [ ] Create `packages/integrations/src/revenuecat/types.ts`
- [ ] Create `packages/integrations/src/revenuecat/index.ts` (category: revenue)
- [ ] Move `packages/api/src/revenuecat.ts` → `packages/integrations/src/revenuecat/client.ts`
- [ ] Create `packages/integrations/src/revenuecat/mcp-tools.ts`
- [ ] Create `packages/integrations/src/revenuecat/mcp-tools.test.ts`
- [ ] Register in `init.ts`
- [ ] Update all imports in `apps/app/app/api/`

#### 1.4 `app-store-connect` integration

- [ ] Create `packages/integrations/src/app-store-connect/types.ts`
- [ ] Create `packages/integrations/src/app-store-connect/index.ts` (category: revenue)
- [ ] Move `packages/api/src/app-store-connect.ts` → `client.ts`
- [ ] Create `packages/integrations/src/app-store-connect/mcp-tools.ts`
- [ ] Create `packages/integrations/src/app-store-connect/mcp-tools.test.ts`
- [ ] Register in `init.ts`
- [ ] Update all imports in `apps/app/app/api/`

#### 1.5 `sentry` integration

- [ ] Create `packages/integrations/src/sentry/types.ts`
- [ ] Create `packages/integrations/src/sentry/index.ts` (category: monitoring)
- [ ] Move `packages/api/src/sentry.ts` → `packages/integrations/src/sentry/client.ts`
- [ ] Move `packages/hooks/src/use-sentry.ts` → `packages/integrations/src/sentry/use-sentry.ts`
- [ ] Update `chrome/kpi-strip.tsx` + `templates/data-sources.tsx` imports
- [ ] Create `packages/integrations/src/sentry/mcp-tools.ts`
- [ ] Create `packages/integrations/src/sentry/mcp-tools.test.ts`
- [ ] Register in `init.ts`
- [ ] Update all imports in `apps/app/app/api/`

#### 1.6 `linear` integration

- [ ] Create `packages/integrations/src/linear/types.ts`
- [ ] Create `packages/integrations/src/linear/index.ts` (category: deployment)
- [ ] Move `packages/api/src/linear.ts` → `packages/integrations/src/linear/client.ts`
- [ ] Create `packages/integrations/src/linear/mcp-tools.ts`
- [ ] Create `packages/integrations/src/linear/mcp-tools.test.ts`
- [ ] Register in `init.ts`
- [ ] Update all imports in `apps/app/app/api/`

#### 1.7 `google-search-console` integration

- [ ] Create `packages/integrations/src/google-search-console/types.ts`
- [ ] Create `packages/integrations/src/google-search-console/index.ts` (category: analytics)
- [ ] Move `packages/api/src/google-search-console.ts` → `client.ts`
- [ ] Create `packages/integrations/src/google-search-console/mcp-tools.ts`
- [ ] Create `packages/integrations/src/google-search-console/mcp-tools.test.ts`
- [ ] Register in `init.ts`
- [ ] Update all imports in `apps/app/app/api/`

#### 1.8 `openpanel` integration

- [ ] Create `packages/integrations/src/openpanel/types.ts`
- [ ] Create `packages/integrations/src/openpanel/index.ts` (category: analytics)
- [ ] Move `packages/api/src/openpanel.ts` → `packages/integrations/src/openpanel/client.ts`
- [ ] Create `packages/integrations/src/openpanel/mcp-tools.ts`
- [ ] Create `packages/integrations/src/openpanel/mcp-tools.test.ts`
- [ ] Register in `init.ts`
- [ ] Update all imports in `apps/app/app/api/`

#### 1.9 `open-collective` integration

- [ ] Create `packages/integrations/src/open-collective/types.ts`
- [ ] Create `packages/integrations/src/open-collective/index.ts` (category: revenue)
- [ ] Move `packages/api/src/opencollective.ts` → `packages/integrations/src/open-collective/client.ts`
- [ ] Create `packages/integrations/src/open-collective/mcp-tools.ts`
- [ ] Create `packages/integrations/src/open-collective/mcp-tools.test.ts`
- [ ] Register in `init.ts`
- [ ] Update all imports in `apps/app/app/api/`

#### 1.10 `github-sponsors` integration

- [ ] Create `packages/integrations/src/github-sponsors/types.ts`
- [ ] Create `packages/integrations/src/github-sponsors/index.ts` (category: revenue)
- [ ] Move `packages/api/src/github-sponsors.ts` → `client.ts`
- [ ] Create `packages/integrations/src/github-sponsors/mcp-tools.ts`
- [ ] Create `packages/integrations/src/github-sponsors/mcp-tools.test.ts`
- [ ] Register in `init.ts`
- [ ] Update all imports in `apps/app/app/api/`

#### 1.11 `betterstack` integration

- [ ] Create `packages/integrations/src/betterstack/types.ts`
- [ ] Create `packages/integrations/src/betterstack/index.ts` (category: monitoring)
- [ ] Move `packages/api/src/betterstack.ts` → `packages/integrations/src/betterstack/client.ts`
- [ ] Create `packages/integrations/src/betterstack/mcp-tools.ts`
- [ ] Create `packages/integrations/src/betterstack/mcp-tools.test.ts`
- [ ] Register in `init.ts`
- [ ] Update all imports in `apps/app/app/api/`

#### 1.12 `npm` integration

- [ ] Investigate: find or extract npm API client (no file found in packages/api)
- [ ] Create `packages/integrations/src/npm/types.ts`
- [ ] Create `packages/integrations/src/npm/index.ts` (category: analytics)
- [ ] Create `packages/integrations/src/npm/client.ts`
- [ ] Create `packages/integrations/src/npm/mcp-tools.ts`
- [ ] Create `packages/integrations/src/npm/mcp-tools.test.ts`
- [ ] Register in `init.ts`
- [ ] Update all imports in `apps/app/app/api/`

#### 1.13 `health-check` integration

- [ ] Investigate: extract health-check client from widget inline code
- [ ] Create `packages/integrations/src/health-check/types.ts`
- [ ] Create `packages/integrations/src/health-check/index.ts` (category: monitoring)
- [ ] Create `packages/integrations/src/health-check/client.ts`
- [ ] Create `packages/integrations/src/health-check/mcp-tools.ts`
- [ ] Create `packages/integrations/src/health-check/mcp-tools.test.ts`
- [ ] Register in `init.ts`

#### 1.14 `resend` integration

- [ ] Create `packages/integrations/src/resend/types.ts`
- [ ] Create `packages/integrations/src/resend/index.ts` (category: communication)
- [ ] Move `packages/api/src/resend.ts` → `packages/integrations/src/resend/client.ts`
- [ ] Create `packages/integrations/src/resend/mcp-tools.ts`
- [ ] Create `packages/integrations/src/resend/mcp-tools.test.ts`
- [ ] Register in `init.ts`
- [ ] Update all imports in `apps/app/app/api/`

#### 1.15 `astro` integration (investigate)

- [ ] Investigate: `astro` exists in `PlatformIntegrations` but has no API client
- [ ] Create stub integration or full client depending on findings
- [ ] Register in `init.ts` if implemented

#### 1.X Phase 1 completion gate

- [ ] Verify `settings-integrations.tsx` reads correctly from `INTEGRATION_REGISTRY`
- [ ] Verify all `apps/app/app/api/` routes import from `@radarboard/integrations` (not `@radarboard/api`)
- [ ] Delete `packages/api/`
- [ ] Remove `@radarboard/api` from all `package.json` dependencies
- [ ] Remove `packages/api` from `pnpm-workspace.yaml`

---

### Phase 2 — Migrate Widgets

> For each widget: reorganize files, co-locate hook, split
> compact/expanded, add types.ts + mcp-tools, update registry.
> After all 15: verify packages/hooks is down to ~6 files.

#### Tier 1 — Simple single-file widgets

##### 2.1 `github-stars`

- [ ] Create `widgets/github-stars/types.ts`
- [ ] Rename/refactor `index.tsx` → `index.ts` + `components/github-stars-compact.tsx`
      + `components/github-stars-expanded.tsx`
- [ ] Create `widgets/github-stars/use-github-stars.ts` (investigate source)
- [ ] Create `widgets/github-stars/mcp-tools.ts`
- [ ] Create `widgets/github-stars/mcp-tools.test.ts`
- [ ] Register in `packages/widgets/src/init.ts`

##### 2.2 `npm-downloads`

- [ ] Create `widgets/npm-downloads/types.ts`
- [ ] Refactor `index.tsx` into `index.ts` + `components/npm-downloads-compact.tsx`
      + `components/npm-downloads-expanded.tsx`
- [ ] Create `widgets/npm-downloads/use-npm-downloads.ts`
- [ ] Create `widgets/npm-downloads/mcp-tools.ts`
- [ ] Create `widgets/npm-downloads/mcp-tools.test.ts`
- [ ] Register in `packages/widgets/src/init.ts`

##### 2.3 `vercel-build-perf`

- [ ] Create `widgets/vercel-build-perf/types.ts`
- [ ] Refactor `index.tsx` into `index.ts` + compact/expanded components
- [ ] Copy `packages/hooks/src/use-vercel-deployments.ts`
      → `widgets/vercel-build-perf/use-vercel-build-perf.ts`
- [ ] Create `widgets/vercel-build-perf/mcp-tools.ts`
- [ ] Create `widgets/vercel-build-perf/mcp-tools.test.ts`
- [ ] Register in `packages/widgets/src/init.ts`

##### 2.4 `vercel-domains`

- [ ] Create `widgets/vercel-domains/types.ts`
- [ ] Refactor `index.tsx` into `index.ts` + compact/expanded components
- [ ] Move `packages/hooks/src/use-vercel-domains.ts`
      → `widgets/vercel-domains/use-vercel-domains.ts`
- [ ] Update all import paths for `use-vercel-domains`
- [ ] Create `widgets/vercel-domains/mcp-tools.ts`
- [ ] Create `widgets/vercel-domains/mcp-tools.test.ts`
- [ ] Register in `packages/widgets/src/init.ts`

##### 2.5 `vercel-projects`

- [ ] Create `widgets/vercel-projects/types.ts`
- [ ] Refactor `index.tsx` into `index.ts` + compact/expanded components
- [ ] Copy `packages/hooks/src/use-vercel-deployments.ts`
      → `widgets/vercel-projects/use-vercel-projects.ts`
- [ ] Create `widgets/vercel-projects/mcp-tools.ts`
- [ ] Create `widgets/vercel-projects/mcp-tools.test.ts`
- [ ] Register in `packages/widgets/src/init.ts`

##### 2.6 `aso-keywords`

- [ ] Create `widgets/aso-keywords/types.ts`
- [ ] Refactor `index.tsx` into `index.ts` + compact/expanded components
- [ ] Move `packages/hooks/src/use-aso-keywords.ts`
      → `widgets/aso-keywords/use-aso-keywords.ts`
- [ ] Update all import paths for `use-aso-keywords`
- [ ] Create `widgets/aso-keywords/mcp-tools.ts`
- [ ] Create `widgets/aso-keywords/mcp-tools.test.ts`
- [ ] Register in `packages/widgets/src/init.ts`

#### Tier 2 — Medium multi-file widgets

##### 2.7 `revenue`

- [ ] Create `widgets/revenue/types.ts`
- [ ] Refactor `index.tsx` → `index.ts` + `components/revenue-compact.tsx`
      + `components/revenue-expanded.tsx`
- [ ] Move `revenue-chart.tsx` + `revenue-kpi.tsx` into `components/`
- [ ] Move `packages/hooks/src/use-revenue.ts`
      → `widgets/revenue/use-revenue.ts`
- [ ] Update `templates/data-sources.tsx` import to use widget path
- [ ] Update all import paths for `use-revenue`
- [ ] Create `widgets/revenue/mcp-tools.ts`
- [ ] Create `widgets/revenue/mcp-tools.test.ts`
- [ ] Register in `packages/widgets/src/init.ts`

##### 2.8 `seo`

- [ ] Create `widgets/seo/types.ts`
- [ ] Refactor `index.tsx` → `index.ts` + `components/seo-compact.tsx`
      + `components/seo-expanded.tsx`
- [ ] Move `seo-queries.tsx` into `components/`
- [ ] Move `packages/hooks/src/use-seo.ts` → `widgets/seo/use-seo.ts`
- [ ] Move `packages/hooks/src/use-seo-query.ts`
      → `widgets/seo/use-seo-query.ts`
- [ ] Update `shared/details/seo-query-detail.tsx` import path
- [ ] Update all import paths
- [ ] Create `widgets/seo/mcp-tools.ts`
- [ ] Create `widgets/seo/mcp-tools.test.ts`
- [ ] Register in `packages/widgets/src/init.ts`

##### 2.9 `shipping`

- [ ] Create `widgets/shipping/types.ts`
- [ ] Refactor `index.tsx` → `index.ts` + `components/shipping-compact.tsx`
      + `components/shipping-expanded.tsx`
- [ ] Move `shipping-log.tsx` into `components/`
- [ ] Move `packages/hooks/src/use-shipping.ts`
      → `widgets/shipping/use-shipping.ts`
- [ ] Update `chrome/bottom-ticker.tsx` + `chrome/kpi-strip.tsx` import paths
- [ ] Create `widgets/shipping/mcp-tools.ts`
- [ ] Create `widgets/shipping/mcp-tools.test.ts`
- [ ] Register in `packages/widgets/src/init.ts`

##### 2.10 `ideas`

- [ ] Create `widgets/ideas/types.ts`
- [ ] Refactor `index.tsx` → `index.ts` + `components/ideas-compact.tsx`
      + `components/ideas-expanded.tsx`
- [ ] Move `ideas-bugs.tsx` into `components/`
- [ ] Move `packages/hooks/src/use-ideas.ts` → `widgets/ideas/use-ideas.ts`
- [ ] Update all import paths
- [ ] Create `widgets/ideas/mcp-tools.ts`
- [ ] Create `widgets/ideas/mcp-tools.test.ts`
- [ ] Register in `packages/widgets/src/init.ts`

#### Tier 3 — Complex widgets

##### 2.11 `github-activity` (568-line monolith)

- [ ] Create `widgets/github-activity/types.ts`
- [ ] Extract compact view → `components/github-activity-compact.tsx`
- [ ] Extract expanded view → `components/github-activity-expanded.tsx`
- [ ] Create `widgets/github-activity/index.ts` (descriptor only)
- [ ] Move `packages/hooks/src/use-github-open-issues.ts`
      → `widgets/github-activity/use-github-open-issues.ts`
- [ ] Move `packages/hooks/src/use-github-open-prs.ts`
      → `widgets/github-activity/use-github-open-prs.ts`
- [ ] Create `widgets/github-activity/use-github-activity.ts`
      (barrel re-export or combined hook)
- [ ] Update all import paths
- [ ] Create `widgets/github-activity/mcp-tools.ts`
- [ ] Create `widgets/github-activity/mcp-tools.test.ts`
- [ ] Register in `packages/widgets/src/init.ts`

##### 2.12 `sponsorship` (457-line monolith)

- [ ] Create `widgets/sponsorship/types.ts`
- [ ] Extract compact view → `components/sponsorship-compact.tsx`
- [ ] Extract expanded view → `components/sponsorship-expanded.tsx`
- [ ] Create `widgets/sponsorship/index.ts` (descriptor only)
- [ ] Move `packages/hooks/src/use-github-sponsors.ts`
      → `widgets/sponsorship/use-github-sponsors.ts`
- [ ] Move `packages/hooks/src/use-open-collective.ts`
      → `widgets/sponsorship/use-open-collective.ts`
- [ ] Update `templates/data-sources.tsx` import paths
- [ ] Update all other import paths
- [ ] Create `widgets/sponsorship/mcp-tools.ts`
- [ ] Create `widgets/sponsorship/mcp-tools.test.ts`
- [ ] Register in `packages/widgets/src/init.ts`

##### 2.13 `vercel-deployments` (371-line monolith)

- [ ] Create `widgets/vercel-deployments/types.ts`
- [ ] Extract compact view → `components/vercel-deployments-compact.tsx`
- [ ] Extract expanded view → `components/vercel-deployments-expanded.tsx`
- [ ] Create `widgets/vercel-deployments/index.ts` (descriptor only)
- [ ] Copy `packages/hooks/src/use-vercel-deployments.ts`
      → `widgets/vercel-deployments/use-vercel-deployments.ts`
- [ ] Update all import paths
- [ ] Create `widgets/vercel-deployments/mcp-tools.ts`
- [ ] Create `widgets/vercel-deployments/mcp-tools.test.ts`
- [ ] Register in `packages/widgets/src/init.ts`
- [ ] Delete original `packages/hooks/src/use-vercel-deployments.ts`
      (after all 3 vercel widgets have their own copy)

##### 2.14 `logs`

- [ ] Create `widgets/logs/types.ts` (confirm/update existing one)
- [ ] Reorganize into `index.ts` + `components/logs-compact.tsx`
      + `components/logs-expanded.tsx`
- [ ] Move `log-entry.tsx` + `log-filters.tsx` into `components/`
- [ ] Move `packages/hooks/src/use-logs.ts` → `widgets/logs/use-logs.ts`
- [ ] Move `packages/hooks/src/use-sse.ts` → `widgets/logs/use-sse.ts`
      (internal to use-logs, not exported from widget)
- [ ] Update all import paths
- [ ] Create `widgets/logs/mcp-tools.ts`
- [ ] Create `widgets/logs/mcp-tools.test.ts`
- [ ] Register in `packages/widgets/src/init.ts`

##### 2.15 `detail`

- [ ] Create `widgets/detail/types.ts`
- [ ] Reorganize into `index.ts` + `components/detail-compact.tsx`
      + `components/detail-expanded.tsx`
- [ ] Retain sub-components in `components/` (health-alerts, health-monitors,
      app-store-reviews, sentry-issues)
- [ ] Move `packages/hooks/src/use-health.ts`
      → `widgets/detail/use-health.ts`
- [ ] Move `packages/hooks/src/use-app-store.ts`
      → `widgets/detail/use-app-store.ts`
- [ ] Update `chrome/bottom-ticker.tsx` + `chrome/kpi-strip.tsx` import paths
- [ ] Create `widgets/detail/mcp-tools.ts`
- [ ] Create `widgets/detail/mcp-tools.test.ts`
- [ ] Register in `packages/widgets/src/init.ts`

#### 2.X Phase 2 completion gate

- [ ] Verify all 15 widgets registered in `packages/widgets/src/init.ts`
- [ ] Verify `packages/hooks/src/` has only ~6 files remaining:
      `use-credentials`, `use-dashboard`, `use-mcp-servers`,
      `use-sentry-projects`, `use-polling`, `fetcher.ts`
- [ ] Run `pnpm build` — zero errors
- [ ] Run `pnpm test` — all tests pass

---

### Phase 3 — Marketing Site Sync

- [ ] Update `apps/marketing/src/data/integrations.ts` to derive
      data from `INTEGRATION_REGISTRY` at build time
- [ ] Remove the manually maintained static integration list
- [ ] Verify marketing site builds correctly

---

### Phase 4 — Complete Incomplete Plugins

> Use `pnpm create-widget` and the proven template from Phase 0.

##### 4.1 `rss-reader` plugin

- [ ] Create `plugins/rss-reader/index.ts` (PluginDescriptor)
- [ ] Create `plugins/rss-reader/widget.tsx` (compact grid widget)
- [ ] Verify registration in `packages/plugins/src/init.ts`

##### 4.2 `changelog` plugin

- [ ] Create `plugins/changelog/index.ts` (PluginDescriptor)
- [ ] Create `plugins/changelog/widget.tsx`
- [ ] Create `plugins/changelog/components/changelog-overlay.tsx`
- [ ] Verify registration in `packages/plugins/src/init.ts`

##### 4.3 `status-page` plugin

- [ ] Create `plugins/status-page/index.ts` (PluginDescriptor)
- [ ] Create `plugins/status-page/widget.tsx`
- [ ] Create `plugins/status-page/use-status-page.ts`
- [ ] Create `plugins/status-page/components/status-page-overlay.tsx`
- [ ] Verify registration in `packages/plugins/src/init.ts`

##### 4.4 `bookmarks` + `notes` plugins

- [ ] Verify `bookmarks` is fully registered in `init.ts`
- [ ] Verify `notes` is fully registered in `init.ts`

#### 4.X Phase 4 completion gate

- [ ] All 7 plugins registered and functional
- [ ] Run full test suite

---

## Open Items / Risks

| Item | Risk | Resolution |
|---|---|---|
| `astro` in `PlatformIntegrations` has no API client | Low | Investigate during Phase 1.15; may be config-only |
| `npm` has no API client in `packages/api` | Low | Find inline usage or create npmjs.com client |
| `health-check` client is inline in widget | Medium | Extract carefully, regression test |
| `use-vercel-deployments` duplicated 3× | Low | Intentional; isolated duplication preferred over coupling |
| Chrome components importing from widget folders | Low | Intra-package import, no circular dependency risk |
| Template engine data-sources importing from widget folders | Low | Same package, valid intra-package imports |
