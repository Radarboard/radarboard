---
name: widget-caching
description: >-
  Caching, performance, and API efficiency rules for Radarboard. MUST be loaded when
  adding a new widget, route, hook, API client, or integration. Also load when
  reviewing or optimizing existing caching/performance code. Triggers on
  "new widget", "new integration", "new route", "SWR hook", "API client",
  "cache", "performance", "rate limit", "TTL", "polling".
license: MIT
metadata:
  author: radarboard
  version: "1.0.0"
---

# Widget Caching & Performance

Rules and checklists for keeping Radarboard fast and respectful of third-party API rate limits.

---

## 1. Architecture — Two-Tier Cache

Radarboard uses two complementary caching layers. **Both are required** for every data path.

| Layer | Location | Lifetime | Purpose |
|-------|----------|----------|---------|
| **In-memory** | `packages/api/src/<service>.ts` | Single server process | Hot dedup within a warm invocation; prevents burst calls to the same upstream API |
| **DB cache** | `apps/app/db/cache.ts` → `withCache()` | Persistent across cold starts | Avoids upstream API calls entirely; provides stale fallback on upstream failure |

### Why both?

- The in-memory cache is gone on every cold start or redeployment. The DB cache survives.
- The DB cache key is per-route aggregate (`shipping:goshuin-atlas`). The in-memory key is per-API-function (`gh:open-prs:owner/repo:30`). They operate at different granularities.
- The in-memory TTL MUST be **shorter** than the DB TTL for the same data. This prevents the in-memory cache from "winning" over the DB cache in a stale-hit scenario when the upstream was briefly unavailable.

---

## 2. TTL Reference Table

All new integrations MUST follow this table. **The rule: `ttlSeconds === refreshInterval / 1000`. Always. Any mismatch is a bug.**

| Data category | Example | In-memory TTL | DB `ttlSeconds` | SWR `refreshInterval` |
|---------------|---------|---------------|-----------------|----------------------|
| Live / real-time | OpenPanel visitors | 15 s | 15–60 | 15,000–60,000 ms |
| Health / uptime | BetterStack monitors | 60 s | 60 | 60,000 ms |
| Deployments / events | Vercel deploys, GitHub PRs | 60–120 s | 120 | 120,000 ms |
| Revenue / analytics | RevenueCat, OpenPanel | 300 s | 300 | 300,000 ms |
| App Store / builds | App Store Connect | 600–900 s | 900 | 900,000 ms |
| Stars / downloads | GitHub stars, npm | 300–600 s | 600–3600 | matches DB TTL |
| Domain / config | Vercel domains | 300–600 s | 600–1800 | matches DB TTL |
| Static lookups | Linear teams, Sentry projects | 3600 s | 3600 | no polling (`refreshInterval: 0`) |

---

## 3. New Widget / Integration Checklist

Every bullet MUST pass before merging.

### API Client (`packages/api/src/<service>.ts`)

- [ ] In-memory cache using the standard `Map<string, CacheEntry>` pattern
- [ ] In-memory TTL is deliberately **shorter** than the DB TTL for the same data
- [ ] Unique cache key per parameter combination (include all variable params in the key)
- [ ] Lazy eviction on read (delete expired entries in `getCached`)
- [ ] Export `evictCacheByPrefix(prefix: string)` so route handlers can bust the in-memory cache on `?refresh=1`

```ts
// Standard in-memory cache boilerplate — copy this exactly
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL_MS = 2 * 60 * 1000; // adjust per service

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache<T>(key: string, data: T, ttlMs = CACHE_TTL_MS): void {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

/** Evict all in-memory cache entries whose key starts with the given prefix. */
export function evictCacheByPrefix(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}
```

### API Route (`apps/app/app/api/<resource>/route.ts`)

