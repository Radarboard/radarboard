import type { IntegrationEvent } from "@radarboard/integration-sdk/types";
import type { GitHubRepoStarEventRow } from "@radarboard/types/database";
import { getGitHubStarHistoryRepo } from "@/data/core/repository";

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function normalizeRepoKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || !trimmed.includes("/")) return null;
  return trimmed.toLowerCase();
}

function toGitHubStarEventRow(event: IntegrationEvent): GitHubRepoStarEventRow | null {
  if (event.source !== "github") return null;
  if (event.type !== "star.received" && event.type !== "star.removed") return null;

  const repoKey =
    normalizeRepoKey(event.metadata?.repoKey) ?? normalizeRepoKey(event.metadata?.repo);
  if (!repoKey || !event.sourceEventId) return null;

  const action =
    event.metadata?.action === "created" || event.type === "star.received" ? "created" : "deleted";
  const getUserLogin = () => {
    if (typeof event.metadata?.userLogin === "string") return event.metadata.userLogin;
    if (typeof event.metadata?.user === "string") return event.metadata.user;
    return null;
  };
  const userLogin = getUserLogin();
  const updatedAt = nowSeconds();

  return {
    sourceEventId: event.sourceEventId,
    repoKey,
    action,
    userLogin,
    occurredAt: event.occurredAt ?? updatedAt,
    updatedAt,
  };
}

async function persistGitHubStarArtifacts(events: IntegrationEvent[]): Promise<void> {
  const rows = events
    .map(toGitHubStarEventRow)
    .filter((row): row is GitHubRepoStarEventRow => row !== null);
  if (rows.length === 0) return;

  const repo = getGitHubStarHistoryRepo();
  await repo.upsertStarEvents(rows);

  const repoKeys = [...new Set(rows.map((row) => row.repoKey))];
  const existingByRepo = new Map(
    (await repo.getTrackingStates(repoKeys)).map((row) => [row.repoKey, row])
  );

  for (const repoKey of repoKeys) {
    const repoRows = rows.filter((row) => row.repoKey === repoKey);
    const earliestOccurredAt = Math.min(...repoRows.map((row) => row.occurredAt));
    const latestOccurredAt = Math.max(...repoRows.map((row) => row.occurredAt));
    const existing = existingByRepo.get(repoKey);

    await repo.upsertTrackingState({
      repoKey,
      trackingStartedAt:
        existing?.trackingStartedAt == null
          ? earliestOccurredAt
          : Math.min(existing.trackingStartedAt, earliestOccurredAt),
      baselineStars: existing?.baselineStars ?? null,
      lastWebhookAt:
        existing?.lastWebhookAt == null
          ? latestOccurredAt
          : Math.max(existing.lastWebhookAt, latestOccurredAt),
      updatedAt: nowSeconds(),
    });
  }
}

export async function persistIntegrationArtifacts(events: IntegrationEvent[]): Promise<void> {
  await persistGitHubStarArtifacts(events);
}
