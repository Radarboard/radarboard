import type { DataPoint } from "./dashboard";

export type SentryLevel = "fatal" | "error" | "warning" | "info" | "debug";

export interface SentryIssueItem {
  id: string;
  shortId: string;
  title: string;
  culprit: string;
  level: SentryLevel;
  count: number;
  userCount: number;
  firstSeen: string;
  lastSeen: string;
  projectName: string;
  projectSlug: string;
  /** Project color hex — only set in the "All projects" aggregated view. */
  projectColor?: string;
  permalink: string;
  isUnhandled: boolean;
}

export interface SentryOverview {
  unresolvedCount: number;
  issues: SentryIssueItem[];
  errorTrend: DataPoint[];
}
