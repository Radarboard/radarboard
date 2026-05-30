/**
 * GitHub — Delta detectors
 *
 * Accept the domain types from @radarboard/types/github-activity so route
 * handlers can call detect() directly on the data they already have —
 * no raw API reconstruction required.
 */

import type { DeltaDetector, IntegrationEvent } from "@radarboard/integration-sdk/types";
import type { GitHubOpenIssueItem, GitHubOpenPRItem } from "@radarboard/types/github-activity";

// ---------------------------------------------------------------------------
// PR delta
// ---------------------------------------------------------------------------

interface PREntry {
  seen: boolean;
  merged: boolean;
}

const prState = new Map<number, PREntry>();
let prBootstrapped = false;

export const githubPrDelta: DeltaDetector<GitHubOpenPRItem[]> = {
  detect(current, projectSlug) {
    if (!prBootstrapped) {
      for (const pr of current) prState.set(pr.number, { seen: true, merged: false });
      prBootstrapped = true;
      return [];
    }

    const events: IntegrationEvent[] = [];
    for (const pr of current) {
      if (!prState.has(pr.number)) {
        prState.set(pr.number, { seen: true, merged: false });
        events.push({
          source: "github",
          sourceEventId: `github:pr:${pr.number}:opened`,
          type: "pr.opened",
          severity: "info",
          projectSlug,
          title: `PR #${pr.number} opened: ${pr.title}`,
          body: `by @${pr.user.login} · ${pr.repo}`,
          metadata: { url: pr.htmlUrl, repo: pr.repo, author: pr.user.login },
          occurredAt: Math.floor(new Date(pr.createdAt).getTime() / 1000),
        });
      }
    }
    return events;
  },
};

// ---------------------------------------------------------------------------
// Issue delta
// ---------------------------------------------------------------------------

const issueIds = new Set<number>();
let issueBootstrapped = false;

export const githubIssueDelta: DeltaDetector<GitHubOpenIssueItem[]> = {
  detect(current, projectSlug) {
    if (!issueBootstrapped) {
      for (const issue of current) issueIds.add(issue.number);
      issueBootstrapped = true;
      return [];
    }

    const events: IntegrationEvent[] = [];
    for (const issue of current) {
      if (!issueIds.has(issue.number)) {
        issueIds.add(issue.number);
        events.push({
          source: "github",
          sourceEventId: `github:issue:${issue.number}:opened`,
          type: "issue.opened",
          severity: "info",
          projectSlug,
          title: `Issue #${issue.number} opened: ${issue.title}`,
          body: `by @${issue.user.login} · ${issue.repo}`,
          metadata: { url: issue.htmlUrl, repo: issue.repo, author: issue.user.login },
          occurredAt: Math.floor(new Date(issue.createdAt).getTime() / 1000),
        });
      }
    }
    return events;
  },
};

// ---------------------------------------------------------------------------
// Star delta — accepts simple counter shape
// ---------------------------------------------------------------------------

export interface GitHubStarSnapshot {
  repo: string;
  stargazersCount: number;
}

let previousStarCount: number | null = null;

export const githubStarDelta: DeltaDetector<GitHubStarSnapshot> = {
  detect(current, projectSlug) {
    if (previousStarCount === null) {
      previousStarCount = current.stargazersCount;
      return [];
    }
    const delta = current.stargazersCount - previousStarCount;
    previousStarCount = current.stargazersCount;
    if (delta <= 0) return [];
    return [
      {
        source: "github",
        sourceEventId: `github:stars:${current.repo}:${current.stargazersCount}`,
        type: "star.received",
        severity: "info",
        projectSlug,
        title: `${current.repo} gained ${delta} new star${delta > 1 ? "s" : ""} (${current.stargazersCount} total)`,
        metadata: { repo: current.repo, delta, total: current.stargazersCount },
      },
    ];
  },
};

export function resetGithubDeltaState(): void {
  prState.clear();
  prBootstrapped = false;
  issueIds.clear();
  issueBootstrapped = false;
  previousStarCount = null;
}
