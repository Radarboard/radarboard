# API Cache & Backup Layer

**Date:** 2026-03-17
**Status:** Draft

## Overview

Add a persistent SQLite cache layer across all 9 dashboard API routes. API routes check the cache first and only hit external services when cached data is stale. A separate cron endpoint proactively refreshes all cache entries for all projects on a schedule, ensuring complete data backup even when nobody has the dashboard open.

The cache uses the same local SQLite database (`local.db`) already in place for settings, with a future path to Turso for cross-device sync. The database file is created relative to the Next.js app working directory (`apps/app/local.db` in development).

## Decisions

- **Architecture**: Generic JSON cache table (single `api_cache` table with JSON blobs)
- **Integration**: New middleware layer (`withCache` wrapper) in each API route. Existing in-memory Map caches in `packages/api/src/` stay untouched.
- **Cache role**: Cache-first reads -- API routes serve from SQLite when data is fresh, only call external APIs on cache miss or expiry.
- **Backup trigger**: Both on-fetch caching and a proactive cron endpoint that refreshes all data for all projects.
- **Stale fallback**: When an external API fails, the cache returns expired data rather than erroring.
- **Limit handling**: Routes that accept `limit` params always cache the default (max) result set. The cache key does not include `limit` -- slicing happens after cache read in the route handler.

## Changes

### 1. Schema -- `api_cache` Table (`apps/app/db/schema.ts`)

Add a new table alongside the existing `userSettings`:

```typescript
export const apiCache = sqliteTable("api_cache", {
  key: text("key").primaryKey(),        // "revenue:goshuin-atlas:30d:USD"
  route: text("route").notNull(),       // "/api/revenue" (for cron queries)
  data: text("data").notNull(),         // JSON response blob
  fetchedAt: integer("fetched_at").notNull(), // unix timestamp (seconds)
  ttlSeconds: integer("ttl_seconds").notNull(), // freshness window
});
```

The `route` column enables the cron endpoint to query all cache keys for a given route. Add an index on `route` for efficient lookups:

```typescript
export const apiCacheRouteIdx = index("api_cache_route_idx").on(apiCache.route);
```

After editing the schema, run `pnpm drizzle-kit push --dialect sqlite --schema ./db/schema.ts --url file:local.db` from `apps/app/` to apply the migration.

**Concurrency**: Configure the libsql client with a busy timeout (5000ms) so concurrent writes don't fail with `SQLITE_BUSY`. This is set in `apps/app/db/client.ts` when creating the local client.

### 2. Cache Helper -- `apps/app/db/cache.ts`

A generic cache wrapper function:

```typescript
interface CacheOptions<T> {
  key: string;          // unique cache key
  route: string;        // API route path (for cron grouping)
  ttlSeconds: number;   // how long data is considered fresh
  fetchFn: () => Promise<T>; // function that calls external APIs
  forceRefresh?: boolean;    // skip cache read (used by cron)
}

interface CacheResult<T> {
  data: T;
  _stale?: boolean; // true when serving expired cache due to fetch failure
}

async function withCache<T>(options: CacheOptions<T>): Promise<CacheResult<T>>
```

**Flow:**

1. If `forceRefresh` is false (default), query `api_cache` for `key`
2. If entry exists and `fetchedAt + ttlSeconds > now`, parse and return `{ data: parsedJSON }`
3. If no fresh entry, call `fetchFn()`
4. On success: upsert the result into `api_cache`, return `{ data: result }`
5. On `fetchFn` failure:
   - Check for any cached entry (even expired)
   - If stale entry exists, return `{ data: parsedJSON, _stale: true }`
   - If no entry at all, re-throw the original error

**Important**: `withCache` returns a `CacheResult<T>` wrapper, not `T` directly. The route handler destructures it:

```typescript
// In the route handler:
const { data: result, _stale } = await withCache({ ... });
return NextResponse.json({ ...result, _stale });
```

This keeps the `_stale` flag cleanly separated from the cached data type.

**Additional exports:**

```typescript
// Read cache without fetching (for diagnostics)
async function getCacheEntry(key: string): Promise<{ data: unknown; fetchedAt: number; ttlSeconds: number } | null>

// Delete all cache entries (for manual reset)
async function clearCache(): Promise<void>

// List all cache keys for a route (for cron)
async function getCacheKeysByRoute(route: string): Promise<string[]>
```

### 3. Extracting Fetch Logic from Route Handlers

To share fetch logic between API routes and the cron backup endpoint, extract the data-fetching-and-transformation block from each route handler into a standalone function. These functions live in a new file per domain.

