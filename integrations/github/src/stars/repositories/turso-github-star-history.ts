import { createClient } from "@libsql/client";
import type {
  GitHubRepoStarDailyRow,
  GitHubRepoStarEventRow,
  GitHubRepoStarSyncStateRow,
  GitHubRepoStarTrackingRow,
  GitHubStarHistoryRepository,
  TursoConfig,
} from "@radarboard/types/database";

const DAILY_COLUMNS = "repo_key, day, total_stars, stars_gained, source, updated_at";
const SYNC_COLUMNS =
  "repo_key, backfill_status, next_page, oldest_seen_starred_at, last_synced_at, last_error, updated_at";
const EVENT_COLUMNS = "source_event_id, repo_key, action, user_login, occurred_at, updated_at";
const TRACKING_COLUMNS =
  "repo_key, tracking_started_at, baseline_stars, last_webhook_at, updated_at";

function chunk<T>(values: T[], size: number): T[][] {
  const next: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    next.push(values.slice(index, index + size));
  }
  return next;
}

export class TursoGitHubStarHistoryRepository implements GitHubStarHistoryRepository {
  private readonly client: ReturnType<typeof createClient>;
  private tablesReady = false;

  constructor(config: TursoConfig) {
    this.client = createClient({ url: config.url, authToken: config.authToken });
  }

  private async ensureColumn(
    tableName: string,
    columnName: string,
    columnSql: string
  ): Promise<void> {
    const result = await this.client.execute(`PRAGMA table_info(${tableName})`);
    const hasColumn = result.rows.some((row: Record<string, unknown>) => row.name === columnName);
    if (!hasColumn) {
      await this.client.execute(`ALTER TABLE ${tableName} ADD COLUMN ${columnSql}`);
    }
  }

  private async ensureTables(): Promise<void> {
    if (this.tablesReady) return;

    await this.client.execute(
      "CREATE TABLE IF NOT EXISTS github_repo_star_daily (repo_key TEXT NOT NULL, day TEXT NOT NULL, total_stars INTEGER NOT NULL, stars_gained INTEGER NOT NULL, source TEXT NOT NULL, updated_at INTEGER NOT NULL)"
    );
    await this.client.execute(
      "CREATE UNIQUE INDEX IF NOT EXISTS github_repo_star_daily_repo_day_idx ON github_repo_star_daily(repo_key, day)"
    );
    await this.client.execute(
      "CREATE INDEX IF NOT EXISTS github_repo_star_daily_day_idx ON github_repo_star_daily(day)"
    );
    await this.client.execute(
      "CREATE TABLE IF NOT EXISTS github_repo_star_sync_state (repo_key TEXT PRIMARY KEY, backfill_status TEXT NOT NULL, next_page INTEGER, oldest_seen_starred_at TEXT, last_synced_at INTEGER, last_error TEXT, updated_at INTEGER NOT NULL)"
    );
    await this.client.execute(
      "CREATE TABLE IF NOT EXISTS github_repo_star_event (source_event_id TEXT PRIMARY KEY, repo_key TEXT NOT NULL, action TEXT NOT NULL, user_login TEXT, occurred_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)"
    );
    await this.client.execute(
      "CREATE INDEX IF NOT EXISTS github_repo_star_event_repo_idx ON github_repo_star_event(repo_key, occurred_at)"
    );
    await this.client.execute(
      "CREATE INDEX IF NOT EXISTS github_repo_star_event_action_idx ON github_repo_star_event(action, occurred_at)"
    );
    await this.client.execute(
      "CREATE TABLE IF NOT EXISTS github_repo_star_tracking (repo_key TEXT PRIMARY KEY, tracking_started_at INTEGER, baseline_stars INTEGER, last_webhook_at INTEGER, updated_at INTEGER NOT NULL)"
    );
    await this.ensureColumn(
      "github_repo_star_tracking",
      "baseline_stars",
      "baseline_stars INTEGER"
    );

    this.tablesReady = true;
  }

