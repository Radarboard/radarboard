export const CHANGELOG_PLUGIN_ID = "changelog";

export const CHANGELOG_DB_KEYS = {
  watches: "changelog:watches",
  trackedPackages: "changelog:tracked-packages",
  entries: "changelog:entries",
  syncState: "changelog:sync-state",
  entryMeta: "changelog:entry-meta",
} as const;

export const CHANGELOG_SYNC_INTERVAL_MS = 15 * 60 * 1000;
