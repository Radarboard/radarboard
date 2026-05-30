import type {
  GitHubRepoStarDailyRow,
  GitHubRepoStarEventRow,
  GitHubRepoStarSyncStateRow,
  GitHubRepoStarTrackingRow,
  GitHubStarHistoryRepository,
  PlanetscaleConfig,
} from "@radarboard/types/database";

function chunk<T>(values: T[], size: number): T[][] {
  const next: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    next.push(values.slice(index, index + size));
  }
  return next;
}

export class PlanetscaleGitHubStarHistoryRepository implements GitHubStarHistoryRepository {
  private readonly config: PlanetscaleConfig;

  constructor(config: PlanetscaleConfig) {
    this.config = config;
  }

  private async query(
    sql: string,
    args: unknown[] = []
  ): Promise<{ rows: Record<string, unknown>[] }> {
    const res = await fetch(`https://${this.config.host}/v1/query`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.config.username}:${this.config.password}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql, args }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`PlanetScale query failed: ${res.status} ${text}`);
    }

    const data = (await res.json()) as { rows?: Record<string, unknown>[] };
    return { rows: data.rows ?? [] };
  }

  async listRepoKeys(): Promise<string[]> {
    const result = await this.query(
      `SELECT DISTINCT repo_key FROM (
         SELECT repo_key FROM github_repo_star_daily
         UNION
         SELECT repo_key FROM github_repo_star_sync_state
         UNION
         SELECT repo_key FROM github_repo_star_event
         UNION
         SELECT repo_key FROM github_repo_star_tracking
       ) repo_keys
       ORDER BY repo_key ASC`
    );

    return result.rows.map((row) => row.repo_key as string);
  }

  async getDaily(
    repoKeys: string[],
    options: { fromDay?: string | null; toDay?: string | null } = {}
  ): Promise<GitHubRepoStarDailyRow[]> {
    if (repoKeys.length === 0) return [];

    const args: unknown[] = [...repoKeys];
    const where = [`repo_key IN (${repoKeys.map(() => "?").join(", ")})`];

    if (options.fromDay) {
      where.push("day >= ?");
      args.push(options.fromDay);
    }

    if (options.toDay) {
      where.push("day <= ?");
      args.push(options.toDay);
    }

    const result = await this.query(
      `SELECT repo_key, day, total_stars, stars_gained, source, updated_at
       FROM github_repo_star_daily
       WHERE ${where.join(" AND ")}
       ORDER BY repo_key ASC, day ASC`,
      args
    );

    return result.rows.map((row) => ({
      repoKey: row.repo_key as string,
      day: row.day as string,
      totalStars: Number(row.total_stars),
      starsGained: Number(row.stars_gained),
      source: row.source as string,
      updatedAt: Number(row.updated_at),
    }));
  }

  async upsertDaily(rows: GitHubRepoStarDailyRow[]): Promise<void> {
    if (rows.length === 0) return;

    for (const part of chunk(rows, 200)) {
      const placeholders = part.map(() => "(?, ?, ?, ?, ?, ?)").join(", ");
      const args = part.flatMap((row) => [
        row.repoKey,
        row.day,
        row.totalStars,
        row.starsGained,
        row.source,
        row.updatedAt,
      ]);

      await this.query(
        `INSERT INTO github_repo_star_daily
           (repo_key, day, total_stars, stars_gained, source, updated_at)
         VALUES ${placeholders}
         ON DUPLICATE KEY UPDATE
           total_stars = VALUES(total_stars),
           stars_gained = VALUES(stars_gained),
           source = VALUES(source),
           updated_at = VALUES(updated_at)`,
        args
      );
    }
  }

  async getSyncStates(repoKeys: string[]): Promise<GitHubRepoStarSyncStateRow[]> {
    if (repoKeys.length === 0) return [];

    const result = await this.query(
      `SELECT repo_key, backfill_status, next_page, oldest_seen_starred_at, last_synced_at, last_error, updated_at
       FROM github_repo_star_sync_state
       WHERE repo_key IN (${repoKeys.map(() => "?").join(", ")})
       ORDER BY repo_key ASC`,
      repoKeys
    );

    return result.rows.map((row) => ({
      repoKey: row.repo_key as string,
      backfillStatus: row.backfill_status as GitHubRepoStarSyncStateRow["backfillStatus"],
      nextPage: row.next_page == null ? null : Number(row.next_page),
      oldestSeenStarredAt: (row.oldest_seen_starred_at as string | null) ?? null,
      lastSyncedAt: row.last_synced_at == null ? null : Number(row.last_synced_at),
      lastError: (row.last_error as string | null) ?? null,
      updatedAt: Number(row.updated_at),
    }));
  }

  async upsertSyncState(row: GitHubRepoStarSyncStateRow): Promise<void> {
    await this.query(
      `INSERT INTO github_repo_star_sync_state
         (repo_key, backfill_status, next_page, oldest_seen_starred_at, last_synced_at, last_error, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         backfill_status = VALUES(backfill_status),
         next_page = VALUES(next_page),
         oldest_seen_starred_at = VALUES(oldest_seen_starred_at),
         last_synced_at = VALUES(last_synced_at),
         last_error = VALUES(last_error),
         updated_at = VALUES(updated_at)`,
      [
        row.repoKey,
        row.backfillStatus,
        row.nextPage,
        row.oldestSeenStarredAt,
        row.lastSyncedAt,
        row.lastError,
        row.updatedAt,
      ]
    );
  }

  async getStarEvents(
    repoKeys: string[],
    options: {
      actions?: Array<GitHubRepoStarEventRow["action"]>;
      occurredAfter?: number | null;
      occurredBefore?: number | null;
    } = {}
  ): Promise<GitHubRepoStarEventRow[]> {
    if (repoKeys.length === 0) return [];

    const args: unknown[] = [...repoKeys];
    const where = [`repo_key IN (${repoKeys.map(() => "?").join(", ")})`];

    if (options.actions?.length) {
      where.push(`action IN (${options.actions.map(() => "?").join(", ")})`);
      args.push(...options.actions);
    }
    if (options.occurredAfter != null) {
      where.push("occurred_at >= ?");
      args.push(options.occurredAfter);
    }
    if (options.occurredBefore != null) {
      where.push("occurred_at <= ?");
      args.push(options.occurredBefore);
    }

    const result = await this.query(
      `SELECT source_event_id, repo_key, action, user_login, occurred_at, updated_at
       FROM github_repo_star_event
       WHERE ${where.join(" AND ")}
       ORDER BY repo_key ASC, occurred_at ASC`,
      args
    );

    return result.rows.map((row) => ({
      sourceEventId: row.source_event_id as string,
      repoKey: row.repo_key as string,
      action: row.action as GitHubRepoStarEventRow["action"],
      userLogin: (row.user_login as string | null) ?? null,
      occurredAt: Number(row.occurred_at),
      updatedAt: Number(row.updated_at),
    }));
  }

  async upsertStarEvents(rows: GitHubRepoStarEventRow[]): Promise<void> {
    if (rows.length === 0) return;

    for (const part of chunk(rows, 200)) {
      const placeholders = part.map(() => "(?, ?, ?, ?, ?, ?)").join(", ");
      const args = part.flatMap((row) => [
        row.sourceEventId,
        row.repoKey,
        row.action,
        row.userLogin,
        row.occurredAt,
        row.updatedAt,
      ]);

      await this.query(
        `INSERT IGNORE INTO github_repo_star_event
           (source_event_id, repo_key, action, user_login, occurred_at, updated_at)
         VALUES ${placeholders}`,
        args
      );
    }
  }

  async getTrackingStates(repoKeys: string[]): Promise<GitHubRepoStarTrackingRow[]> {
    if (repoKeys.length === 0) return [];

    const result = await this.query(
      `SELECT repo_key, tracking_started_at, baseline_stars, last_webhook_at, updated_at
       FROM github_repo_star_tracking
       WHERE repo_key IN (${repoKeys.map(() => "?").join(", ")})
       ORDER BY repo_key ASC`,
      repoKeys
    );

    return result.rows.map((row) => ({
      repoKey: row.repo_key as string,
      trackingStartedAt: row.tracking_started_at == null ? null : Number(row.tracking_started_at),
      baselineStars: row.baseline_stars == null ? null : Number(row.baseline_stars),
      lastWebhookAt: row.last_webhook_at == null ? null : Number(row.last_webhook_at),
      updatedAt: Number(row.updated_at),
    }));
  }

  async upsertTrackingState(row: GitHubRepoStarTrackingRow): Promise<void> {
    await this.query(
      `INSERT INTO github_repo_star_tracking
         (repo_key, tracking_started_at, baseline_stars, last_webhook_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         tracking_started_at = VALUES(tracking_started_at),
         baseline_stars = VALUES(baseline_stars),
         last_webhook_at = VALUES(last_webhook_at),
         updated_at = VALUES(updated_at)`,
      [row.repoKey, row.trackingStartedAt, row.baselineStars, row.lastWebhookAt, row.updatedAt]
    );
  }

  async clearAll(): Promise<void> {
    await this.query("DELETE FROM github_repo_star_daily");
    await this.query("DELETE FROM github_repo_star_sync_state");
    await this.query("DELETE FROM github_repo_star_event");
    await this.query("DELETE FROM github_repo_star_tracking");
  }
}
