/** A sponsorship tier on GitHub Sponsors. */
export interface GitHubSponsorTier {
  id: string;
  name: string;
  /** Monthly price in cents (converted from API's monthlyPriceInDollars * 100). */
  monthlyPriceInCents: number;
  description: string;
  isOneTime: boolean;
  /**
   * Number of active sponsors at this tier.
   * Derived: counted from sponsorshipsAsMaintainer nodes grouped by tier name.
   */
  sponsorCount: number;
}

/** A single GitHub sponsor (user or organization). */
export interface GitHubSponsor {
  login: string;
  name: string | null;
  avatarUrl: string;
  url: string;
  /** "USER" or "ORGANIZATION" */
  type: "USER" | "ORGANIZATION";
  tier: {
    name: string;
    /** Monthly price in cents. */
    monthlyPriceInCents: number;
  } | null;
  /** ISO 8601 date string for when the sponsorship started. */
  since: string;
  isOneTime: boolean;
}

/** Aggregate sponsorship statistics from GitHub Sponsors. */
export interface GitHubSponsorStats {
  /**
   * Estimated monthly income in cents.
   * Sum of tier.monthlyPriceInDollars * 100 for active, non-one-time sponsorships.
   * Sponsorships with null tier are excluded (amount not available via API).
   */
  monthlyIncome: number;
  /** Total active sponsor count (from sponsors.totalCount). */
  sponsorCount: number;
  /** Currency code — GitHub Sponsors uses USD. */
  currency: string;
}

/** Full overview returned to widgets. */
export interface GitHubSponsorsOverview {
  stats: GitHubSponsorStats;
  sponsors: GitHubSponsor[];
  tiers: GitHubSponsorTier[];
  /** Active goal if set on the sponsors listing. */
  goal: {
    title: string;
    targetValue: number;
    percentComplete: number;
  } | null;
  /**
   * True when querying another user's data (no access to sponsorshipsAsMaintainer).
   * In this case, monthlyIncome will be 0 and per-sponsor tier info unavailable.
   */
  limitedAccess: boolean;
}