  async listRepoKeys(): Promise<string[]> {
    await this.ensureTables();
    const result = await this.client.execute(`
      SELECT DISTINCT repo_key FROM (
        SELECT repo_key FROM github_repo_star_daily
        UNION
        SELECT repo_key FROM github_repo_star_sync_state
        UNION
        SELECT repo_key FROM github_repo_star_event
        UNION
        SELECT repo_key FROM github_repo_star_tracking
      ) repo_keys
      ORDER BY repo_key ASC
    `);

    return result.rows
      .map((row: Record<string, unknown>) => row.repo_key as string | undefined)
      .filter((repoKey): repoKey is string => Boolean(repoKey));
  }

  async getDaily(
    repoKeys: string[],
    options: { fromDay?: string | null; toDay?: string | null } = {}
  ): Promise<GitHubRepoStarDailyRow[]> {
    if (repoKeys.length === 0) return [];

    await this.ensureTables();
    const args: Array<string | number | null> = [...repoKeys];
    const where = [`repo_key IN (${repoKeys.map(() => "?").join(", ")})`];

    if (options.fromDay) {
      where.push("day >= ?");
      args.push(options.fromDay);
    }

    if (options.toDay) {
      where.push("day <= ?");
      args.push(options.toDay);
    }

    const result = await this.client.execute({
      sql: `SELECT ${DAILY_COLUMNS} FROM github_repo_star_daily
            WHERE ${where.join(" AND ")}
            ORDER BY repo_key ASC, day ASC`,
      args,
    });

    return result.rows.map((row: Record<string, unknown>) => ({
      repoKey: row.repo_key as string,
      day: row.day as string,
      totalStars: row.total_stars as number,
      starsGained: row.stars_gained as number,
      source: row.source as string,
      updatedAt: row.updated_at as number,
    }));
  }

  async upsertDaily(rows: GitHubRepoStarDailyRow[]): Promise<void> {
    if (rows.length === 0) return;

    await this.ensureTables();
    for (const part of chunk(rows, 200)) {
      const placeholders = part.map(() => "(?, ?, ?, ?, ?, ?)").join(", ");
      const args: Array<string | number | null> = part.flatMap((row) => [
        row.repoKey,
        row.day,
        row.totalStars,
        row.starsGained,
        row.source,
        row.updatedAt,
      ]);

      await this.client.execute({
        sql: `INSERT INTO github_repo_star_daily (${DAILY_COLUMNS})
              VALUES ${placeholders}
              ON CONFLICT(repo_key, day) DO UPDATE SET
                total_stars = excluded.total_stars,
                stars_gained = excluded.stars_gained,
                source = excluded.source,
                updated_at = excluded.updated_at`,
        args,
      });
    }
  }

  async getSyncStates(repoKeys: string[]): Promise<GitHubRepoStarSyncStateRow[]> {
    if (repoKeys.length === 0) return [];

    await this.ensureTables();
    const result = await this.client.execute({
      sql: `SELECT ${SYNC_COLUMNS} FROM github_repo_star_sync_state
            WHERE repo_key IN (${repoKeys.map(() => "?").join(", ")})
            ORDER BY repo_key ASC`,
      args: repoKeys,
    });

    return result.rows.map((row: Record<string, unknown>) => ({
      repoKey: row.repo_key as string,
      backfillStatus: row.backfill_status as GitHubRepoStarSyncStateRow["backfillStatus"],
      nextPage: (row.next_page as number | null) ?? null,
      oldestSeenStarredAt: (row.oldest_seen_starred_at as string | null) ?? null,
      lastSyncedAt: (row.last_synced_at as number | null) ?? null,
      lastError: (row.last_error as string | null) ?? null,
      updatedAt: row.updated_at as number,
    }));
  }

