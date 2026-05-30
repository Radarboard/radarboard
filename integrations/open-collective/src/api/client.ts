/**
 * Open Collective GraphQL API v2 client for the Radarboard dashboard.
 *
 * Uses the GraphQL API at https://api.opencollective.com/graphql/v2
 * with a personal token for authentication (Personal-Token header).
 *
 * All responses are cached server-side for 5 minutes.
 *
 * @see https://documentation.opencollective.com/development/personel-tokens
 * @see https://graphql-docs-v2.opencollective.com
 */

import type {
  GQLAccount,
  GQLMember,
  GQLResponse,
  GQLTransaction,
  OpenCollectiveConfig,
} from "../types";

const GRAPHQL_URL = "https://api.opencollective.com/graphql/v2";

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

// --- API Client ---

export class OpenCollectiveAPIError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryable: boolean
  ) {
    super(message);
    this.name = "OpenCollectiveAPIError";
  }
}

async function fetchOC<T>(
  config: OpenCollectiveConfig,
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
      "Personal-Token": config.apiToken,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new OpenCollectiveAPIError(
      response.status,
      `HTTP ${response.status}: ${response.statusText}`,
      response.status >= 500 || response.status === 429
    );
  }

  const json = (await response.json()) as GQLResponse<T>;

  if (json.errors?.length) {
    const message = json.errors.map((e) => e.message).join("; ");
    throw new OpenCollectiveAPIError(200, `GraphQL error: ${message}`, false);
  }

  if (!json.data) {
    throw new OpenCollectiveAPIError(200, "No data returned from GraphQL", false);
  }

  setCache(cacheKey, json.data, cacheTtlMs);
  return json.data;
}

// --- GraphQL Queries ---

const STATS_QUERY = `
  query CollectiveStats($slug: String!) {
    account(slug: $slug) {
      id
      name
      slug
      currency
      imageUrl
      stats {
        balance {
          valueInCents
          currency
        }
        totalAmountReceived {
          valueInCents
          currency
        }
        totalAmountSpent {
          valueInCents
          currency
        }
        yearlyBudget {
          valueInCents
          currency
        }
        contributorsCount
      }
    }
  }
`;

const TRANSACTIONS_QUERY = `
  query CollectiveTransactions($slug: String!, $limit: Int!) {
    transactions(account: { slug: $slug }, limit: $limit, orderBy: { field: CREATED_AT, direction: DESC }) {
      nodes {
        id
        type
        kind
        amount {
          valueInCents
          currency
        }
        netAmount {
          valueInCents
          currency
        }
        description
        createdAt
        fromAccount {
          name
          slug
          imageUrl
        }
        toAccount {
          name
          slug
        }
      }
    }
  }
`;

const MEMBERS_QUERY = `
  query CollectiveMembers($slug: String!, $limit: Int!) {
    account(slug: $slug) {
      members(role: BACKER, limit: $limit, orderBy: { field: CREATED_AT, direction: DESC }) {
        nodes {
          id
          role
          tier {
            name
          }
          totalDonations {
            valueInCents
            currency
          }
          since
          account {
            name
            slug
            imageUrl
            type
          }
        }
      }
    }
  }
`;

// --- Public API ---

/**
 * Get collective financial stats (balance, total raised, budget, member counts).
 *
 * Cache TTL: 5 minutes
 */
export async function getCollectiveStats(config: OpenCollectiveConfig): Promise<GQLAccount> {
  const cacheKey = `oc:stats:${config.slug}`;
  const data = await fetchOC<{ account: GQLAccount }>(
    config,
    STATS_QUERY,
    { slug: config.slug },
    cacheKey
  );
  return data.account;
}

/**
 * Get recent transactions (contributions and expenses).
 *
 * Cache TTL: 5 minutes
 */
export async function getRecentTransactions(
  config: OpenCollectiveConfig,
  limit = 10
): Promise<GQLTransaction[]> {
  const cacheKey = `oc:transactions:${config.slug}:${limit}`;
  const data = await fetchOC<{ transactions: { nodes: GQLTransaction[] } }>(
    config,
    TRANSACTIONS_QUERY,
    { slug: config.slug, limit },
    cacheKey
  );
  return data.transactions.nodes;
}

/**
 * Get top backers/members sorted by total donated.
 *
 * Cache TTL: 5 minutes
 */
export async function getMembers(config: OpenCollectiveConfig, limit = 20): Promise<GQLMember[]> {
  const cacheKey = `oc:members:${config.slug}:${limit}`;
  const data = await fetchOC<{ account: { members: { nodes: GQLMember[] } } }>(
    config,
    MEMBERS_QUERY,
    { slug: config.slug, limit },
    cacheKey
  );
  return data.account.members.nodes;
}