**New file**: `apps/app/lib/fetchers.ts`

Each fetcher encapsulates the external API calls + data transformation for one route:

```typescript
// Revenue
async function fetchRevenueData(params: {
  projectSlug: string | null;
  range: TimeRange;
  currency: DisplayCurrency;
  projects: Project[];
}): Promise<RevenueRouteResponse>

// Analytics
async function fetchAnalyticsData(params: {
  projectSlug: string | null;
  range: string;
  projects: Project[];
}): Promise<AnalyticsRouteResponse>

// Health
async function fetchHealthData(): Promise<HealthRouteResponse>

// Sentry
async function fetchSentryData(params: {
  projectSlug: string | null;
  projects: Project[];
}): Promise<SentryRouteResponse>

// SEO
async function fetchSeoData(params: {
  projectSlug: string | null;
  siteUrl: string | null;
  projects: Project[];
}): Promise<SeoRouteResponse>

// App Store
async function fetchAppStoreData(params: {
  projectSlug: string | null;
  projects: Project[];
}): Promise<AppStoreRouteResponse>

// Ideas
async function fetchIdeasData(params: {
  projectSlug: string | null;
  limit: number;
  projects: Project[];
}): Promise<IdeasRouteResponse>

// Shipping
async function fetchShippingData(params: {
  projectSlug: string | null;
  limit: number;
  projects: Project[];
}): Promise<ShippingRouteResponse>

// Open Collective
async function fetchOpenCollectiveData(params: {
  slug: string;
}): Promise<OpenCollectiveRouteResponse>
```

Each route handler is refactored to call its fetcher instead of inlining the logic:

```typescript
// Before (inline in route):
const [overview, chart, netChart] = await Promise.all([...]);
const revenue = transformOverview(overview);
return NextResponse.json({ configured: true, revenue, revenueSeries });

// After (route calls fetcher via withCache):
const { data, _stale } = await withCache({
  key: `revenue:${slug}:${range}:${currency}`,
  route: "/api/revenue",
  ttlSeconds: 300,
  fetchFn: () => fetchRevenueData({ projectSlug: slug, range, currency, projects: PROJECTS }),
});
return NextResponse.json({ ...data, _stale });
```

### 4. API Route Changes

Each of the 9 routes wraps its extracted fetcher in `withCache`. The existing in-memory caches in `packages/api/src/` remain -- they still help within a single serverless invocation. The SQLite layer sits above them and survives cold starts.

#### 4.1 `/api/revenue/route.ts`

- **Cache key**: `revenue:${projectSlug ?? "all"}:${range}:${currency}`
- **TTL**: 300 seconds (5 min)
- **Fetcher**: `fetchRevenueData({ projectSlug, range, currency, projects })`
- **Guard**: Only wrap in `withCache` when `configured: true`. Return `{ configured: false }` immediately without caching when RevenueCat isn't configured.

#### 4.2 `/api/analytics/route.ts`

- **Cache key**: `analytics:${projectSlug ?? "all"}:${range}`
- **TTL**: 60 seconds
- **Fetcher**: `fetchAnalyticsData({ projectSlug, range, projects })`
- **Guard**: Only cache when there are OpenPanel-configured platforms.
- **Note**: The `platform` query param is not included in the cache key. The cache always stores the full multi-platform aggregate. When a `platform` filter is passed, the route skips the cache and fetches directly (platform-filtered requests are rare, used for debugging).

#### 4.3 `/api/health/route.ts`

- **Cache key**: `health:all`
- **TTL**: 60 seconds
- **Fetcher**: `fetchHealthData()`

#### 4.4 `/api/sentry/route.ts`

- **Cache key**: `sentry:${projectSlug ?? "all"}`
- **TTL**: 120 seconds (2 min)
- **Fetcher**: `fetchSentryData({ projectSlug, projects })`
- **Guard**: Skip caching when no Sentry project slug is resolved (return `{ configured: true, sentry: null }` directly).

#### 4.5 `/api/seo/route.ts`

- **Cache key**: `seo:${projectSlug ?? "all"}:${siteUrl}`
- **TTL**: 300 seconds (5 min)
- **Fetcher**: `fetchSeoData({ projectSlug, siteUrl, projects })`
- **Note**: Each GSC site URL gets its own cache entry. A project with two sites (e.g., goshuin-atlas has `goshuin.com` and `goshuinatlas.com`) produces two cache entries.

#### 4.6 `/api/app-store/route.ts`

- **Cache key**: `appstore:${projectSlug ?? "all"}`
- **TTL**: 900 seconds (15 min)
- **Fetcher**: `fetchAppStoreData({ projectSlug, projects })`