  async upsertSyncState(row: GitHubRepoStarSyncStateRow): Promise<void> {
    await this.ensureTables();
    await this.client.execute({
      sql: `INSERT INTO github_repo_star_sync_state (${SYNC_COLUMNS})
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(repo_key) DO UPDATE SET
              backfill_status = excluded.backfill_status,
              next_page = excluded.next_page,
              oldest_seen_starred_at = excluded.oldest_seen_starred_at,
              last_synced_at = excluded.last_synced_at,
              last_error = excluded.last_error,
              updated_at = excluded.updated_at`,
      args: [
        row.repoKey,
        row.backfillStatus,
        row.nextPage,
        row.oldestSeenStarredAt,
        row.lastSyncedAt,
        row.lastError,
        row.updatedAt,
      ],
    });
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

    await this.ensureTables();
    const args: Array<string | number | null> = [...repoKeys];
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

    const result = await this.client.execute({
      sql: `SELECT ${EVENT_COLUMNS} FROM github_repo_star_event
            WHERE ${where.join(" AND ")}
            ORDER BY repo_key ASC, occurred_at ASC`,
      args,
    });

    return result.rows.map((row: Record<string, unknown>) => ({
      sourceEventId: row.source_event_id as string,
      repoKey: row.repo_key as string,
      action: row.action as GitHubRepoStarEventRow["action"],
      userLogin: (row.user_login as string | null) ?? null,
      occurredAt: row.occurred_at as number,
      updatedAt: row.updated_at as number,
    }));
  }

  async upsertStarEvents(rows: GitHubRepoStarEventRow[]): Promise<void> {
    if (rows.length === 0) return;

    await this.ensureTables();
    for (const part of chunk(rows, 200)) {
      const placeholders = part.map(() => "(?, ?, ?, ?, ?, ?)").join(", ");
      const args: Array<string | number | null> = part.flatMap((row) => [
        row.sourceEventId,
        row.repoKey,
        row.action,
        row.userLogin,
        row.occurredAt,
        row.updatedAt,
      ]);

      await this.client.execute({
        sql: `INSERT INTO github_repo_star_event (${EVENT_COLUMNS})
              VALUES ${placeholders}
              ON CONFLICT(source_event_id) DO NOTHING`,
        args,
      });
    }
  }

  async getTrackingStates(repoKeys: string[]): Promise<GitHubRepoStarTrackingRow[]> {
    if (repoKeys.length === 0) return [];

    await this.ensureTables();
    const result = await this.client.execute({
      sql: `SELECT ${TRACKING_COLUMNS} FROM github_repo_star_tracking
            WHERE repo_key IN (${repoKeys.map(() => "?").join(", ")})
            ORDER BY repo_key ASC`,
      args: repoKeys,
    });

    return result.rows.map((row: Record<string, unknown>) => ({
      repoKey: row.repo_key as string,
      trackingStartedAt: (row.tracking_started_at as number | null) ?? null,
      baselineStars: (row.baseline_stars as number | null) ?? null,
      lastWebhookAt: (row.last_webhook_at as number | null) ?? null,
      updatedAt: row.updated_at as number,
    }));
  }

  async upsertTrackingState(row: GitHubRepoStarTrackingRow): Promise<void> {
    await this.ensureTables();
    await this.client.execute({
      sql: `INSERT INTO github_repo_star_tracking (${TRACKING_COLUMNS})
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(repo_key) DO UPDATE SET
              tracking_started_at = excluded.tracking_started_at,
              baseline_stars = excluded.baseline_stars,
              last_webhook_at = excluded.last_webhook_at,
              updated_at = excluded.updated_at`,
      args: [
        row.repoKey,
        row.trackingStartedAt,
        row.baselineStars,
        row.lastWebhookAt,
        row.updatedAt,
      ],
    });
  }

  async clearAll(): Promise<void> {
    await this.ensureTables();
    await this.client.execute("DELETE FROM github_repo_star_daily");
    await this.client.execute("DELETE FROM github_repo_star_sync_state");
    await this.client.execute("DELETE FROM github_repo_star_event");
    await this.client.execute("DELETE FROM github_repo_star_tracking");
  }
}
