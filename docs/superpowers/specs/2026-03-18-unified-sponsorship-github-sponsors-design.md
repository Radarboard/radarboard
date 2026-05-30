# Unified Sponsorship Widget with GitHub Sponsors

**Date:** 2026-03-18
**Status:** Implemented

## Overview

Extend the existing sponsorship widget to support **GitHub Sponsors** alongside Open Collective, creating a unified sponsorship view. The widget will aggregate financial data from both sources, showing combined KPIs and tabbed sponsor lists with source indicators.

Currently the sponsorship widget only displays Open Collective data (balance, transactions, backers). This design adds a GitHub Sponsors GraphQL API client and merges both data sources into a single, richer widget experience.

## Goals

1. Fetch GitHub Sponsors data (sponsors list, tiers, monthly income) via the GraphQL API
2. Show unified KPIs combining both OC and GitHub Sponsors metrics
3. Provide tabbed expanded view: All Sponsors, Transactions (OC), Tiers (GH)
4. Work gracefully with only one source configured (OC-only, GitHub-only, or both)
5. Reuse the existing GitHub PAT from the credential store (no new auth config)

## Non-Goals

- Mutations (creating/cancelling sponsorships via API)
- Webhook-based real-time updates
- GitHub Sponsors payout/billing details
- Supporting multiple GitHub logins per project

## API Strategy

Use the **GitHub GraphQL API v4** at `https://api.github.com/graphql`, authenticated with the existing GitHub PAT (Bearer token). The token needs `read:user` scope to query sponsorship data. No new credential entry is required.

The GitHub login is derived from the first `github.owner` found in the project configuration. Since GitHub Sponsors are per-user/org (not per-repo), a single login covers all projects.

### GraphQL Queries

**Sponsors listing + stats:**
```graphql
query SponsorsOverview($login: String!, $first: Int!) {
  user(login: $login) {
    sponsorsListing {
      fullDescription
      activeGoal {
        title
        targetValue
        percentComplete
      }
      tiers(first: 10) {
        nodes {
          id
          name
          monthlyPriceInDollars
          description
          isOneTime
          sponsorsListing { slug }
        }
      }
    }
    sponsors(first: $first) {
      totalCount
      nodes {
        ... on User {
          login
          name
          avatarUrl
          url
        }
        ... on Organization {
          login
          name
          avatarUrl
          url
        }
      }
    }
    sponsorshipsAsMaintainer(first: $first, activeOnly: true) {
      totalCount
      nodes {
        sponsorEntity {
          ... on User {
            login
            name
            avatarUrl
            url
          }
          ... on Organization {
            login
            name
            avatarUrl
            url
          }
        }
        tier {
          name
          monthlyPriceInDollars
        }
        createdAt
        isOneTimePayment
      }
    }
  }
}
```

Note: The `sponsors` connection gives public sponsor counts. The `sponsorshipsAsMaintainer` connection (only accessible to the authenticated user for their own account) gives detailed sponsorship info including tier and amounts. For users querying their own data, both are available. For other users, only public data is accessible.

## Architecture

Follows the established integration pattern:

```
Types -> API Client -> Fetcher -> API Route -> React Hook -> Widget
```

### Layer 1: Types (`packages/types/src/github-sponsors.ts`)

```typescript
export interface GitHubSponsorTier {
  id: string;
  name: string;
  /** Monthly price in cents (converted from API's monthlyPriceInDollars * 100) */
  monthlyPriceInCents: number;
  description: string;
  isOneTime: boolean;
  /** Number of active sponsors at this tier (derived: counted from sponsorshipsAsMaintainer nodes grouped by tier name) */
  sponsorCount: number;
}

export interface GitHubSponsor {
  login: string;
  name: string | null;
  avatarUrl: string;
  url: string;
  /** "USER" or "ORGANIZATION" */
  type: "USER" | "ORGANIZATION";
  tier: {
    name: string;
    monthlyPriceInCents: number;
  } | null;
  /** ISO 8601 date string */
  since: string;
  isOneTime: boolean;
}

export interface GitHubSponsorStats {
  /** Estimated monthly income in cents (sum of active non-one-time sponsorships) */
  monthlyIncome: number;
  /** Total active sponsor count */
  sponsorCount: number;
  /** Currency code (GitHub Sponsors uses USD) */
  currency: string;
}

export interface GitHubSponsorsOverview {
  stats: GitHubSponsorStats;
  sponsors: GitHubSponsor[];
  tiers: GitHubSponsorTier[];
  /** Active goal if set */
  goal: {
    title: string;
    targetValue: number;
    percentComplete: number;
  } | null;
  /** True when querying another user's data (no access to sponsorshipsAsMaintainer) */
  limitedAccess: boolean;
}
```

### Layer 2: API Client (`packages/api/src/github-sponsors.ts`)

