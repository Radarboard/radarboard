/**
 * Stripe — Data types
 */

export interface StripeConfig {
  secretKey: string;
}

export interface StripeRevenueSummary {
  /** Monthly Recurring Revenue in cents. */
  mrr: number;
  /** Total revenue this month in cents. */
  revenueThisMonth: number;
  /** Total revenue last month in cents. */
  revenueLastMonth: number;
  /** Active subscriptions count. */
  activeSubscriptions: number;
  /** New subscriptions this month. */
  newSubscriptions: number;
  /** Churned subscriptions this month. */
  churnedSubscriptions: number;
  /** Currency code (e.g. "usd"). */
  currency: string;
}

export interface StripeCharge {
  id: string;
  amount: number;
  currency: string;
  status: "succeeded" | "pending" | "failed";
  created: number;
  description: string | null;
  customer: string | null;
}

export interface StripeDailyRevenue {
  date: string;
  amount: number;
  count: number;
}
