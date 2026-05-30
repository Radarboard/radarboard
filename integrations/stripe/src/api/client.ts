/**
 * Stripe API client for the Radarboard dashboard.
 *
 * Uses the Stripe REST API at https://api.stripe.com/v1
 * Authenticated via secret key (Bearer token).
 *
 * @see https://docs.stripe.com/api
 */

import type {
  StripeCharge,
  StripeConfig,
  StripeDailyRevenue,
  StripeRevenueSummary,
} from "../types";

const BASE_URL = "https://api.stripe.com/v1";

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

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// --- Error ---

export class StripeAPIError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryable: boolean
  ) {
    super(message);
    this.name = "StripeAPIError";
  }
}

// --- Fetcher ---

async function fetchStripe<T>(
  config: StripeConfig,
  path: string,
  params?: Record<string, string>,
  cacheKey?: string
): Promise<T> {
  const key = cacheKey ?? `stripe:${path}:${JSON.stringify(params)}`;
  const cached = getCached<T>(key);
  if (cached) return cached;

  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${config.secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new StripeAPIError(
      response.status,
      `Stripe API error ${response.status}: ${errorBody.slice(0, 200)}`,
      response.status >= 500 || response.status === 429
    );
  }

  const data = (await response.json()) as T;
  setCache(key, data);
  return data;
}

// --- Stripe list response ---

interface StripeList<T> {
  object: "list";
  data: T[];
  has_more: boolean;
}

interface StripeSubscription {
  id: string;
  status: string;
  created: number;
  canceled_at: number | null;
  items: {
    data: Array<{
      plan: { amount: number; interval: string; currency: string };
    }>;
  };
}

// --- Public API ---

/**
 * Get revenue summary: MRR, monthly revenue, subscriptions.
 */
export async function getRevenueSummary(
  config: StripeConfig,
  currency = "usd"
): Promise<StripeRevenueSummary> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  // Fetch active subscriptions
  const activeSubs = await fetchStripe<StripeList<StripeSubscription>>(
    config,
    "/subscriptions",
    { status: "active", limit: "100" },
    `stripe:subs:active`
  );

  // Calculate MRR from active subscriptions
  let mrr = 0;
  for (const sub of activeSubs.data) {
    for (const item of sub.items.data) {
      if (item.plan.currency === currency) {
        if (item.plan.interval === "month") mrr += item.plan.amount;
        else if (item.plan.interval === "year") mrr += Math.round(item.plan.amount / 12);
      }
    }
  }

  // Fetch charges this month
  const chargesThisMonth = await fetchStripe<StripeList<StripeCharge>>(
    config,
    "/charges",
    {
      "created[gte]": Math.floor(startOfMonth.getTime() / 1000).toString(),
      limit: "100",
      status: "succeeded",
    },
    `stripe:charges:this-month`
  );

  // Fetch charges last month
  const chargesLastMonth = await fetchStripe<StripeList<StripeCharge>>(
    config,
    "/charges",
    {
      "created[gte]": Math.floor(startOfLastMonth.getTime() / 1000).toString(),
      "created[lt]": Math.floor(startOfMonth.getTime() / 1000).toString(),
      limit: "100",
      status: "succeeded",
    },
    `stripe:charges:last-month`
  );

  const revenueThisMonth = chargesThisMonth.data.reduce((sum, c) => sum + c.amount, 0);
  const revenueLastMonth = chargesLastMonth.data.reduce((sum, c) => sum + c.amount, 0);

  // Count new and churned subscriptions this month
  const allSubs = await fetchStripe<StripeList<StripeSubscription>>(
    config,
    "/subscriptions",
    {
      "created[gte]": Math.floor(startOfMonth.getTime() / 1000).toString(),
      limit: "100",
    },
    `stripe:subs:new-this-month`
  );

  const newSubscriptions = allSubs.data.length;
  const churnedSubscriptions = allSubs.data.filter((s) => s.canceled_at !== null).length;

  return {
    mrr,
    revenueThisMonth,
    revenueLastMonth,
    activeSubscriptions: activeSubs.data.length,
    newSubscriptions,
    churnedSubscriptions,
    currency,
  };
}

/**
 * Get recent charges.
 */
export async function getRecentCharges(config: StripeConfig, limit = 20): Promise<StripeCharge[]> {
  const result = await fetchStripe<StripeList<StripeCharge>>(config, "/charges", {
    limit: limit.toString(),
  });
  return result.data;
}

/**
 * Get daily revenue aggregation for the last N days.
 */
export async function getDailyRevenue(
  config: StripeConfig,
  days = 30
): Promise<StripeDailyRevenue[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const charges = await fetchStripe<StripeList<StripeCharge>>(
    config,
    "/charges",
    {
      "created[gte]": Math.floor(since.getTime() / 1000).toString(),
      limit: "100",
      status: "succeeded",
    },
    `stripe:daily-revenue:${days}d`
  );

  const byDate = new Map<string, { amount: number; count: number }>();
  for (const charge of charges.data) {
    const date = new Date(charge.created * 1000).toISOString().split("T")[0]!;
    const entry = byDate.get(date) ?? { amount: 0, count: 0 };
    entry.amount += charge.amount;
    entry.count += 1;
    byDate.set(date, entry);
  }

  return Array.from(byDate.entries())
    .map(([date, { amount, count }]) => ({ date, amount, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
