/**
 * Open Collective — Data types
 *
 * Config and API response types for the Open Collective GraphQL API v2.
 */

export interface OpenCollectiveConfig {
  apiToken: string;
  slug: string;
}

// GraphQL response shapes

export interface GQLAccount {
  id: string;
  name: string;
  slug: string;
  currency: string;
  imageUrl: string | null;
  stats: {
    balance: { valueInCents: number; currency: string };
    totalAmountReceived: { valueInCents: number; currency: string };
    totalAmountSpent: { valueInCents: number; currency: string };
    yearlyBudget: { valueInCents: number; currency: string };
    contributorsCount: number;
  };
}

export interface GQLTransaction {
  id: string;
  type: "CREDIT" | "DEBIT";
  kind: string;
  amount: { valueInCents: number; currency: string };
  netAmount: { valueInCents: number; currency: string };
  description: string;
  createdAt: string;
  fromAccount: {
    name: string;
    slug: string;
    imageUrl: string | null;
  } | null;
  toAccount: {
    name: string;
    slug: string;
  } | null;
}

export interface GQLMember {
  id: string;
  role: string;
  tier: { name: string } | null;
  totalDonations: { valueInCents: number; currency: string };
  since: string;
  account: {
    name: string;
    slug: string;
    imageUrl: string | null;
    type: string;
  };
}

export interface GQLResponse<T> {
  data?: T;
  errors?: { message: string; locations?: unknown[] }[];
}
