import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const githubRepoStarDaily = sqliteTable(
  "github_repo_star_daily",
  {
    repoKey: text("repo_key").notNull(),
    day: text("day").notNull(),
    totalStars: integer("total_stars").notNull(),
    starsGained: integer("stars_gained").notNull(),
    source: text("source").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("github_repo_star_daily_repo_day_idx").on(table.repoKey, table.day),
    index("github_repo_star_daily_day_idx").on(table.day),
  ]
);

export const githubRepoStarSyncState = sqliteTable("github_repo_star_sync_state", {
  repoKey: text("repo_key").primaryKey(),
  backfillStatus: text("backfill_status").notNull(),
  nextPage: integer("next_page"),
  oldestSeenStarredAt: text("oldest_seen_starred_at"),
  lastSyncedAt: integer("last_synced_at"),
  lastError: text("last_error"),
  updatedAt: integer("updated_at").notNull(),
});

export const githubRepoStarEvent = sqliteTable(
  "github_repo_star_event",
  {
    sourceEventId: text("source_event_id").primaryKey(),
    repoKey: text("repo_key").notNull(),
    action: text("action").notNull(),
    userLogin: text("user_login"),
    occurredAt: integer("occurred_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("github_repo_star_event_repo_idx").on(table.repoKey, table.occurredAt),
    index("github_repo_star_event_action_idx").on(table.action, table.occurredAt),
  ]
);

export const githubRepoStarTracking = sqliteTable("github_repo_star_tracking", {
  repoKey: text("repo_key").primaryKey(),
  trackingStartedAt: integer("tracking_started_at"),
  baselineStars: integer("baseline_stars"),
  lastWebhookAt: integer("last_webhook_at"),
  updatedAt: integer("updated_at").notNull(),
});
