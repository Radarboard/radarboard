const SQLITE_GITHUB_STARS_STATEMENTS = [
  "CREATE TABLE IF NOT EXISTS github_repo_star_daily (repo_key TEXT NOT NULL, day TEXT NOT NULL, total_stars INTEGER NOT NULL, stars_gained INTEGER NOT NULL, source TEXT NOT NULL, updated_at INTEGER NOT NULL)",
  "CREATE UNIQUE INDEX IF NOT EXISTS github_repo_star_daily_repo_day_idx ON github_repo_star_daily(repo_key, day)",
  "CREATE INDEX IF NOT EXISTS github_repo_star_daily_day_idx ON github_repo_star_daily(day)",
  "CREATE TABLE IF NOT EXISTS github_repo_star_sync_state (repo_key TEXT PRIMARY KEY, backfill_status TEXT NOT NULL, next_page INTEGER, oldest_seen_starred_at TEXT, last_synced_at INTEGER, last_error TEXT, updated_at INTEGER NOT NULL)",
  "CREATE TABLE IF NOT EXISTS github_repo_star_event (source_event_id TEXT PRIMARY KEY, repo_key TEXT NOT NULL, action TEXT NOT NULL, user_login TEXT, occurred_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)",
  "CREATE INDEX IF NOT EXISTS github_repo_star_event_repo_idx ON github_repo_star_event(repo_key, occurred_at)",
  "CREATE INDEX IF NOT EXISTS github_repo_star_event_action_idx ON github_repo_star_event(action, occurred_at)",
  "CREATE TABLE IF NOT EXISTS github_repo_star_tracking (repo_key TEXT PRIMARY KEY, tracking_started_at INTEGER, baseline_stars INTEGER, last_webhook_at INTEGER, updated_at INTEGER NOT NULL)",
];

const SUPABASE_GITHUB_STARS_STATEMENTS = [
  "CREATE TABLE IF NOT EXISTS github_repo_star_daily (repo_key TEXT NOT NULL, day TEXT NOT NULL, total_stars INTEGER NOT NULL, stars_gained INTEGER NOT NULL, source TEXT NOT NULL, updated_at BIGINT NOT NULL)",
  "CREATE UNIQUE INDEX IF NOT EXISTS github_repo_star_daily_repo_day_idx ON github_repo_star_daily(repo_key, day)",
  "CREATE INDEX IF NOT EXISTS github_repo_star_daily_day_idx ON github_repo_star_daily(day)",
  "CREATE TABLE IF NOT EXISTS github_repo_star_sync_state (repo_key TEXT PRIMARY KEY, backfill_status TEXT NOT NULL, next_page INTEGER, oldest_seen_starred_at TEXT, last_synced_at BIGINT, last_error TEXT, updated_at BIGINT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS github_repo_star_event (source_event_id TEXT PRIMARY KEY, repo_key TEXT NOT NULL, action TEXT NOT NULL, user_login TEXT, occurred_at BIGINT NOT NULL, updated_at BIGINT NOT NULL)",
  "CREATE INDEX IF NOT EXISTS github_repo_star_event_repo_idx ON github_repo_star_event(repo_key, occurred_at)",
  "CREATE INDEX IF NOT EXISTS github_repo_star_event_action_idx ON github_repo_star_event(action, occurred_at)",
  "CREATE TABLE IF NOT EXISTS github_repo_star_tracking (repo_key TEXT PRIMARY KEY, tracking_started_at BIGINT, baseline_stars INTEGER, last_webhook_at BIGINT, updated_at BIGINT NOT NULL)",
];

const PLANETSCALE_GITHUB_STARS_STATEMENTS = [
  "CREATE TABLE IF NOT EXISTS github_repo_star_daily (repo_key VARCHAR(255) NOT NULL, day VARCHAR(10) NOT NULL, total_stars INT NOT NULL, stars_gained INT NOT NULL, source VARCHAR(32) NOT NULL, updated_at BIGINT NOT NULL, UNIQUE INDEX github_repo_star_daily_repo_day_idx (repo_key, day), INDEX github_repo_star_daily_day_idx (day))",
  "CREATE TABLE IF NOT EXISTS github_repo_star_sync_state (repo_key VARCHAR(255) PRIMARY KEY, backfill_status VARCHAR(32) NOT NULL, next_page INT NULL, oldest_seen_starred_at VARCHAR(30) NULL, last_synced_at BIGINT NULL, last_error TEXT NULL, updated_at BIGINT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS github_repo_star_event (source_event_id VARCHAR(255) PRIMARY KEY, repo_key VARCHAR(255) NOT NULL, action VARCHAR(32) NOT NULL, user_login VARCHAR(255) NULL, occurred_at BIGINT NOT NULL, updated_at BIGINT NOT NULL, INDEX github_repo_star_event_repo_idx (repo_key, occurred_at), INDEX github_repo_star_event_action_idx (action, occurred_at))",
  "CREATE TABLE IF NOT EXISTS github_repo_star_tracking (repo_key VARCHAR(255) PRIMARY KEY, tracking_started_at BIGINT NULL, baseline_stars INT NULL, last_webhook_at BIGINT NULL, updated_at BIGINT NOT NULL)",
];

export const SQLITE_GITHUB_STARS_MIGRATION_SQL = SQLITE_GITHUB_STARS_STATEMENTS.join(";\n");
export const SUPABASE_GITHUB_STARS_MIGRATION_SQL = SUPABASE_GITHUB_STARS_STATEMENTS.join(";\n");
export const PLANETSCALE_GITHUB_STARS_MIGRATION_SQL =
  PLANETSCALE_GITHUB_STARS_STATEMENTS.join(";\n");
