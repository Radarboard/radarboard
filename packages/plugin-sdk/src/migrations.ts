/**
 * Plugin data migration runner.
 *
 * Compares a stored `_meta:version` key against the plugin descriptor's
 * migrations list and runs any pending `up()` functions in order.
 *
 * Migrations are idempotent by design — once a version is recorded,
 * it will not run again even if the app restarts.
 */

import type { PluginAPI, PluginMigration } from "./types";

const META_VERSION_KEY = "_meta:version";

/** Simple semver comparison: returns -1, 0, or 1. */
function compareSemver(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na < nb) return -1;
    if (na > nb) return 1;
  }
  return 0;
}

/** Summary returned after running plugin data migrations. */
export interface MigrationResult {
  /** Number of migrations that ran. */
  applied: number;
  /** The final stored version after migration. */
  currentVersion: string;
}

/**
 * Run pending migrations for a plugin.
 *
 * @param db - The plugin's namespaced DB API
 * @param migrations - Ordered list of migrations from the descriptor
 * @param targetVersion - The descriptor's current version string
 * @returns Summary of what was applied
 */
export async function runPluginMigrations(
  db: PluginAPI["db"],
  migrations: PluginMigration[],
  targetVersion: string
): Promise<MigrationResult> {
  // Read the currently stored version (null = fresh install)
  const storedVersion = await db.get<string>(META_VERSION_KEY);

  // Fresh install: no migrations needed, just stamp the version
  if (storedVersion === null) {
    await db.set(META_VERSION_KEY, targetVersion);
    return { applied: 0, currentVersion: targetVersion };
  }

  // Already at or beyond the target version
  if (compareSemver(storedVersion, targetVersion) >= 0) {
    return { applied: 0, currentVersion: storedVersion };
  }

  // Find and run pending migrations
  const pending = migrations.filter((m) => compareSemver(m.version, storedVersion) > 0);

  // Sort ascending just in case the descriptor order is wrong
  pending.sort((a, b) => compareSemver(a.version, b.version));

  let applied = 0;
  for (const migration of pending) {
    await migration.up(db);
    // Stamp the version after each successful migration
    await db.set(META_VERSION_KEY, migration.version);
    applied++;
  }

  // If the target version is beyond the last migration, stamp it
  const lastMigration = pending[pending.length - 1];
  if (
    pending.length === 0 ||
    (lastMigration && compareSemver(targetVersion, lastMigration.version) > 0)
  ) {
    await db.set(META_VERSION_KEY, targetVersion);
  }

  return { applied, currentVersion: targetVersion };
}