A **self-contained GraphQL client**, separate from the existing `github.ts` REST client. It follows the same structural pattern as `opencollective.ts` (its own `fetchGHGraphQL` helper, in-memory cache, error class), not the REST `fetchGH` helper from `github.ts`.

- In-memory cache with 5-minute TTL (intentionally longer than the 2-min TTL used by the REST `github.ts` client, since sponsorship data changes less frequently than PRs/issues)
- Uses `GitHubConfig` (existing `{ token }` type) for auth
- Exports: `getSponsorsOverview(config, login): Promise<GitHubSponsorsOverview>`
- Default page size: `first: 30` for sponsors (matching the existing pattern of 20-30 item caps across other API clients). Pagination beyond this is out of scope.

The client sends a single GraphQL query that fetches sponsors listing, tiers, sponsor list, and sponsorship details in one request to minimize API calls.

**Dollar-to-cents conversion:** The GitHub GraphQL API returns `monthlyPriceInDollars` (whole dollars). The client converts to cents (`* 100`) before returning data, so all internal types use cents consistently (matching OC's `valueInCents` convention).

**Monthly income calculation:** `monthlyIncome` is derived by summing `tier.monthlyPriceInDollars * 100` for each active, non-one-time sponsorship in `sponsorshipsAsMaintainer`. When a sponsorship has `tier: null` (custom amount without a tier), it is excluded from the income sum since the amount is not available via the API. A comment in the code will note this limitation.

**Rate limiting:** GitHub GraphQL API uses a point-based rate limit (5,000 points/hour). The single query here costs approximately 1 point per node requested, so ~60 points per call. With 5-min caching, this is well within limits (max 720 points/hour).

**Access control for other users:** When the authenticated PAT owner queries a different user's login (e.g., the `github.owner` in project config differs from the PAT owner), `sponsorshipsAsMaintainer` returns empty results. In this case, `monthlyIncome` will be **0** and per-sponsor tier info will be unavailable. The client will set a `limitedAccess: boolean` flag on the response so the widget can indicate "public data only" to the user.

### Layer 3: Fetcher (`apps/app/lib/fetchers.ts`)

New function `fetchGitHubSponsorsData(params: { login: string })`:
- Resolves GitHub token via `resolveGitHubConfig()` (returns `{ token }` from the credential store)
- Passes the token + the `login` parameter from the API route to `getSponsorsOverview(config, login)`
- Returns `{ configured: boolean, ...GitHubSponsorsOverview }`
- Returns `{ configured: false }` if no GitHub token is stored

### Layer 4: API Route (`apps/app/app/api/github-sponsors/route.ts`)

```
GET /api/github-sponsors?login=<github-username>
```

- Uses `withCache` (300s TTL, same as OC)
- Uses `withLogging` middleware
- Supports `refresh=1` for force-refresh

### Layer 5: React Hook (`packages/hooks/src/use-github-sponsors.ts`)

```typescript
export function useGitHubSponsors(login: string | null) {
  // SWR hook polling /api/github-sponsors?login=... every 5 min
  // Returns { data, configured, fetchedAt, loading, error, refetch }
}
```

### Layer 6: Widget Updates

#### Login Resolution

A new helper in `packages/widgets/src/widgets/helpers.ts`:

```typescript
export function resolveGitHubLogin(
  projects: Project[],
  activeProjectSlug: string | null
): string | null {
  // Returns the first github.owner found in project config
  // In "All" mode, checks all projects (returns first match)
  // In single-project mode, checks that project's platforms
  //
  // Note: In "All" mode with multiple projects using different GitHub owners,
  // only the first owner is used. This is acceptable because GitHub Sponsors
  // are per-user, not per-project. If multiple owners need support in the
  // future, this helper would need to return an array.
}
```

#### Compact View

The compact view shows unified KPIs:

| Metric | Source |
|--------|--------|
| Monthly Income | GH monthly + OC yearly/12 (approximate; tooltip explains this) |
| Total Sponsors | GH sponsors + OC backers |
| OC Balance | OC only (GH doesn't have this) |
| Sparkline | OC donation sparkline (GH doesn't provide time-series) |

When only one source is available, it shows that source's data with a small indicator.

#### Expanded View

The expanded view adds a **tab bar** below the KPIs:

1. **All Sponsors** - Merged list from both sources. Each item shows:
   - Avatar, name, tier/role, amount, "since" date
   - Small source icon (GitHub octocat or OC logo) on each row
   - Sorted by amount descending

2. **Transactions** - Existing OC transactions list (unchanged)
   - Hidden when OC is not configured

3. **Tiers** - GitHub Sponsors tiers with:
   - Tier name, monthly price, description, sponsor count
   - Hidden when GitHub is not configured

The tab bar only shows tabs that have data. If only OC is configured, it shows Sponsors (OC only) and Transactions. If only GH is configured, it shows Sponsors (GH only) and Tiers.

### Widget Descriptor Changes

The `sponsorshipDescriptor` auth config changes from requiring OC to being optional:

```typescript
auth: {
  id: "opencollective",  // Keep OC as the primary auth prompt
  // ... existing fields
}
```

The widget itself checks for both data sources and renders whatever is available. The auth in the descriptor controls what shows in settings, but the widget component handles the "either or both" logic.

## Data Merging Strategy

Merging happens **client-side in the widget component**, not in the API routes. This keeps the API routes independent and simple.

```typescript
// In the widget component:
const ocData = useOpenCollective(ocSlug);
const ghData = useGitHubSponsors(ghLogin);

// Unified KPIs
const monthlyIncome = (ghData?.stats.monthlyIncome ?? 0) + 
                      Math.round((ocData?.stats.yearlyBudget ?? 0) / 12);
const totalSponsors = (ghData?.stats.sponsorCount ?? 0) + 
                      (ocData?.stats.backersCount ?? 0);
```

For the merged sponsors list, OC members are normalized to the same display format as GH sponsors, with a `source: "oc" | "github"` field added.

## Configuration

No new configuration required. The widget derives:
- **OC slug** from existing `openCollective.slug` in platform integrations
- **GitHub login** from existing `github.owner` in platform integrations
- **Credentials** from the existing credential store (`github` and `opencollective` entries)

## Error Handling

- If GitHub token lacks `read:user` scope, the API returns a clear error message suggesting the required scope
- If the user has no sponsors listing, the GH data shows as unconfigured (graceful degradation)
- Network errors for one source don't block the other source from displaying
- Each source has independent loading/error states

## File Changes Summary

### New Files

| File | Purpose |
|------|---------|
| `packages/types/src/github-sponsors.ts` | Type definitions |
| `packages/api/src/github-sponsors.ts` | GraphQL API client |
| `packages/hooks/src/use-github-sponsors.ts` | SWR polling hook |
| `apps/app/app/api/github-sponsors/route.ts` | Next.js API route |
| `packages/widgets/src/shared/github-sponsors/index.tsx` | GH Sponsors UI components |

### Modified Files

| File | Changes |
|------|---------|
| `apps/app/lib/fetchers.ts` | Add `fetchGitHubSponsorsData()` |
| `packages/types/src/api-routes.ts` | Add `githubSponsors` route constant |
| `packages/types/package.json` | Add `"./github-sponsors": "./src/github-sponsors.ts"` to exports |
| `packages/hooks/package.json` | Add `"./use-github-sponsors": "./src/use-github-sponsors.ts"` to exports |
| `packages/api/package.json` | Add `"./github-sponsors": "./src/github-sponsors.ts"` to exports |
| `packages/widgets/src/widgets/sponsorship/index.tsx` | Merge both sources, add tabs |
| `packages/widgets/src/widgets/helpers.ts` | Add `resolveGitHubLogin()` |

Note: These packages use per-module subpath exports in `package.json` (no barrel `index.ts` files). New modules are registered by adding entries to the `"exports"` map.

## Testing Strategy

All tests use **Vitest** with manual mocks (consistent with existing test patterns in the codebase).

### API Client Tests (`packages/api/src/__tests__/github-sponsors.test.ts`)

- Mock `fetch` globally to return controlled GraphQL responses
- Test `getSponsorsOverview()` returns correctly shaped data with dollar-to-cents conversion
- Test caching: second call within TTL returns cached data without fetching
- Test error handling: HTTP errors, GraphQL errors, empty `sponsorshipsAsMaintainer`
- Test `limitedAccess` flag is set when `sponsorshipsAsMaintainer` returns empty nodes
- Test null-tier sponsorships are excluded from `monthlyIncome` calculation

### API Route Test (`apps/app/app/api/github-sponsors/route.test.ts`)

- Mock `fetchGitHubSponsorsData` and `withCache`
- Test 400 response when `login` query param is missing
- Test successful response shape
- Test `refresh=1` forces cache bypass
- Test error response on fetcher failure

### Helper Tests

- Test `resolveGitHubLogin()` with: single project, multiple projects, "All" mode, no GitHub integration configured

### Widget Merging Logic Tests

- Test unified KPIs when both sources present
- Test graceful degradation with OC-only data
- Test graceful degradation with GitHub-only data
- Test merged sponsors list sorted by amount with correct source badges
- Test tab visibility logic (tabs hidden when source unavailable)

### Manual Verification

- Verify with a real GitHub account that has GitHub Sponsors enabled
- Confirm tier data, sponsor list, and income calculations match the GitHub Sponsors dashboard

## Privacy Considerations

- GitHub Sponsors allows private sponsorships. These will NOT appear in public API queries.
- Only the authenticated user can see detailed sponsorship data (tier, amount) for their own account.
- The widget should note if viewing another user's data (limited public info only).

## Future Enhancements

- Sponsor growth trend chart (if GitHub adds time-series data to the API)
- GitHub Sponsors webhook integration for real-time updates
- Buy Me a Coffee / Ko-fi as additional sponsorship sources
- Sponsorship goal progress bar in compact view
