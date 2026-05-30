/**
 * Local backup cron -- runs alongside the dev server.
 *
 * Periodically calls POST /api/backup to refresh all cached API data.
 * Uses the same BACKUP_SECRET from .env for authentication.
 *
 * Usage:
 *   pnpm --filter @radarboard/app run backup:cron
 *   (or automatically via turbo dev with the "with" config)
 *
 * Configure interval via BACKUP_INTERVAL_MS env var (default: 15 minutes).
 */

const BASE_URL = process.env.BACKUP_CRON_URL ?? "http://localhost:3000";
const SECRET = process.env.BACKUP_SECRET;
const INTERVAL_MS = Number(process.env.BACKUP_INTERVAL_MS) || 15 * 60 * 1000; // 15 min

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTime(): string {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
}

async function runBackup(): Promise<void> {
  if (!SECRET) {
    console.log(`[backup-cron] [${formatTime()}] BACKUP_SECRET not set, skipping`);
    return;
  }

  try {
    console.log(`[backup-cron] [${formatTime()}] Starting backup...`);

    const res = await fetch(`${BASE_URL}/api/backup`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SECRET}`,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[backup-cron] [${formatTime()}] Failed (${res.status}): ${text}`);
      return;
    }

    const data = (await res.json()) as {
      refreshed: number;
      failed: number;
      duration: number;
      errors: string[];
    };

    console.log(
      `[backup-cron] [${formatTime()}] Done: ${data.refreshed} refreshed, ${data.failed} failed, took ${formatDuration(data.duration)}`
    );

    if (data.errors.length > 0) {
      for (const err of data.errors) {
        console.error(`[backup-cron]   Error: ${err}`);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[backup-cron] [${formatTime()}] Request failed: ${message}`);
  }
}

// --- Main ---

const isOnce = process.argv.includes("--once");

if (isOnce) {
  // Single run mode: pnpm backup:now
  console.log(`[backup] Running single backup against ${BASE_URL}/api/backup`);
  runBackup()
    .then(() => process.exit(0))
    .catch(() => {
      /* fire-and-forget */
    });
} else {
  // Cron mode: pnpm backup:cron
  console.log(`[backup-cron] Starting local backup cron`);
  console.log(`[backup-cron] Interval: ${formatDuration(INTERVAL_MS)}`);
  console.log(`[backup-cron] Target: ${BASE_URL}/api/backup`);
  console.log(
    `[backup-cron] Secret: ${SECRET ? "configured" : "NOT SET (backups will be skipped)"}`
  );
  console.log("");

  // Run once on startup (after a short delay to let the dev server start)
  const STARTUP_DELAY = 10_000; // 10 seconds
  console.log(`[backup-cron] First backup in ${formatDuration(STARTUP_DELAY)}...`);

  setTimeout(() => {
    runBackup().catch(() => {
      /* fire-and-forget */
    });

    // Then run on interval
    setInterval(
      () =>
        runBackup().catch(() => {
          /* fire-and-forget */
        }),
      INTERVAL_MS
    );
  }, STARTUP_DELAY);

  // Keep the process alive
  process.on("SIGINT", () => {
    console.log("\n[backup-cron] Shutting down");
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    console.log("\n[backup-cron] Shutting down");
    process.exit(0);
  });
}
