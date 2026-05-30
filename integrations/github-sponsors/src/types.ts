/**
 * GitHub Sponsors — Data types
 *
 * Config and API response types for the GitHub Sponsors GraphQL API.
 * Uses the same GitHubConfig (token) as the GitHub REST integration
 * since both authenticate with the same GitHub PAT / OAuth token.
 */

/**
 * GitHub config — just a token. Duplicated here to avoid cross-integration
 * imports. Matches the shape used by the `github` integration.
 */
export interface GitHubConfig {
  token: string;
}

export interface GitHubSponsorTier {
  id: string;
  name: string;
  /** Monthly price in cents (converted from API's monthlyPriceInDollars * 100). */
  monthlyPriceInCents: number;
  description: string;
  isOneTime: boolean;
  /** Derived: counted from sponsorshipsAsMaintainer nodes grouped by tier name. */
  sponsorCount: number;
}

export interface GitHubSponsor {
  login: string;
  name: string | null;
  avatarUrl: string;
  url: string;
  type: "USER" | "ORGANIZATION";
  tier: { name: string; monthlyPriceInCents: number } | null;
  since: string;
  isOneTime: boolean;
}

export interface GitHubSponsorStats {
  monthlyIncome: number;
  sponsorCount: number;
  currency: string;
}

export interface GitHubSponsorsOverview {
  stats: GitHubSponsorStats;
  sponsors: GitHubSponsor[];
  tiers: GitHubSponsorTier[];
  goal: { title: string; targetValue: number; percentComplete: number } | null;
  limitedAccess: boolean;
}
