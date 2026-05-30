import type { DataPoint } from "./dashboard";

export interface SearchQuery {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  /** Project attribution (populated in "All" view) */
  projectName?: string;
  projectColor?: string;
  siteUrl?: string;
}

export interface SeoOverviewTrendRow {
  date: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface SeoOverview {
  queries: SearchQuery[];
  clicksTrend: DataPoint[];
  impressionsTrend: DataPoint[];
  ctrTrend: DataPoint[];
  positionTrend: DataPoint[];
  overviewTrend: SeoOverviewTrendRow[];
  totalClicks: number;
  totalImpressions: number;
  avgCtr: number;
  avgPosition: number;
  clicksChange: number | null;
  impressionsChange: number | null;
  ctrChange: number | null;
  positionChange: number | null;
  latestAvailableDate?: string | null;
}

export interface SeoQueryDetailRow {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

/** Per-query detail fetched for the modal — all dimensions filtered to a single query string. */
export interface SeoQueryDetail {
  /** Daily clicks & impressions trend (last 28 days). */
  clicksTrend: DataPoint[];
  impressionsTrend: DataPoint[];
  /** Daily average position trend (lower = better). */
  positionTrend: DataPoint[];
  /** Pages on the site that rank for this query. */
  pages: Array<{ page: string } & SeoQueryDetailRow>;
  /** Breakdown by device type (MOBILE / DESKTOP / TABLET). */
  devices: Array<{ device: string } & SeoQueryDetailRow>;
  /** Top countries by clicks for this query. */
  countries: Array<{ country: string } & SeoQueryDetailRow>;
}
