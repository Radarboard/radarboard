/**
 * Sentry — Delta detector
 *
 * Accepts SentryIssueItem from @radarboard/types/sentry.
 */

import type { DeltaDetector, IntegrationEvent } from "@radarboard/integration-sdk/types";
import type { SentryIssueItem } from "@radarboard/types/sentry";

interface IssueEntry {
  count: number;
}

const issueState = new Map<string, IssueEntry>();
let bootstrapped = false;
const SPIKE_MULTIPLIER = 5;

function levelToSeverity(level: string): "critical" | "warning" | "info" | "success" {
  if (level === "fatal" || level === "error") return "critical";
  if (level === "warning") return "warning";
  return "info";
}

export const sentryIssueDelta: DeltaDetector<SentryIssueItem[]> = {
  detect(current, projectSlug) {
    if (!bootstrapped) {
      for (const issue of current) issueState.set(issue.id, { count: issue.count });
      bootstrapped = true;
      return [];
    }

    const events: IntegrationEvent[] = [];
    for (const issue of current) {
      const prev = issueState.get(issue.id);

      if (!prev) {
        issueState.set(issue.id, { count: issue.count });
        events.push({
          source: "sentry",
          sourceEventId: `sentry:issue:${issue.id}:new`,
          type: "error.new",
          severity: levelToSeverity(issue.level),
          projectSlug,
          title: issue.title,
          body: `${issue.projectName} · ${issue.culprit}`,
          metadata: {
            issueId: issue.id,
            shortId: issue.shortId,
            project: issue.projectSlug,
            level: issue.level,
            count: issue.count,
            userCount: issue.userCount,
            url: issue.permalink,
          },
          occurredAt: Math.floor(new Date(issue.firstSeen).getTime() / 1000),
        });
      } else if (issue.count >= prev.count * SPIKE_MULTIPLIER && issue.count > 50) {
        issueState.set(issue.id, { count: issue.count });
        events.push({
          source: "sentry",
          sourceEventId: `sentry:issue:${issue.id}:spike:${issue.count}`,
          type: "error.spike",
          severity: "critical",
          projectSlug,
          title: `Error spike: ${issue.title}`,
          body: `${issue.count} events (+${Math.round((issue.count / prev.count - 1) * 100)}%) in ${issue.projectName}`,
          metadata: {
            issueId: issue.id,
            project: issue.projectSlug,
            previousCount: prev.count,
            currentCount: issue.count,
            userCount: issue.userCount,
            url: issue.permalink,
          },
        });
      } else {
        issueState.set(issue.id, { count: issue.count });
      }
    }
    return events;
  },
};

export function resetSentryDeltaState(): void {
  issueState.clear();
  bootstrapped = false;
}
