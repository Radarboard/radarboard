/**
 * Sentry — Data types
 *
 * Config and API response types for the Sentry REST API.
 */

export interface SentryConfig {
  authToken: string;
  orgSlug: string;
}

export interface SentryIssue {
  id: string;
  shortId: string;
  title: string;
  culprit: string;
  level: "fatal" | "error" | "warning" | "info" | "debug";
  status: "resolved" | "unresolved" | "ignored" | "reprocessing";
  count: string;
  userCount: number;
  firstSeen: string;
  lastSeen: string;
  project: {
    id: string;
    name: string;
    slug: string;
  };
  metadata: {
    type?: string;
    value?: string;
    filename?: string;
    function?: string;
  };
  permalink: string;
  isUnhandled: boolean;
}

export interface SentryProject {
  id: string;
  name: string;
  slug: string;
  platform: string | null;
  dateCreated: string;
  status: "active" | "disabled";
}

export interface SentryStatsPoint {
  ts: number;
  count: number;
}
