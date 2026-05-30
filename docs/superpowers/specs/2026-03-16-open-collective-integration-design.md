# Open Collective Integration Design

**Date:** 2026-03-16
**Status:** Approved

## Overview

Add Open Collective as an integration to the Radarboard dashboard. This provides financial overview (balance, total raised, expenses), recent transactions (contributions and expenses), and contributor/backer information for any project that has an Open Collective page.

The first project to use this integration is **Front-End Checklist** (`front-end-checklist` on Open Collective).

## API Strategy

Use the **Open Collective GraphQL API v2** at `https://api.opencollective.com/graphql/v2`, authenticated with a personal token (`Personal-Token` header). The token requires the `account` scope only.

A single personal token is stored as an env var. The collective slug is per-project, configured in `PlatformIntegrations`.

## Architecture

Follows the established integration pattern (similar to RevenueCat, with one deviation: `createConfigFromEnv(slug)` takes a slug parameter since the slug is per-project, not an env var):

```
Types -> API Client -> API Route -> React Hook -> Widget
```

### Layer 1: Types (`packages/types/src/open-collective.ts`)

```typescript
import type { DataPoint } from "./dashboard";

export interface OpenCollectiveStats {
  balance: number;          // current balance in cents
  totalRaised: number;      // lifetime contributions in cents
  totalExpenses: number;    // lifetime expenses in cents
  yearlyBudget: number;     // projected annual budget in cents
  currency: string;
  backersCount: number;
  contributorsCount: number;
  sparklineData: DataPoint[]; // derived from recent CREDIT transactions (last 14 daily sums)
}

export interface OpenCollectiveTransaction {
  id: string;
  type: "CREDIT" | "DEBIT";
  amount: number;
  netAmount: number;
  currency: string;
  description: string;
  createdAt: string;
  fromAccount: {
    name: string;
    slug: string;
    imageUrl: string | null;
  };
  toAccount: {
    name: string;
    slug: string;
  };
}

export interface OpenCollectiveMember {
  id: string;
  role: "BACKER" | "ADMIN" | "MEMBER" | "CONTRIBUTOR";
  tier: string | null;
  totalDonated: number;
  currency: string;
  since: string;
  account: {
    name: string;
    slug: string;
    imageUrl: string | null;
    type: "INDIVIDUAL" | "ORGANIZATION";
  };
}

export interface OpenCollectiveOverview {
  stats: OpenCollectiveStats;
  recentTransactions: OpenCollectiveTransaction[];
  topMembers: OpenCollectiveMember[];
}
```

Add to `PlatformIntegrations` in `packages/types/src/project.ts`:

```typescript
openCollective?: {
  slug: string;
};
```

### Layer 2: API Client (`packages/api/src/opencollective.ts`)

- **Config:** `OpenCollectiveConfig { apiToken: string; slug: string }`
- **`createConfigFromEnv(slug)`:** reads `OPENCOLLECTIVE_API_TOKEN` from env, takes slug as parameter. Returns `OpenCollectiveConfig | null` (null if token is missing). Deviates from RevenueCat pattern because the slug is per-project config, not an env var.
- **Caching:** in-memory Map with 5-minute TTL (same as RevenueCat)
- **Error class:** `OpenCollectiveAPIError`
- **Core function:** `fetchOC<T>(config, query, variables, cacheKey)` sends POST to GraphQL endpoint
- **Public functions:**
  - `getCollectiveStats(config)` -- account stats (balance, raised, budget, member counts)
  - `getRecentTransactions(config, limit = 10)` -- latest transactions
  - `getMembers(config, limit = 20)` -- top backers sorted by total donated

Export via `package.json`: `"./opencollective": "./src/opencollective.ts"`

### Layer 3: API Route (`apps/app/app/api/open-collective/route.ts`)

- `GET /api/open-collective?slug=front-end-checklist`
- Calls `createConfigFromEnv(slug)` -- returns `{ error: "Open Collective not configured", configured: false }` with status 200 if token missing
- Fetches stats, transactions, members in parallel via `Promise.all`
- On success: returns `{ configured: true, ...OpenCollectiveOverview }`
- On error: returns `{ error: message, configured: true }` with status 500 (matches RevenueCat error pattern)

### Layer 4: React Hook (`packages/hooks/src/use-open-collective.ts`)

- `"use client"` directive at top of file
- `useOpenCollective(slug: string)` hook
- Fetches from `/api/open-collective?slug=...`
- Polls every 5 minutes
- Returns `{ data: OpenCollectiveOverview | null, configured: boolean, loading: boolean, error: string | null, refetch: () => void }`

### Layer 5: Widget (`packages/widgets/src/open-collective.tsx`)

Dedicated "Open Collective" `WidgetCard` with three sections:

1. **Financial KPIs** -- Balance, Total Raised, Yearly Budget, Backers Count (styled like `RevenueKPICard`)
2. **Recent Transactions** -- scrollable list with type indicator, amount, contributor name, relative time
3. **Top Contributors** -- list with avatar, name, tier badge, total donated

Bloomberg-terminal dark theme consistent with existing widgets.

### Layer 6: Project Configuration

Add "Front-End Checklist" project to `apps/app/config/projects.ts`:

```typescript
{
  id: "front-end-checklist",
  name: "Front-End Checklist",
  slug: "front-end-checklist",
  color: "#4FC08D",
  description: "The perfect Front-End Checklist for modern websites",
  platforms: [
    {
      id: "front-end-checklist-oc",
      name: "Open Collective",
      type: "website",
      integrations: {
        openCollective: {
          slug: "front-end-checklist",
        },
      },
    },
  ],
}
```

### Environment Variables

Only one env var needed (token is shared across all projects):

```
OPENCOLLECTIVE_API_TOKEN=   # Personal token from opencollective.com settings
```

Added to `apps/app/.env.example`.

## Rate Limits and Caching

The Open Collective GraphQL API v2 uses complexity-based rate limiting. Our queries are simple (single account lookups with small limits), so we are unlikely to hit limits. As a safeguard, all responses are cached in-memory for 5 minutes (same as RevenueCat), and the dashboard polls every 5 minutes, so at most one API call per polling interval.

## Files Changed

| File | Action |
|---|---|
| `packages/types/src/open-collective.ts` | Create |
| `packages/types/src/project.ts` | Edit (add `openCollective` to `PlatformIntegrations`) |
| `packages/types/package.json` | Edit (add `"./open-collective": "./src/open-collective.ts"` export) |
| `packages/api/src/opencollective.ts` | Create |
| `packages/api/package.json` | Edit (add export) |
| `apps/app/app/api/open-collective/route.ts` | Create |
| `packages/hooks/src/use-open-collective.ts` | Create |
| `packages/hooks/package.json` | Edit (add export) |
| `packages/widgets/src/open-collective.tsx` | Create |
| `packages/widgets/package.json` | Edit (add `"./open-collective"` export) |
| `apps/app/config/projects.ts` | Edit (add Front-End Checklist project) |
| `apps/app/.env.example` | Edit (add `OPENCOLLECTIVE_API_TOKEN`) |
| `apps/app/lib/mock-data.ts` | Edit (add OC mock data) |