#### 4.7 `/api/ideas/route.ts`

- **Cache key**: `ideas:${projectSlug ?? "all"}`
- **TTL**: 120 seconds (2 min)
- **Fetcher**: `fetchIdeasData({ projectSlug, limit: 30, projects })` (always cache with default limit)
- **Post-cache**: Route handler slices result to requested `limit` after reading from cache.

#### 4.8 `/api/shipping/route.ts`

- **Cache key**: `shipping:${projectSlug ?? "all"}`
- **TTL**: 120 seconds (2 min)
- **Fetcher**: `fetchShippingData({ projectSlug, limit: 20, projects })` (always cache with default limit)
- **Post-cache**: Route handler slices result to requested `limit` after reading from cache.

#### 4.9 `/api/open-collective/route.ts`

- **Cache key**: `oc:${slug}`
- **TTL**: 300 seconds (5 min)
- **Fetcher**: `fetchOpenCollectiveData({ slug })`

### 5. Cron Backup Endpoint -- `POST /api/backup/route.ts`

Proactively refreshes all cache entries for all projects and all relevant routes.

**Authentication**: Requires `Authorization: Bearer $BACKUP_SECRET` header. Returns `401` if missing or invalid.

**Task building**: Uses `buildBackupTasks()` from `apps/app/lib/backup-tasks.ts` to construct the full list.

**Execution**: Tasks run sequentially with delays between them. RevenueCat tasks get a 15-second delay between them (3 parallel calls per task, 5 req/min limit = max 1 task per 36s, but 15s is safe with the in-memory cache dedup). All other tasks get a 500ms delay.

**Response shape**:
```typescript
{
  refreshed: number;  // count of successfully refreshed entries
  failed: number;     // count of failed refreshes
  duration: number;   // total time in ms
  errors: string[];   // error messages for failed refreshes
}
```

### 6. Backup Task Builder -- `apps/app/lib/backup-tasks.ts`

Builds the complete list of backup tasks by iterating projects and their platform integrations:

```typescript
interface BackupTask {
  key: string;        // cache key
  route: string;      // API route path
  ttlSeconds: number;
  fetchFn: () => Promise<unknown>;
  rateLimitGroup?: string; // e.g. "revenuecat" -- tasks in the same group get extra delay
}

function buildBackupTasks(projects: Project[]): BackupTask[]
```

**Task enumeration logic:**

```typescript
function buildBackupTasks(projects: Project[]): BackupTask[] {
  const tasks: BackupTask[] = [];

  for (const project of projects) {
    const slug = project.slug;

    // Revenue -- only if any platform has RevenueCat
    if (project.platforms.some((p) => p.integrations.revenuecat)) {
      for (const currency of ["USD", "CAD"] as const) {
        tasks.push({
          key: `revenue:${slug}:30d:${currency}`,
          route: "/api/revenue",
          ttlSeconds: 300,
          rateLimitGroup: "revenuecat",
          fetchFn: () => fetchRevenueData({ projectSlug: slug, range: "30d", currency, projects }),
        });
      }
    }

    // Analytics -- only if any platform has OpenPanel
    if (project.platforms.some((p) => p.integrations.openPanel)) {
      tasks.push({
        key: `analytics:${slug}:30d`,
        route: "/api/analytics",
        ttlSeconds: 60,
        fetchFn: () => fetchAnalyticsData({ projectSlug: slug, range: "30d", projects }),
      });
    }

    // Sentry -- only if any platform has Sentry
    if (project.platforms.some((p) => p.integrations.sentry)) {
      tasks.push({
        key: `sentry:${slug}`,
        route: "/api/sentry",
        ttlSeconds: 120,
        fetchFn: () => fetchSentryData({ projectSlug: slug, projects }),
      });
    }

    // SEO -- one task PER PLATFORM with Google Search Console (not per project)
    for (const platform of project.platforms) {
      const gsc = platform.integrations.googleSearchConsole;
      if (gsc) {
        tasks.push({
          key: `seo:${slug}:${gsc.siteUrl}`,
          route: "/api/seo",
          ttlSeconds: 300,
          fetchFn: () => fetchSeoData({ projectSlug: slug, siteUrl: gsc.siteUrl, projects }),
        });
      }
    }

    // App Store -- only if any platform has App Store Connect
    if (project.platforms.some((p) => p.integrations.appStoreConnect)) {
      tasks.push({
        key: `appstore:${slug}`,
        route: "/api/app-store",
        ttlSeconds: 900,
        rateLimitGroup: "appstore",
        fetchFn: () => fetchAppStoreData({ projectSlug: slug, projects }),
      });
    }

    // Ideas -- only if any platform has Linear
    if (project.platforms.some((p) => p.integrations.linear)) {
      tasks.push({
        key: `ideas:${slug}`,
        route: "/api/ideas",
        ttlSeconds: 120,
        fetchFn: () => fetchIdeasData({ projectSlug: slug, limit: 30, projects }),
      });
    }

    // Shipping -- if project has any of GitHub, Linear, or Vercel integrations
    const hasShippingSources = project.platforms.some(
      (p) => p.integrations.github || p.integrations.linear || p.integrations.vercel
    );
    if (hasShippingSources) {
      tasks.push({
        key: `shipping:${slug}`,
        route: "/api/shipping",
        ttlSeconds: 120,
        fetchFn: () => fetchShippingData({ projectSlug: slug, limit: 20, projects }),
      });
    }

    // Open Collective -- one task PER PLATFORM with OC configured (keyed on OC slug, not project slug)
    for (const platform of project.platforms) {
      const oc = platform.integrations.openCollective;
      if (oc) {
        tasks.push({
          key: `oc:${oc.slug}`,
          route: "/api/open-collective",
          ttlSeconds: 300,
          fetchFn: () => fetchOpenCollectiveData({ slug: oc.slug }),
        });
      }
    }
  }

  // Health is project-independent
  tasks.push({
    key: "health:all",
    route: "/api/health",
    ttlSeconds: 60,
    fetchFn: () => fetchHealthData(),
  });

  return tasks;
}
```

