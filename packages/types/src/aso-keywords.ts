/**
 * ASO (App Store Optimization) keyword ranking types.
 * Data sourced from the Astro MCP server via get_app_keywords.
 */

/** A single tracked keyword and its current ranking data. */
export interface AsoKeyword {
  /** The keyword string. */
  keyword: string;
  /** Current ranking position (1–based). 1000 = not in top results. */
  currentRanking: number;
  /** Ranking from the previous check. */
  previousRanking: number;
  /** Change = previousRanking - currentRanking (positive = improved). */
  rankingChange: number;
  /** Keyword difficulty score (0–100). Higher = harder to rank for. */
  difficulty: number;
  /** Search popularity score (0–100). Higher = more searches. */
  popularity: number;
  /** Number of apps competing for this keyword. */
  appsCount: number;
  /** ISO timestamp of the last update from Astro. */
  lastUpdate: string;
  /** Store country code (e.g. "us", "jp"). */
  store: string;
}

/** Summary stats derived from the full keyword set. */
export interface AsoKeywordsSummary {
  /** Total keywords tracked. */
  total: number;
  /** Keywords ranked #1 — the most valuable position. */
  top1: number;
  /** Keywords ranked #2. */
  top2: number;
  /** Keywords ranked #3. */
  top3: number;
  /** Keywords ranked in top 10. */
  top10: number;
  /** Keywords ranked in top 50. */
  top50: number;
  /** Keywords that improved in ranking since last check. */
  improving: number;
  /** Keywords that declined in ranking since last check. */
  declining: number;
  /** Average ranking across all ranked keywords (excludes 1000). */
  avgRanking: number;
}

/** Full response from GET /api/aso-keywords */
export interface AsoKeywordsData {
  /** App identifier as configured on the project. */
  appId: string;
  /**
   * Currently applied store filter, or undefined when all stores are returned.
   * Each keyword carries its own `store` field.
   */
  store?: string;
  /** All distinct store codes present in the returned keyword set. */
  availableStores: string[];
  /** All tracked keywords sorted by currentRanking asc, then store asc, then keyword asc. */
  keywords: AsoKeyword[];
  /** Derived summary stats. */
  summary: AsoKeywordsSummary;
  /**
   * Most recent `lastUpdate` timestamp across all returned keywords.
   * Astro refreshes keyword data once every ~24h due to Apple API limits.
   */
  lastAstroUpdate?: string;
  /** Whether the MCP server is configured for this project. */
  configured: boolean;
  _fetchedAt?: number;
  _stale?: boolean;
}
