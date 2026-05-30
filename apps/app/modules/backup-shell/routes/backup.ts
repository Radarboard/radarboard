import { createHash } from "node:crypto";
import { createLogger } from "@radarboard/logger/logger";
import { NextResponse } from "next/server";
import { deleteExpiredCache, withCache } from "@/db/cache";
import { getCacheRepo } from "@/db/repository";
import { errorJson } from "@/lib/api";
import { type BackupTask, buildBackupTasks } from "@/lib/backup-tasks";
import { getWebEnv } from "@/lib/env";
import { getDashboardPollingPreferences } from "@/lib/polling-settings";

const log = createLogger("api/backup");

export interface BackupManifest {
  timestamp: number;
  durationMs: number;
  totalTasks: number;
  refreshed: number;
  failed: number;
  expiredDeleted: number;
  taskHashes: Array<{ key: string; route: string; sha256: string | null }>;
  errors: string[];
}

const GLOBAL_KEY = "__radarboard_backup_manifest__" as const;
const MANIFEST_CACHE_KEY = "system:backup-manifest";
const MANIFEST_CACHE_ROUTE = "/api/system/backup/manifest";
/** Keep manifest in cache for 24h — it gets overwritten every cron cycle anyway. */
const MANIFEST_TTL_SECONDS = 86_400;

const RATE_LIMIT_DELAYS: Record<string, number> = {
  revenuecat: 15000,
  appstore: 2000,
};

const DEFAULT_DELAY = 500;

function storeManifest(manifest: BackupManifest): void {
  // In-memory for fast reads within the same server lifetime
  (globalThis as unknown as Record<string, BackupManifest>)[GLOBAL_KEY] = manifest;

  // Persist to database so the manifest survives server restarts
  try {
    const repo = getCacheRepo();
    repo
      .set({
        key: MANIFEST_CACHE_KEY,
        route: MANIFEST_CACHE_ROUTE,
        data: JSON.stringify(manifest),
        fetchedAt: Math.floor(Date.now() / 1000),
        ttlSeconds: MANIFEST_TTL_SECONDS,
      })
      .catch((err) => {
        log.error("Failed to persist backup manifest", {
          error: err instanceof Error ? err.message : String(err),
        });
      });
  } catch {
    // getCacheRepo may throw during startup — ignore
  }
}

export async function getLatestBackupManifest(): Promise<BackupManifest | null> {
  // Try in-memory first
  const mem = (globalThis as unknown as Record<string, BackupManifest | undefined>)[GLOBAL_KEY];
  if (mem) return mem;

  // Fall back to database
  try {
    const repo = getCacheRepo();
    const entry = await repo.get(MANIFEST_CACHE_KEY);
    if (entry) {
      const manifest = JSON.parse(entry.data) as BackupManifest;
      // Warm the in-memory cache for next read
      (globalThis as unknown as Record<string, BackupManifest>)[GLOBAL_KEY] = manifest;
      return manifest;
    }
  } catch {
    // Cache read failed
  }

  return null;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function refreshTask(task: BackupTask): Promise<unknown> {
  return withCache({
    key: task.key,
    route: task.route,
    ttlSeconds: task.ttlSeconds,
    fetchFn: task.fetchFn,
    forceRefresh: true,
  });
}

export async function handleRunBackup(request: Request): Promise<NextResponse> {
  const secret = getWebEnv("BACKUP_SECRET");
  if (!secret) {
    return errorJson(500, "BACKUP_SECRET not configured");
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return errorJson(401, "Unauthorized");
  }

  const start = Date.now();

  let expiredDeleted = 0;
  try {
    expiredDeleted = await deleteExpiredCache();
  } catch (err) {
    log.error("Cache cleanup failed", { error: err instanceof Error ? err.message : String(err) });
  }

  const { PROJECTS } = await import("@/config/projects");
  const pollingPreferences = await getDashboardPollingPreferences();
  const tasks = buildBackupTasks(PROJECTS, pollingPreferences);

  let refreshed = 0;
  let failed = 0;
  const errors: string[] = [];
  const taskHashes: BackupManifest["taskHashes"] = [];

  for (const task of tasks) {
    try {
      const data = await refreshTask(task);
      refreshed++;
      const hash = data ? createHash("sha256").update(JSON.stringify(data)).digest("hex") : null;
      taskHashes.push({ key: task.key, route: task.route, sha256: hash });
    } catch (error) {
      failed++;
      const message = error instanceof Error ? error.message : "Unknown error";
      log.error("Backup task failed", { route: task.route, key: task.key, error: message });
      errors.push(`${task.route} [${task.key}]: ${message}`);
      taskHashes.push({ key: task.key, route: task.route, sha256: null });
    }

    const delayMs = task.rateLimitGroup
      ? (RATE_LIMIT_DELAYS[task.rateLimitGroup] ?? DEFAULT_DELAY)
      : DEFAULT_DELAY;
    await delay(delayMs);
  }

  const manifest: BackupManifest = {
    timestamp: Date.now(),
    durationMs: Date.now() - start,
    totalTasks: tasks.length,
    refreshed,
    failed,
    expiredDeleted,
    taskHashes,
    errors,
  };
  storeManifest(manifest);

  return NextResponse.json({
    refreshed,
    failed,
    expiredDeleted,
    duration: manifest.durationMs,
    errors,
    manifestTimestamp: manifest.timestamp,
  });
}
