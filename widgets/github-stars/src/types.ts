/**
 * GitHub Stars — Data types
 */

import type {
  GitHubStarBackfillStatus,
  GitHubStarCoverageStatus,
} from "@radarboard/types/database";
import type { WidgetTemplateConfig } from "@radarboard/widget-engine/templates";

export interface GitHubRepoSelection {
  owner: string;
  repo: string;
}

export interface GitHubRepoData {
  stars: number;
  forks: number;
  openIssues: number;
  watchers: number;
  fullName: string;
  description: string | null;
  language: string | null;
  htmlUrl: string;
  updatedAt: string;
  repoKey?: string;
  repoUrl?: string;
  starsDelta?: number;
  starsDeltaLabel?: string;
  starsDeltaColor?: string | null;
  historyPoints?: GitHubStarsHistoryPoint[];
  backfillStatus?: GitHubStarBackfillStatus;
  nextPage?: number | null;
  historyMode?: "exact" | "sampled";
  lastError?: string | null;
  trackingStartedAt?: number | null;
  lastWebhookAt?: number | null;
  coverageStatus?: GitHubStarCoverageStatus;
  coverageMessage?: string | null;
  addedPoints?: GitHubStarsAddedPoint[];
}

export interface StarHistoryPoint {
  date: string;
  stars: number;
}

export interface GitHubStarsData {
  repos: GitHubRepoData[];
  totalStars: number;
  totalForks: number;
  starHistory: StarHistoryPoint[];
  _fetchedAt?: number;
  _stale?: boolean;
}

export interface GitHubStarsHistoryPoint {
  date: string;
  totalStars: number;
  starsGained: number;
}

export interface GitHubStarsAddedPoint {
  date: string;
  count: number;
}

export interface GitHubStarsHistoryRepoMeta {
  repoKey: string;
  fullName: string;
  latestStars: number;
  backfillStatus: GitHubStarBackfillStatus;
  lastSyncedAt: number | null;
  nextPage?: number | null;
  historyMode?: "exact" | "sampled";
  lastError?: string | null;
  trackingStartedAt?: number | null;
  lastWebhookAt?: number | null;
  coverageStatus?: GitHubStarCoverageStatus;
  coverageMessage?: string | null;
}

export interface GitHubStarsHistoryData {
  aggregateDaily: GitHubStarsHistoryPoint[];
  repoDaily: Record<string, GitHubStarsHistoryPoint[]>;
  aggregateAddedDaily: GitHubStarsAddedPoint[];
  repoAddedDaily: Record<string, GitHubStarsAddedPoint[]>;
  repos: GitHubStarsHistoryRepoMeta[];
  latestSyncAt: number | null;
  _fetchedAt?: number;
  _stale?: boolean;
}

/** Per-instance widget configuration. */
export interface GitHubStarsConfig extends WidgetTemplateConfig {
  selectedRepos?: GitHubRepoSelection[];
}
