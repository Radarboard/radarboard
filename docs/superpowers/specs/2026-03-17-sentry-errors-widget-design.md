# Sentry Errors Widget — Full Integration Design

**Date:** 2026-03-17
**Status:** Approved

## Goal

Connect the "Errors" widget (the `detail` panel in sentry mode) to live Sentry data in both the "All projects" tab and individual project tabs. Replace the plain text "Project Slug" input in project platform settings with a dropdown populated from the authenticated Sentry organization's project list.

## Current State

| Layer | Current behavior |
|---|---|
| `fetchSentryData` (all tab) | Returns `{ configured: true, sentry: null }` — no data shown |
| `fetchSentryData` (project tab) | Works — fetches issues for the configured project slug |
| Sentry project slug field in settings | Plain text input — user must know the exact slug |
| `getProjects()` in `@radarboard/api/sentry` | Already implemented, never exposed via HTTP |

## Changes

### 1. Fix `fetchSentryData` for "All" tab

**File:** `apps/app/lib/fetchers.ts` — `fetchSentryData()`

When `projectSlug` is `null`, iterate all `PROJECTS` platforms that have `sentry.projectSlug` configured. For each, call `getUnresolvedIssues` and `getProjectStats` in parallel via `Promise.allSettled`. Merge results:

- `unresolvedCount` = sum of all per-project issue counts
- `issues` = all issues combined, annotated with their `projectName`/`projectSlug`, sorted by `count` descending, capped at 25
- `errorTrend` = per-timestamp sum of stats across all projects (same `mergeTrends` pattern used by `fetchSeoData`)

When `projectSlug` is set, current behavior is unchanged (look up `sentry.projectSlug` from PROJECTS config, fetch for that single project).

**Cache key:** `sentry:all` (unchanged from current route behavior).

### 2. New API route: `GET /api/sentry/projects`

**File:** `apps/app/app/api/sentry/projects/route.ts`

Calls `resolveSentryConfig()` → `getProjects(config)` → returns:

```json
{ "configured": true, "projects": [{ "id": "...", "name": "...", "slug": "..." }] }
```

or `{ "configured": false }` if credentials not stored.

Uses `withLogging` middleware. TTL: 10 minutes (projects rarely change). No project-slug param needed (org-level).

### 3. New hook: `useSentryProjects()`

**File:** `packages/hooks/src/use-sentry-projects.ts`

SWR hook following the same pattern as other hooks in the package. Calls `GET /api/sentry/projects`. Returns `{ slugs: string[], configured: boolean, loading: boolean }`. Refresh interval: 10 minutes.

### 4. Settings dropdown

**File:** `apps/app/components/settings-projects.tsx`

**Changes:**
- Add `useSentryProjects()` call in `IntegrationRow` alongside existing `useGscSites()` (hooks must be called unconditionally before early returns).
- Add `sentryProjectSlugs: string[]` to the `renderIntegrationField` parameter list.
- Add conditional branch in `renderIntegrationField`:
  ```
  if (integrationKey === "sentry" && field.key === "projectSlug") {
    return <SelectField ... options={sentryProjectSlugs} placeholder="Select project…" />
  }
  ```
  This mirrors the OpenPanel and GSC patterns exactly.

When Sentry credentials are not configured, the dropdown will be empty (same behavior as the OpenPanel dropdown before credentials are entered).

### 5. `SentryOverview` type — project label

The existing `SentryIssueItem` already has `projectName` and `projectSlug` fields. No type changes needed.

The existing `SentryIssues` widget UI already renders `issue.projectName` implicitly via the culprit field. No widget UI changes are needed unless we decide to add a project badge in the "all" view — that is out of scope for this spec.

## Data Flow

```
"All" tab:
  widget → useSentry(null) → GET /api/sentry (no ?project)
    → fetchSentryData({ projectSlug: null })
      → resolveSentryConfig()
      → for each PROJECTS platform with sentry.projectSlug:
           Promise.allSettled([getUnresolvedIssues, getProjectStats])
      → merge + sort → SentryOverview

Project tab:
  widget → useSentry("my-project") → GET /api/sentry?project=my-project
    → fetchSentryData({ projectSlug: "my-project" })
      → look up sentry.projectSlug from PROJECTS config
      → getUnresolvedIssues + getProjectStats for that slug
      → SentryOverview (unchanged)

Settings dropdown:
  IntegrationRow (sentry) → useSentryProjects()
    → GET /api/sentry/projects
      → resolveSentryConfig() → getProjects(config)
      → [{ slug: "my-project" }, ...] → SelectField options
```

## Files Touched

| File | Change |
|---|---|
| `apps/app/lib/fetchers.ts` | Fix `fetchSentryData` — add "all" aggregation branch |
| `apps/app/app/api/sentry/projects/route.ts` | New file — org project list endpoint |
| `packages/hooks/src/use-sentry-projects.ts` | New file — SWR hook |
| `apps/app/components/settings-projects.tsx` | Add hook call + SelectField branch |
| `packages/types/src/api-routes.ts` | Add `sentryProjects` route constant |

## Out of Scope

- Adding project color badges to issues in the "all" view (can be done separately)
- Pagination of issues beyond the 25-item cap
- Any changes to the widget UI itself (`sentry-issues.tsx`)
- Any changes to the KPI strip
