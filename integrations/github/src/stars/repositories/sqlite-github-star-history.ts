import type {
  GitHubRepoStarDailyRow,
  GitHubRepoStarEventRow,
  GitHubRepoStarSyncStateRow,
  GitHubRepoStarTrackingRow,
  GitHubStarHistoryRepository,
} from "@radarboard/types/database";
import { and, asc, gte, inArray, lte, sql } from "drizzle-orm";
import {
  githubRepoStarDaily,
  githubRepoStarEvent,
  githubRepoStarSyncState,
  githubRepoStarTracking,
} from "../schema";

interface SqliteDbLike {
  all: (...args: unknown[]) => Promise<unknown[]>;
  run: (...args: unknown[]) => Promise<unknown>;
  select: () => {
    from: (table: unknown) => {
      where: (condition: unknown) => {
        orderBy: (...args: unknown[]) => Promise<Array<Record<string, unknown>>>;
      };
    };
  };
  insert: (table: unknown) => {
    values: (values: unknown) => {
      onConflictDoUpdate: (options: unknown) => Promise<unknown>;
      onConflictDoNothing: (options: unknown) => Promise<unknown>;
    };
  };
}

interface SqliteDailyRow {
  repoKey: string;
  day: string;
  totalStars: number;
  starsGained: number;
  source: string;
  updatedAt: number;
}

interface SqliteSyncStateRow {
  repoKey: string;
  backfillStatus: GitHubRepoStarSyncStateRow["backfillStatus"];
  nextPage: number | null;
  oldestSeenStarredAt: string | null;
  lastSyncedAt: number | null;
  lastError: string | null;
  updatedAt: number;
}

interface SqliteStarEventRow {
  sourceEventId: string;
  repoKey: string;
  action: GitHubRepoStarEventRow["action"];
  userLogin: string | null;
  occurredAt: number;
  updatedAt: number;
}

interface SqliteTrackingRow {
  repoKey: string;
  trackingStartedAt: number | null;
  baselineStars: number | null;
  lastWebhookAt: number | null;
  updatedAt: number;
}

interface SqliteGitHubStarHistoryRepositoryDependencies {
  getDb: () => unknown;
}

export class SqliteGitHubStarHistoryRepository implements GitHubStarHistoryRepository {
  private tablesReady = false;
  private readonly getDb: () => SqliteDbLike;

  constructor({ getDb }: SqliteGitHubStarHistoryRepositoryDependencies) {
    this.getDb = getDb as () => SqliteDbLike;
  }

  private async ensureColumn(
    tableName: string,
    columnName: string,
    columnSql: string
  ): Promise<void> {
    const db = this.getDb();
    const pragmaRows = (await db.all(sql.raw(`PRAGMA table_info(${tableName})`))) as Array<{
      name?: string;
    }>;
    const hasColumn = pragmaRows.some((row) => row.name === columnName);
    if (!hasColumn) {
      await db.run(sql.raw(`ALTER TABLE ${tableName} ADD COLUMN ${columnSql}`));
    }
  }

