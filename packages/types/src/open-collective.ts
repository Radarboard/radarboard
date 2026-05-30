import type { DataPoint } from "./dashboard";

/** Financial overview for the collective */
export interface OpenCollectiveStats {
  /** Current balance in cents */
  balance: number;
  /** Lifetime contributions received in cents */
  totalRaised: number;
  /** Lifetime expenses paid out in cents */
  totalExpenses: number;
  /** Projected annual budget in cents */
  yearlyBudget: number;
  /** Currency code (e.g. "USD") */
  currency: string;
  /** Number of financial backers */
  backersCount: number;
  /** Number of contributors (code, docs, etc.) */
  contributorsCount: number;
  /** Sparkline derived from recent CREDIT transactions (last 14 daily sums) */
  sparklineData: DataPoint[];
}

/** A single transaction (contribution or expense) */
export interface OpenCollectiveTransaction {
  id: string;
  /** CREDIT = donation in, DEBIT = expense out */
  type: "CREDIT" | "DEBIT";
  /** Amount in cents */
  amount: number;
  /** Amount after fees, in cents */
  netAmount: number;
  currency: string;
  description: string;
  /** ISO 8601 date string */
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

/** A backer, sponsor, or contributor */
export interface OpenCollectiveMember {
  id: string;
  role: "BACKER" | "ADMIN" | "MEMBER" | "CONTRIBUTOR";
  tier: string | null;
  /** Total amount donated in cents */
  totalDonated: number;
  currency: string;
  /** ISO 8601 date string for when they joined */
  since: string;
  account: {
    name: string;
    slug: string;
    imageUrl: string | null;
    type: "INDIVIDUAL" | "ORGANIZATION";
  };
}

/** Full overview returned to widgets */
export interface OpenCollectiveOverview {
  stats: OpenCollectiveStats;
  recentTransactions: OpenCollectiveTransaction[];
  topMembers: OpenCollectiveMember[];
}