### 7. Environment Variables

Add to `apps/app/.env.example`:

```
# --- Backup Cron ---
# Secret token to authenticate backup cron requests
# Generate with: openssl rand -hex 32
BACKUP_SECRET=
```

## TTL Reference

| Route | TTL | Rationale |
|-------|-----|-----------|
| `/api/revenue` | 5 min | Matches RevenueCat rate limit (5 req/min) |
| `/api/analytics` | 60s | Live visitor count needs freshness |
| `/api/health` | 60s | Uptime monitoring needs near-realtime |
| `/api/sentry` | 2 min | Error trends need reasonable freshness |
| `/api/seo` | 5 min | GSC data is 2-3 days delayed, no need for frequent refresh |
| `/api/app-store` | 15 min | Reviews and versions change slowly |
| `/api/ideas` | 2 min | Linear issues change with moderate frequency |
| `/api/shipping` | 2 min | PRs and deployments happen throughout the day |
| `/api/open-collective` | 5 min | Donations are infrequent |

## File Summary

| File | Action |
|------|--------|
| `apps/app/db/schema.ts` | Edit -- add `apiCache` table + index |
| `apps/app/db/client.ts` | Edit -- add busy timeout for local SQLite |
| `apps/app/db/cache.ts` | Create -- `withCache()` helper + cache utilities |
| `apps/app/lib/fetchers.ts` | Create -- extracted fetch functions for all 9 routes |
| `apps/app/lib/backup-tasks.ts` | Create -- `buildBackupTasks()` from project config |
| `apps/app/app/api/backup/route.ts` | Create -- cron endpoint |
| `apps/app/app/api/revenue/route.ts` | Edit -- use fetcher + wrap in `withCache` |
| `apps/app/app/api/analytics/route.ts` | Edit -- use fetcher + wrap in `withCache` |
| `apps/app/app/api/health/route.ts` | Edit -- use fetcher + wrap in `withCache` |
| `apps/app/app/api/sentry/route.ts` | Edit -- use fetcher + wrap in `withCache` |
| `apps/app/app/api/seo/route.ts` | Edit -- use fetcher + wrap in `withCache` |
| `apps/app/app/api/app-store/route.ts` | Edit -- use fetcher + wrap in `withCache` |
| `apps/app/app/api/ideas/route.ts` | Edit -- use fetcher + wrap in `withCache` |
| `apps/app/app/api/shipping/route.ts` | Edit -- use fetcher + wrap in `withCache` |
| `apps/app/app/api/open-collective/route.ts` | Edit -- use fetcher + wrap in `withCache` |
| `apps/app/.env.example` | Edit -- add `BACKUP_SECRET` |

## Out of Scope

- Historical snapshots table (future -- add when trend analysis over time is needed)
- Cache management UI in the settings modal (future -- Integrations section could show cache stats)
- Automatic cache invalidation on project config changes
- Per-platform caching for analytics/shipping (cache is per-project aggregate, not per-platform)
- Cache size limits or eviction policies (SQLite handles this fine at the scale of a personal dashboard)
