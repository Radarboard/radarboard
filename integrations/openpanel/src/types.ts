/**
 * OpenPanel — Data types
 *
 * Config and API response types for the OpenPanel Insights + Export API.
 */

export interface OpenPanelConfig {
  clientId: string;
  clientSecret: string;
  projectId: string;
}

export interface InsightsMetrics {
  bounce_rate: number;
  unique_visitors: number;
  total_sessions: number;
  avg_session_duration: number;
  total_screen_views: number;
  views_per_session: number;
}

export interface InsightsMetricsResponse {
  metrics: InsightsMetrics;
  series: {
    date: string;
    unique_visitors: number;
    total_sessions: number;
    total_screen_views: number;
    bounce_rate: number;
    avg_session_duration: number;
    views_per_session: number;
  }[];
}

export interface LiveVisitorsResponse {
  visitors: number;
}

export interface TopPage {
  title: string;
  origin: string;
  path: string;
  sessions: number;
  bounce_rate: number;
  avg_duration: number;
}

export interface ManagedProject {
  id: string;
  organizationId: string;
}

export interface ManagedProjectListItem {
  id: string;
  name: string | null;
  organizationId: string | null;
}

export interface ReferrerItem {
  name: string;
  sessions: number;
  bounce_rate: number;
  avg_session_duration: number;
}

export interface CountryItem {
  name: string;
  sessions: number;
  bounce_rate: number;
  avg_session_duration: number;
}
