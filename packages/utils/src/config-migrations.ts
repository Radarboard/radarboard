/**
 * Extension config migration runner.
 *
 * Works with any extension type (integrations, plugins, widgets).
 * Compares a stored `_configVersion` against the migration list and
 * applies pending transformations in order.
 *
 * @example
 * ```ts
 * import { runConfigMigrations } from "@radarboard/utils/config-migrations";
 *
 * const result = runConfigMigrations(storedConfig, migrations, "0.3.0");
 * // result.config — the migrated config
 * // result.applied — number of migrations run
 * // result.version — final version stamp
 * ```
 */

import type { ExtensionConfigMigration } from "@radarboard/types/extension";

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

/** Result of running config migrations. */
export interface ConfigMigrationResult {
  /** The migrated config object. */
  config: Record<string, unknown>;
  /** Number of migrations that ran. */
  applied: number;
  /** The final version stamp. */
  version: string;
}

/**
 * Run pending config migrations on a stored config object.
 *
 * @param config - The stored config (may include `_configVersion`)
 * @param migrations - Ordered list of migrations from the extension descriptor
 * @param targetVersion - The extension's current version string
 * @returns The migrated config with updated `_configVersion`
 */
export function runConfigMigrations(
  config: Record<string, unknown>,
  migrations: ExtensionConfigMigration[],
  targetVersion: string
): ConfigMigrationResult {
  const storedVersion = (config._configVersion as string) ?? "0.0.0";

  // Already at or beyond the target version
  if (compareSemver(storedVersion, targetVersion) >= 0) {
    return { config, applied: 0, version: storedVersion };
  }

  // Find and run pending migrations
  const pending = migrations
    .filter((m) => compareSemver(m.version, storedVersion) > 0)
    .sort((a, b) => compareSemver(a.version, b.version));

  let migrated = { ...config };
  let applied = 0;

  for (const migration of pending) {
    migrated = migration.up(migrated);
    migrated._configVersion = migration.version;
    applied++;
  }

  // Stamp the target version
  migrated._configVersion = targetVersion;

  return { config: migrated, applied, version: targetVersion };
}
