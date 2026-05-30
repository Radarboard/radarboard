/**
 * Umami — Data types
 */

export interface UmamiConfig {
  apiKey: string;
  baseUrl: string;
  websiteId: string;
}

export interface UmamiStats {
  pageviews: { value: number; prev: number };
  visitors: { value: number; prev: number };
  visits: { value: number; prev: number };
  bounces: { value: number; prev: number };
  totaltime: { value: number; prev: number };
}

export interface UmamiActiveVisitors {
  visitors: number;
}

export interface UmamiPageviewsTimeSeries {
  pageviews: Array<{ x: string; y: number }>;
  sessions: Array<{ x: string; y: number }>;
}

export interface UmamiMetric {
  x: string;
  y: number;
}

/** Re-export the shared analytics types for convenience. */
export type { AnalyticsOverview } from "@radarboard/types/analytics";
