import type { DataSourceContext, DataSourceDescriptor } from "@radarboard/integration-sdk/types";
import { isSameDayInTimeZone } from "@radarboard/utils/timezone";
import type { OpenCollectiveConfig } from "../types";
import { getCollectiveStats, getMembers, getRecentTransactions } from "./client";

interface Transaction {
  id: string;
  type: string;
  amount: number;
  netAmount: number;
  currency: string;
  description: string;
  createdAt: string;
  fromAccount: { name: string; slug: string; imageUrl: string | null };
  toAccount: { name: string; slug: string };
}

interface OCParams {
  slug: string | null;
}

function buildSparkline(transactions: Transaction[]): { date: string; value: number }[] {
  const dailySums = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.type !== "CREDIT") continue;
    const date = tx.createdAt.split("T")[0] ?? "";
    dailySums.set(date, (dailySums.get(date) ?? 0) + tx.amount);
  }
  return Array.from(dailySums.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([date, value]) => ({ date, value }));
}

async function resolveConfig(
  ctx: DataSourceContext,
  slug: string
): Promise<OpenCollectiveConfig | null> {
  const creds = await ctx.resolveCredential("opencollective");
  if (creds?.apiToken) return { apiToken: creds.apiToken, slug };
  return null;
}

export const openCollectiveDataSource: DataSourceDescriptor<OCParams> = {
  action: "data",
  description: "Returns Open Collective overview (stats, transactions, members).",
  cacheTtlSeconds: 300,
  pollingSourceId: "sponsorship",
  parseParams: (sp) => ({ slug: sp.get("slug") }),
  buildCacheKey: (params) =>
    `open-collective:${params.slug ?? "all"}:${params.range}:${params.timeZone}`,
  async fetch(params, ctx) {
    const { slug, range, timeZone } = params;

    if (!slug) {
      return { configured: false as const };
    }

    const config = await resolveConfig(ctx, slug);
    if (!config) return { configured: false as const };

    const [account, rawTransactions, rawMembers] = await Promise.all([
      getCollectiveStats(config),
      getRecentTransactions(config, 20),
      getMembers(config, 20),
    ]);

    const mappedTransactions: Transaction[] = rawTransactions.map((tx) => ({
      id: tx.id,
      type: tx.type,
      amount: Math.abs(tx.amount.valueInCents),
      netAmount: Math.abs(tx.netAmount.valueInCents),
      currency: tx.amount.currency,
      description: tx.description,
      createdAt: tx.createdAt,
      fromAccount: tx.fromAccount ?? { name: "Unknown", slug: "", imageUrl: null },
      toAccount: tx.toAccount ?? { name: "Unknown", slug: "" },
    }));

    const recentTransactions =
      range === "today"
        ? mappedTransactions.filter((tx) => isSameDayInTimeZone(tx.createdAt, timeZone))
        : mappedTransactions;

    const topMembers = rawMembers.map((m) => ({
      id: m.id,
      role: m.role,
      tier: m.tier?.name ?? null,
      totalDonated: m.totalDonations.valueInCents,
      currency: m.totalDonations.currency,
      since: m.since,
      account: {
        name: m.account.name,
        slug: m.account.slug,
        imageUrl: m.account.imageUrl,
        type: m.account.type as "INDIVIDUAL" | "ORGANIZATION",
      },
    }));

    const sparklineData = buildSparkline(recentTransactions);

    const stats = {
      balance: account.stats.balance.valueInCents,
      totalRaised: account.stats.totalAmountReceived.valueInCents,
      totalExpenses: Math.abs(account.stats.totalAmountSpent.valueInCents),
      yearlyBudget: account.stats.yearlyBudget.valueInCents,
      currency: account.currency,
      backersCount: account.stats.contributorsCount,
      contributorsCount: account.stats.contributorsCount,
      sparklineData,
    };

    return {
      configured: true as const,
      stats,
      recentTransactions,
      topMembers,
    };
  },
};

// biome-ignore lint/suspicious/noExplicitAny: data-source descriptor requires heterogeneous type params
export const openCollectiveDataSources: DataSourceDescriptor<any, any>[] = [
  openCollectiveDataSource,
];
