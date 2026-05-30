/**
 * Shared utility functions used across all plugins.
 *
 * Centralises helpers that were previously duplicated in
 * task-operations.ts, note-operations.ts, expense-operations.ts, etc.
 */

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

/** Generate a collision-resistant ID: `{timestamp}-{random}`. */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// Timestamps
// ---------------------------------------------------------------------------

/** Current time as ISO 8601 string. */
export function now(): string {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Relative time formatting
// ---------------------------------------------------------------------------

/**
 * Format an ISO date string as a compact relative time.
 *
 * @example formatRelativeTime("2024-01-01T00:00:00Z") // "5d ago"
 */
export function formatRelativeTime(value: string): string {
  const diff = Date.now() - new Date(value).getTime();
  return formatRelativeMs(diff);
}

/**
 * Format a millisecond epoch timestamp as a compact relative time.
 *
 * @example formatRelativeTimeMs(Date.now() - 60_000) // "1m ago"
 */
export function formatRelativeTimeMs(ms: number): string {
  const diff = Date.now() - ms;
  return formatRelativeMs(diff);
}

function formatRelativeMs(diff: number): string {
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ---------------------------------------------------------------------------
// Trash retention
// ---------------------------------------------------------------------------

/** Default retention period for soft-deleted items (30 days). */
export const TRASH_RETENTION_DAYS = 30;

/** Check if a trashed item has exceeded the retention period. */
export function isTrashRetentionExpired(trashedAt: string, days = TRASH_RETENTION_DAYS): boolean {
  const trashDate = new Date(trashedAt).getTime();
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return trashDate < cutoff;
}