- [ ] Wrapped with `withLogging("api/<route-name>", ...)`
- [ ] Uses `withCache({ key, route, ttlSeconds, forceRefresh, fetchFn })`
- [ ] Route registered in `packages/types/src/api-routes.ts`
- [ ] Cache key follows convention: `"<resource>:<projectSlug ?? 'all'>"`
- [ ] Supports `?refresh=1` via `forceRefresh` param
- [ ] On `forceRefresh`, calls `evictCacheByPrefix()` from the API client **before** `withCache` to also bust the in-memory layer

```ts
// Force-refresh pattern — MUST evict BOTH cache layers
const forceRefresh = searchParams.get("refresh") === "1";
if (forceRefresh) evictCacheByPrefix("myservice:");

const { data, _stale, _fetchedAt } = await withCache({
  key: `mywidget:${projectSlug ?? "all"}`,
  route: API_ROUTES.myWidget,
  ttlSeconds: 120,
  forceRefresh,
  fetchFn: () => fetchMyWidgetData({ projectSlug }),
});
```

### Fetcher (`apps/app/lib/fetchers.ts`)

- [ ] Returns `{ configured: false as const }` when credentials or integrations are missing
- [ ] Returns `{ configured: true as const, ... }` on success
- [ ] Uses `Promise.allSettled` (NOT `Promise.all`) for per-platform fetches
- [ ] Data shaping (API types → domain types) happens entirely inside the fetcher
- [ ] Dynamic `import("@/config/projects")` for lazy project config loading

### SWR Hook (`packages/hooks/src/use-<resource>.ts`)

- [ ] `"use client"` directive at the top
- [ ] Uses `apiFetcher` and `buildUrl` from `./fetcher` — never inline `fetch()`
- [ ] `refreshInterval` matches DB `ttlSeconds * 1000` exactly
- [ ] `revalidateOnFocus: false` — always (global default handles this, but be explicit if overriding other SWR options)
- [ ] `revalidateOnReconnect: false` for endpoints with TTL >= 300s
- [ ] `dedupingInterval` set to match `refreshInterval` for endpoints with TTL >= 300s
- [ ] Returns `configured` with `?? true` fallback
- [ ] Returns `fetchedAt: data?._fetchedAt ?? null`
- [ ] Exports a `refetch` callback that calls with `?refresh=1` then `mutate(fresh, { revalidate: false })`
- [ ] Registered in `packages/hooks/package.json` exports map

### Widget Registration

- [ ] `requiredIntegrations` lists all integration keys the widget needs
- [ ] `capabilities` declares canonical or specialized ownership when the widget participates in a shared cross-service surface
- [ ] `defaultPollInterval` matches the SWR hook's `refreshInterval`
- [ ] `auth` array defines credential requirements with `testEndpoint` and `docsUrl`
- [ ] Widget registered in `packages/widgets/src/widgets/registry.ts`
- [ ] Mock data fallback in `mock-data.ts` for unconfigured state

Capability governance notes:

- `requiredIntegrations` is for relevance filtering only. It does not replace `capabilities`.
- Canonical widgets such as Revenue and Observability may support multiple providers. In those cases, polling and hooks should resolve a provider from capability metadata instead of hard-coding a single integration route.
- When a new integration exposes an existing capability, prefer updating the canonical widget’s provider list and runtime selection before adding another widget.

---

## 4. SWR Configuration Rules

### Global defaults (set in `apps/app/app/providers.tsx`)

```tsx
<SWRConfig value={{ revalidateOnFocus: false, dedupingInterval: 5000 }}>
```

**Why `revalidateOnFocus: false`?**
A dashboard with 8-12 widgets means 8-12 SWR hooks. On every browser tab switch, all hooks would fire simultaneously. The DB cache absorbs the cost, but it's unnecessary request churn — the `refreshInterval` already handles periodic updates.

**Why `dedupingInterval: 5000`?**
The SWR default of 2000ms is too short for a dashboard where the same hook may be mounted in two places (e.g., KPI strip + widget). 5 seconds prevents duplicate requests within a reasonable window.

### Per-hook overrides

For slow-changing data (TTL >= 300s), set `dedupingInterval` equal to `refreshInterval`:

```ts
useSWR(key, apiFetcher, {
  refreshInterval: 300_000,
  dedupingInterval: 300_000,   // no re-fetch within the TTL window
  revalidateOnReconnect: false, // stale data is fine for slow endpoints
});
```

---

## 5. Cache Key Conventions

| Pattern | Example | Used by |
|---------|---------|---------|
| `<resource>:<slug>` | `shipping:goshuin-atlas` | Most widgets |
| `<resource>:<slug>:<param>` | `revenue:goshuin-atlas:30d:USD` | Parameterized endpoints |
| `<resource>:all` | `sentry:all` | When no project filter |
| `<resource>` | `health` | Global (project-independent) data |

**Rules:**
- Always include "all" suffix when `projectSlug` is null: `key: \`mywidget:${projectSlug ?? "all"}\``
- Backup tasks in `backup-tasks.ts` MUST use the exact same key pattern as the route handler
- Never use bare resource name without a suffix (the `"health"` key is a legacy exception)

---

## 6. Known Pitfalls — Do Not Repeat

These bugs were found in a caching audit and fixed. New code MUST NOT reintroduce them.

1. **TTL mismatch between route and hook** — `ttlSeconds` in the route handler MUST equal `refreshInterval / 1000` in the SWR hook. No exceptions.

2. **`revalidateOnFocus: true` (SWR default)** — Never use the default for dashboard data hooks. The global `SWRConfig` sets this to `false`. Do not override it back to `true`.

3. **In-memory cache not evicted on force-refresh** — When a route supports `?refresh=1`, it MUST call `evictCacheByPrefix()` from the API client before `withCache()`. Otherwise `fetchFn()` still reads stale in-memory data.

4. **Duplicated cache logic in API clients** — Always use the shared `getCached`/`setCache`/`fetchXxx` pattern. Never inline manual cache checks in a public function (the `listSites()` pattern was a bug).

5. **Copy-pasted cache boilerplate drift** — All 11+ API client files use the same `Map<string, CacheEntry>` pattern. When copying, verify TTL values match the service's rate limits and the data change frequency.

6. **Dead cache rows accumulating** — The `deleteExpired()` method on `CacheRepository` cleans up expired rows. It runs automatically during the backup cron. Do not disable it.

---

## 7. Files to Know

| File | Role |
|------|------|
| `packages/api/src/<service>.ts` | In-memory cached API client per external service |
| `apps/app/db/cache.ts` | `withCache()` wrapper — DB cache layer |
| `apps/app/db/<provider>-cache.ts` | Provider-specific `CacheRepository` implementations |
| `packages/types/src/database.ts` | `CacheRepository` interface definition |
| `apps/app/lib/fetchers.ts` | All server-side data fetchers (data shaping layer) |
| `apps/app/app/api/<resource>/route.ts` | Next.js route handlers |
| `packages/hooks/src/use-<resource>.ts` | SWR hooks for client-side data fetching |
| `packages/hooks/src/fetcher.ts` | Shared `apiFetcher` and `buildUrl` utilities |
| `apps/app/app/providers.tsx` | Global `SWRConfig` with dashboard defaults |
| `apps/app/lib/backup-tasks.ts` | Backup cron task definitions |
| `apps/app/app/api/backup/route.ts` | Backup cron endpoint |
| `packages/types/src/api-routes.ts` | Central registry of all API route paths |

---

## 8. Performance Review Checklist

When reviewing or optimizing existing code, check:

- [ ] Are all route TTLs aligned with their SWR hook `refreshInterval`?
- [ ] Does every route that supports `?refresh=1` also evict the in-memory API cache?
- [ ] Are there any SWR hooks with `revalidateOnFocus: true`?
- [ ] Are there any API client functions that bypass the shared fetch helper?
- [ ] Is `Promise.allSettled` used (not `Promise.all`) for multi-platform fetches?
- [ ] Are backup task cache keys identical to the route handler cache keys?
- [ ] Is expired cache row cleanup running via the backup cron?