  private async ensureTables(): Promise<void> {
    if (this.tablesReady) return;

    const db = this.getDb();
    await db.run(
      sql.raw(
        "CREATE TABLE IF NOT EXISTS github_repo_star_daily (repo_key TEXT NOT NULL, day TEXT NOT NULL, total_stars INTEGER NOT NULL, stars_gained INTEGER NOT NULL, source TEXT NOT NULL, updated_at INTEGER NOT NULL)"
      )
    );
    await db.run(
      sql.raw(
        "CREATE UNIQUE INDEX IF NOT EXISTS github_repo_star_daily_repo_day_idx ON github_repo_star_daily(repo_key, day)"
      )
    );
    await db.run(
      sql.raw(
        "CREATE INDEX IF NOT EXISTS github_repo_star_daily_day_idx ON github_repo_star_daily(day)"
      )
    );
    await db.run(
      sql.raw(
        "CREATE TABLE IF NOT EXISTS github_repo_star_sync_state (repo_key TEXT PRIMARY KEY, backfill_status TEXT NOT NULL, next_page INTEGER, oldest_seen_starred_at TEXT, last_synced_at INTEGER, last_error TEXT, updated_at INTEGER NOT NULL)"
      )
    );
    await db.run(
      sql.raw(
        "CREATE TABLE IF NOT EXISTS github_repo_star_event (source_event_id TEXT PRIMARY KEY, repo_key TEXT NOT NULL, action TEXT NOT NULL, user_login TEXT, occurred_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)"
      )
    );
    await db.run(
      sql.raw(
        "CREATE INDEX IF NOT EXISTS github_repo_star_event_repo_idx ON github_repo_star_event(repo_key, occurred_at)"
      )
    );
    await db.run(
      sql.raw(
        "CREATE INDEX IF NOT EXISTS github_repo_star_event_action_idx ON github_repo_star_event(action, occurred_at)"
      )
    );
    await db.run(
      sql.raw(
        "CREATE TABLE IF NOT EXISTS github_repo_star_tracking (repo_key TEXT PRIMARY KEY, tracking_started_at INTEGER, baseline_stars INTEGER, last_webhook_at INTEGER, updated_at INTEGER NOT NULL)"
      )
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
    const db = this.getDb();
    const rows = (await db.all(
      sql.raw(
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
      )
    )) as Array<{ repo_key?: string }>;

    return rows.map((row) => row.repo_key).filter((repoKey): repoKey is string => Boolean(repoKey));
  }

  async getDaily(
    repoKeys: string[],
    options: { fromDay?: string | null; toDay?: string | null } = {}
  ): Promise<GitHubRepoStarDailyRow[]> {
    if (repoKeys.length === 0) return [];

    await this.ensureTables();
    const db = this.getDb();
    const conditions = [inArray(githubRepoStarDaily.repoKey, repoKeys)];
    if (options.fromDay) conditions.push(gte(githubRepoStarDaily.day, options.fromDay));
    if (options.toDay) conditions.push(lte(githubRepoStarDaily.day, options.toDay));

    const rows = (await db
      .select()
      .from(githubRepoStarDaily)
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      .orderBy(
        asc(githubRepoStarDaily.repoKey),
        asc(githubRepoStarDaily.day)
      )) as unknown as SqliteDailyRow[];

    return rows.map((row) => ({
      repoKey: row.repoKey,
      day: row.day,
      totalStars: row.totalStars,
      starsGained: row.starsGained,
      source: row.source,
      updatedAt: row.updatedAt,
    }));
  }

  async upsertDaily(rows: GitHubRepoStarDailyRow[]): Promise<void> {
    if (rows.length === 0) return;

    await this.ensureTables();
    const db = this.getDb();
    await db
      .insert(githubRepoStarDaily)
      .values(
        rows.map((row) => ({
          repoKey: row.repoKey,
          day: row.day,
          totalStars: row.totalStars,
          starsGained: row.starsGained,
          source: row.source,
          updatedAt: row.updatedAt,
        }))
      )
      .onConflictDoUpdate({
        target: [githubRepoStarDaily.repoKey, githubRepoStarDaily.day],
        set: {
          totalStars: sql`excluded.total_stars`,
          starsGained: sql`excluded.stars_gained`,
          source: sql`excluded.source`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
  }

  async getSyncStates(repoKeys: string[]): Promise<GitHubRepoStarSyncStateRow[]> {
    if (repoKeys.length === 0) return [];

    await this.ensureTables();
    const db = this.getDb();
    const rows = (await db
      .select()
      .from(githubRepoStarSyncState)
      .where(inArray(githubRepoStarSyncState.repoKey, repoKeys))
      .orderBy(asc(githubRepoStarSyncState.repoKey))) as unknown as SqliteSyncStateRow[];

    return rows.map((row) => ({
      repoKey: row.repoKey,
      backfillStatus: row.backfillStatus as GitHubRepoStarSyncStateRow["backfillStatus"],
      nextPage: row.nextPage,
      oldestSeenStarredAt: row.oldestSeenStarredAt,
      lastSyncedAt: row.lastSyncedAt,
      lastError: row.lastError,
      updatedAt: row.updatedAt,
    }));
  }

  async upsertSyncState(row: GitHubRepoStarSyncStateRow): Promise<void> {
    await this.ensureTables();
    const db = this.getDb();
    await db
      .insert(githubRepoStarSyncState)
      .values({
        repoKey: row.repoKey,
        backfillStatus: row.backfillStatus,
        nextPage: row.nextPage,
        oldestSeenStarredAt: row.oldestSeenStarredAt,
        lastSyncedAt: row.lastSyncedAt,
        lastError: row.lastError,
        updatedAt: row.updatedAt,
      })
      .onConflictDoUpdate({
        target: githubRepoStarSyncState.repoKey,
        set: {
          backfillStatus: row.backfillStatus,
          nextPage: row.nextPage,
          oldestSeenStarredAt: row.oldestSeenStarredAt,
          lastSyncedAt: row.lastSyncedAt,
          lastError: row.lastError,
          updatedAt: row.updatedAt,
        },
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
    const db = this.getDb();
    const conditions = [inArray(githubRepoStarEvent.repoKey, repoKeys)];
    if (options.actions?.length) {
      conditions.push(inArray(githubRepoStarEvent.action, options.actions));
    }
    if (options.occurredAfter != null) {
      conditions.push(gte(githubRepoStarEvent.occurredAt, options.occurredAfter));
    }
    if (options.occurredBefore != null) {
      conditions.push(lte(githubRepoStarEvent.occurredAt, options.occurredBefore));
    }

    const rows = (await db
      .select()
      .from(githubRepoStarEvent)
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      .orderBy(
        asc(githubRepoStarEvent.repoKey),
        asc(githubRepoStarEvent.occurredAt)
      )) as unknown as SqliteStarEventRow[];

    return rows.map((row) => ({
      sourceEventId: row.sourceEventId,
      repoKey: row.repoKey,
      action: row.action as GitHubRepoStarEventRow["action"],
      userLogin: row.userLogin,
      occurredAt: row.occurredAt,
      updatedAt: row.updatedAt,
    }));
  }

  async upsertStarEvents(rows: GitHubRepoStarEventRow[]): Promise<void> {
    if (rows.length === 0) return;

    await this.ensureTables();
    const db = this.getDb();
    await db
      .insert(githubRepoStarEvent)
      .values(
        rows.map((row) => ({
          sourceEventId: row.sourceEventId,
          repoKey: row.repoKey,
          action: row.action,
          userLogin: row.userLogin,
          occurredAt: row.occurredAt,
          updatedAt: row.updatedAt,
        }))
      )
      .onConflictDoNothing({
        target: githubRepoStarEvent.sourceEventId,
      });
  }

  async getTrackingStates(repoKeys: string[]): Promise<GitHubRepoStarTrackingRow[]> {
    if (repoKeys.length === 0) return [];

    await this.ensureTables();
    const db = this.getDb();
    const rows = (await db
      .select()
      .from(githubRepoStarTracking)
      .where(inArray(githubRepoStarTracking.repoKey, repoKeys))
      .orderBy(asc(githubRepoStarTracking.repoKey))) as unknown as SqliteTrackingRow[];

    return rows.map((row) => ({
      repoKey: row.repoKey,
      trackingStartedAt: row.trackingStartedAt,
      baselineStars: row.baselineStars,
      lastWebhookAt: row.lastWebhookAt,
      updatedAt: row.updatedAt,
    }));
  }

  async upsertTrackingState(row: GitHubRepoStarTrackingRow): Promise<void> {
    await this.ensureTables();
    const db = this.getDb();
    await db
      .insert(githubRepoStarTracking)
      .values({
        repoKey: row.repoKey,
        trackingStartedAt: row.trackingStartedAt,
        baselineStars: row.baselineStars,
        lastWebhookAt: row.lastWebhookAt,
        updatedAt: row.updatedAt,
      })
      .onConflictDoUpdate({
        target: githubRepoStarTracking.repoKey,
        set: {
          trackingStartedAt: row.trackingStartedAt,
          baselineStars: row.baselineStars,
          lastWebhookAt: row.lastWebhookAt,
          updatedAt: row.updatedAt,
        },
      });
  }

  async clearAll(): Promise<void> {
    await this.ensureTables();
    const db = this.getDb();
    await db.run(sql.raw("DELETE FROM github_repo_star_daily"));
    await db.run(sql.raw("DELETE FROM github_repo_star_sync_state"));
    await db.run(sql.raw("DELETE FROM github_repo_star_event"));
    await db.run(sql.raw("DELETE FROM github_repo_star_tracking"));
  }
}
