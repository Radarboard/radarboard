/**
 * Stripe — Data Sources
 */

import type { DataSourceDescriptor } from "@radarboard/integration-sdk/types";
import type { StripeConfig } from "../types";
import { getDailyRevenue, getRecentCharges, getRevenueSummary } from "./client";

async function resolveConfig(ctx: {
  resolveCredential(key: string): Promise<Record<string, string> | null>;
}): Promise<StripeConfig | null> {
  const creds = await ctx.resolveCredential("stripe");
  if (!creds?.secretKey) return null;
  return { secretKey: creds.secretKey };
}

export const stripeRevenueSummaryDataSource: DataSourceDescriptor = {
  action: "data",
  description: "Revenue summary: MRR, monthly revenue, subscriptions, churn from Stripe.",
  cacheTtlSeconds: 300,
  async fetch(_params, ctx) {
    const config = await resolveConfig(ctx);
    if (!config) return { configured: false };
    return getRevenueSummary(config);
  },
};

export const stripeDailyRevenueDataSource: DataSourceDescriptor = {
  action: "daily-revenue",
  description: "Daily revenue aggregation for trend analysis from Stripe.",
  cacheTtlSeconds: 300,
  async fetch(_params, ctx) {
    const config = await resolveConfig(ctx);
    if (!config) return { configured: false };
    return getDailyRevenue(config);
  },
};

export const stripeChargesDataSource: DataSourceDescriptor = {
  action: "charges",
  description: "Recent charges and transactions from Stripe.",
  cacheTtlSeconds: 120,
  async fetch(_params, ctx) {
    const config = await resolveConfig(ctx);
    if (!config) return { configured: false };
    return getRecentCharges(config);
  },
};

export const stripeDataSources = [
  stripeRevenueSummaryDataSource,
  stripeDailyRevenueDataSource,
  stripeChargesDataSource,
];
