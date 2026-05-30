/**
 * Google Search Console — Data types
 *
 * Config and API response types for the Search Console API v1.
 */

/** OAuth2 credentials needed for the GSC API. */
export interface GSCConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

export interface SearchAnalyticsRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface SearchAnalyticsResponse {
  rows: SearchAnalyticsRow[];
  responseAggregationType: string;
}

export type SearchDimension = "query" | "page" | "country" | "device" | "date";

export interface GSCSite {
  siteUrl: string;
  permissionLevel: string;
}

export interface GSCSiteListResponse {
  siteEntry: GSCSite[];
}
