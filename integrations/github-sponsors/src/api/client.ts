/**
 * GitHub Sponsors GraphQL API client for the Radarboard dashboard.
 *
 * Uses the GraphQL API v4 at https://api.github.com/graphql
 * authenticated with the existing GitHub PAT (Bearer token).
 * The token needs `read:user` scope for sponsorship data.
 *
 * This is a **self-contained GraphQL client**, separate from the REST
 * client in the `github` integration. It follows the same structural
 * pattern as other API clients (own fetch helper, in-memory cache, error class).
 *
 * Cache TTL: 5 minutes (sponsorship data changes less frequently than
 * PRs/issues, so this is intentionally longer than the 2-min TTL in
 * the REST `github` client).
 *
 * Rate limiting: GitHub GraphQL API uses a point-based rate limit
 * (5,000 points/hour). The single query here costs ~60 points per call.
 * With 5-min caching, max consumption is ~720 points/hour.
 *
 * @see https://docs.github.com/en/graphql
 * @see https://docs.github.com/en/sponsors
 */

import type {
  GitHubConfig,
  GitHubSponsor,
  GitHubSponsorsOverview,
  GitHubSponsorTier,
} from "../types";

const GRAPHQL_URL = "https://api.github.com/graphql";

// --- Cache ---

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

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

/** Clear the in-memory cache (e.g. after token changes). */
export function evictSponsorsCache(): void {
  cache.clear();
}

// --- Error ---

export class GitHubSponsorsAPIError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryable: boolean
  ) {
    super(message);
    this.name = "GitHubSponsorsAPIError";
  }
}

// --- GraphQL Query ---

const SPONSORS_OVERVIEW_QUERY = `
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
`;

/**
 * Minimal fallback query that works with just `repo` scope (no `read:user`).
 * Only fetches sponsor count and has-sponsors-listing info.
 */
const SPONSORS_FALLBACK_QUERY = `
  query SponsorsFallback($login: String!) {
    user(login: $login) {
      hasSponsorsListing
      sponsors(first: 0) {
        totalCount
      }
    }
  }
`;

interface GQLFallbackData {
  user: {
    hasSponsorsListing: boolean;
    sponsors: { totalCount: number };
  } | null;
}

// --- Internal GraphQL Response Types ---

interface GQLGoal {
  title: string;
  targetValue: number;
  percentComplete: number;
}

interface GQLTierNode {
  id: string;
  name: string;
  monthlyPriceInDollars: number;
  description: string;
  isOneTime: boolean;
}

interface GQLSponsorNode {
  login: string;
  name: string | null;
  avatarUrl: string;
  url: string;
}

interface GQLSponsorshipNode {
  sponsorEntity: GQLSponsorNode | null;
  tier: {
    name: string;
    monthlyPriceInDollars: number;
  } | null;
  createdAt: string;
  isOneTimePayment: boolean;
}

interface GQLSponsorsOverviewData {
  user: {
    sponsorsListing: {
      fullDescription: string;
      activeGoal: GQLGoal | null;
      tiers: { nodes: GQLTierNode[] };
    } | null;
    sponsors: {
      totalCount: number;
      nodes: GQLSponsorNode[];
    };
    sponsorshipsAsMaintainer: {
      totalCount: number;
      nodes: GQLSponsorshipNode[];
    };
  } | null;
}

interface GQLResponse<T> {
  data?: T;
  errors?: { message: string; type?: string }[];
}

// --- Internal Fetch ---

