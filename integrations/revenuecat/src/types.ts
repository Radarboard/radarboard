/**
 * RevenueCat — Data types
 *
 * Config and API response types for the RevenueCat API v2.
 */

export interface RevenueCatConfig {
  apiKey: string;
  projectId: string;
}

export interface OverviewMetric {
  object: "overview_metric";
  id: string;
  name: string;
  description: string;
  unit: string;
  period: string;
  value: number;
  last_updated_at: number;
  last_updated_at_iso8601: string;
}

export interface OverviewMetricsResponse {
  object: "overview_metrics";
  metrics: OverviewMetric[];
}

export interface ChartSegment {
  id: string;
  display_name: string;
}

export interface ChartDataResponse {
  object: "chart_data";
  category: string;
  display_type: string;
  display_name: string;
  description: string;
  last_computed_at: number;
  start_date: number;
  end_date: number;
  yaxis_currency: string;
  resolution: string;
  values: number[][];
  summary: Record<string, unknown>;
  yaxis: string;
  segments: ChartSegment[];
  measures: Record<string, unknown>[];
}

export interface ChartOptionsResponse {
  object: "chart_options";
  resolutions: { id: string; display_name: string }[];
  segments: { id: string; display_name: string; group_display_name: string }[];
  filters: {
    id: string;
    display_name: string;
    group_display_name: string;
    options: { id: string; display_name: string }[];
  }[];
}

export type ChartName =
  | "revenue"
  | "mrr"
  | "arr"
  | "actives"
  | "actives_movement"
  | "actives_new"
  | "churn"
  | "conversion_to_paying"
  | "customers_new"
  | "ltv_per_customer"
  | "ltv_per_paying_customer";

export type Currency =
  | "USD"
  | "EUR"
  | "GBP"
  | "AUD"
  | "CAD"
  | "JPY"
  | "BRL"
  | "KRW"
  | "CNY"
  | "MXN";
