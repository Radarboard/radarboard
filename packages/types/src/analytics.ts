import type { DataPoint } from "./dashboard";

export interface AnalyticsMetrics {
  uniqueVisitors: number;
  totalSessions: number;
  totalPageViews: number;
  bounceRate: number;
  avgSessionDuration: number;
}

export interface TopPage {
  path: string;
  title: string;
  sessions: number;
  bounceRate: number;
  avgDuration: number;
  openPanelUrl?: string;
  /** Platform/project attribution (populated in "All" view) */
  projectName?: string;
  projectColor?: string;
  platformName?: string;
}

/** Per-platform metric breakdown for KPI tooltips in "All" view */
export interface PlatformMetrics {
  platformId: string;
  platformName: string;
  projectName: string;
  projectColor: string;
  uniqueVisitors: number;
  totalSessions: number;
  totalPageViews: number;
  bounceRate: number;
  avgSessionDuration: number;
  liveVisitors: number;
}

export interface ReferrerData {
  name: string;
  sessions: number;
  bounceRate: number;
}

export interface AnalyticsOverview {
  liveVisitors: number;
  metrics: AnalyticsMetrics;
  topPages: TopPage[];
  referrers: ReferrerData[];
  visitorTrend: DataPoint[];
  /** Per-platform breakdown for KPI tooltips (populated in "All" view) */
  platformBreakdown?: PlatformMetrics[];
}