async function fetchGHGraphQL<T>(
  config: GitHubConfig,
  query: string,
  variables: Record<string, unknown>,
  cacheKey: string,
  cacheTtlMs = CACHE_TTL_MS
): Promise<T> {
  const cached = getCached<T>(cacheKey);
  if (cached) return cached;

  const response = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.token}`,
      "User-Agent": "radarboard",
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new GitHubSponsorsAPIError(
      response.status,
      `GitHub GraphQL API error ${response.status}: ${body}`,
      response.status >= 500 || response.status === 429
    );
  }

  const json = (await response.json()) as GQLResponse<T>;

  if (json.errors?.length) {
    const message = json.errors.map((e) => e.message).join("; ");

    // Check for insufficient scope errors
    if (message.includes("insufficient") || message.includes("scope")) {
      throw new GitHubSponsorsAPIError(
        403,
        `GitHub token may lack required scope (read:user). ${message}`,
        false
      );
    }

    throw new GitHubSponsorsAPIError(200, `GraphQL error: ${message}`, false);
  }

  if (!json.data) {
    throw new GitHubSponsorsAPIError(200, "No data returned from GraphQL", false);
  }

  setCache(cacheKey, json.data, cacheTtlMs);
  return json.data;
}

// --- Transform Helpers ---

/**
 * Build the sponsors list from sponsorshipsAsMaintainer (detailed) data.
 * Falls back to the public sponsors list when sponsorshipsAsMaintainer is empty.
 */
function buildSponsors(
  sponsorships: GQLSponsorshipNode[],
  publicSponsors: GQLSponsorNode[]
): GitHubSponsor[] {
  // If we have detailed sponsorship data, use it
  if (sponsorships.length > 0) {
    return sponsorships
      .filter(
        (s): s is GQLSponsorshipNode & { sponsorEntity: GQLSponsorNode } => s.sponsorEntity !== null
      )
      .map((s) => ({
        login: s.sponsorEntity.login,
        name: s.sponsorEntity.name,
        avatarUrl: s.sponsorEntity.avatarUrl,
        url: s.sponsorEntity.url,
        type: "USER" as const, // GraphQL union doesn't expose __typename by default
        tier: s.tier
          ? {
              name: s.tier.name,
              monthlyPriceInCents: Math.round(s.tier.monthlyPriceInDollars * 100),
            }
          : null,
        since: s.createdAt,
        isOneTime: s.isOneTimePayment,
      }));
  }

  // Fallback: public sponsors (no tier/amount data)
  return publicSponsors.map((s) => ({
    login: s.login,
    name: s.name,
    avatarUrl: s.avatarUrl,
    url: s.url,
    type: "USER" as const,
    tier: null,
    since: "",
    isOneTime: false,
  }));
}

/**
 * Calculate monthly income from detailed sponsorships.
 * Only includes recurring (non-one-time) sponsorships with a known tier.
 * Sponsorships with null tier are excluded — their amount is not available via the API.
 */
function calculateMonthlyIncome(sponsorships: GQLSponsorshipNode[]): number {
  let totalCents = 0;
  for (const s of sponsorships) {
    if (s.isOneTimePayment) continue;
    if (!s.tier) continue; // null-tier: custom amount not available via API
    totalCents += Math.round(s.tier.monthlyPriceInDollars * 100);
  }
  return totalCents;
}

/**
 * Build tier list with derived sponsor counts.
 * The sponsor count per tier is derived by counting sponsorshipsAsMaintainer
 * nodes grouped by tier name.
 */
function buildTiers(
  gqlTiers: GQLTierNode[],
  sponsorships: GQLSponsorshipNode[]
): GitHubSponsorTier[] {
  // Count sponsors per tier name
  const tierCounts = new Map<string, number>();
  for (const s of sponsorships) {
    if (s.tier) {
      tierCounts.set(s.tier.name, (tierCounts.get(s.tier.name) ?? 0) + 1);
    }
  }

  return gqlTiers.map((t) => ({
    id: t.id,
    name: t.name,
    monthlyPriceInCents: Math.round(t.monthlyPriceInDollars * 100),
    description: t.description,
    isOneTime: t.isOneTime,
    sponsorCount: tierCounts.get(t.name) ?? 0,
  }));
}

// --- Public API ---

/**
 * Get a full GitHub Sponsors overview for a user/org.
 *
 * Returns sponsors list, tiers, stats, and active goal.
 * When querying another user's account (not the PAT owner),
 * `limitedAccess` will be true and monthly income will be 0.
 *
 * Cache TTL: 5 minutes
 */
export async function getSponsorsOverview(
  config: GitHubConfig,
  login: string,
  first = 30
): Promise<GitHubSponsorsOverview> {
  const cacheKey = `gh-sponsors:${login}:${first}`;

  try {
    const data = await fetchGHGraphQL<GQLSponsorsOverviewData>(
      config,
      SPONSORS_OVERVIEW_QUERY,
      { login, first },
      cacheKey
    );
    return transformFullResponse(data);
  } catch (error) {
    // If the error is a scope issue, try the minimal fallback query
    if (error instanceof GitHubSponsorsAPIError && error.status === 403) {
      return tryFallbackQuery(config, login, cacheKey);
    }
    throw error;
  }
}

function transformFullResponse(data: GQLSponsorsOverviewData): GitHubSponsorsOverview {
  const user = data.user;
  if (!user) {
    return {
      stats: { monthlyIncome: 0, sponsorCount: 0, currency: "USD" },
      sponsors: [],
      tiers: [],
      goal: null,
      limitedAccess: true,
    };
  }

  const sponsorships = user.sponsorshipsAsMaintainer.nodes;
  const publicSponsors = user.sponsors.nodes;
  const gqlTiers = user.sponsorsListing?.tiers.nodes ?? [];
  const limitedAccess = sponsorships.length === 0 && user.sponsors.totalCount > 0;

  return {
    stats: {
      monthlyIncome: calculateMonthlyIncome(sponsorships),
      sponsorCount: user.sponsors.totalCount,
      currency: "USD",
    },
    sponsors: buildSponsors(sponsorships, publicSponsors),
    tiers: buildTiers(gqlTiers, sponsorships),
    goal: user.sponsorsListing?.activeGoal ?? null,
    limitedAccess,
  };
}

/**
 * Fallback query using only `repo` scope (no `read:user`).
 * Returns limited data: sponsor count and has-listing flag.
 */
async function tryFallbackQuery(
  config: GitHubConfig,
  login: string,
  cacheKey: string
): Promise<GitHubSponsorsOverview> {
  try {
    const data = await fetchGHGraphQL<GQLFallbackData>(
      config,
      SPONSORS_FALLBACK_QUERY,
      { login },
      `${cacheKey}:fallback`
    );

    const user = data.user;
    if (!user || !user.hasSponsorsListing) {
      // No sponsors listing -> not "limited access", just no sponsors data
      return {
        stats: { monthlyIncome: 0, sponsorCount: 0, currency: "USD" },
        sponsors: [],
        tiers: [],
        goal: null,
        limitedAccess: false,
      };
    }

    // Has a sponsors listing but we can't see details -> limited access
    return {
      stats: {
        monthlyIncome: 0,
        sponsorCount: user.sponsors.totalCount,
        currency: "USD",
      },
      sponsors: [],
      tiers: [],
      goal: null,
      limitedAccess: true,
    };
  } catch {
    // Can't even run the fallback query -> not limited access, just broken
    return {
      stats: { monthlyIncome: 0, sponsorCount: 0, currency: "USD" },
      sponsors: [],
      tiers: [],
      goal: null,
      limitedAccess: false,
    };
  }
}
