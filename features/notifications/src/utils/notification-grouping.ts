/**
 * Notification grouping — clusters related notifications by time window.
 *
 * Groups notifications from the same source within a configurable time window
 * (default: 5 minutes). Each group shows a count badge and can be expanded.
 */

import type { NotificationFeedItem } from "@radarboard/types/notifications";

/** Default grouping window in milliseconds (5 minutes). */
const GROUP_WINDOW_MS = 5 * 60 * 1000;

export interface NotificationGroup {
  /** The most recent item in the group (shown as the representative). */
  representative: NotificationFeedItem;
  /** All items in the group (including the representative). */
  items: NotificationFeedItem[];
  /** Source that all items share. */
  source: string;
  /** Number of items in the group. */
  count: number;
}

/**
 * Group notifications from the same source that occur within `windowMs` of each other.
 *
 * Items are assumed to be sorted by `occurredAt` descending (most recent first).
 * Single-item groups are returned as-is (count=1).
 */
export function groupNotifications(
  notifications: NotificationFeedItem[],
  windowMs = GROUP_WINDOW_MS
): NotificationGroup[] {
  if (notifications.length === 0) return [];
  const first = notifications[0];
  if (!first) return [];

  const groups: NotificationGroup[] = [];
  let currentGroup: NotificationFeedItem[] = [first];
  let currentSource = first.source ?? "unknown";
  let currentTime = first.occurredAt;

  for (let i = 1; i < notifications.length; i++) {
    const item = notifications[i];
    if (!item) continue;
    const timeDiff = Math.abs(currentTime - item.occurredAt) * 1000; // occurredAt is in seconds

    if (item.source === currentSource && timeDiff <= windowMs) {
      currentGroup.push(item);
    } else {
      const representative = currentGroup[0];
      if (!representative) continue;
      groups.push({
        representative,
        items: currentGroup,
        source: currentSource,
        count: currentGroup.length,
      });
      currentGroup = [item];
      currentSource = item.source ?? "unknown";
      currentTime = item.occurredAt;
    }
  }

  // Push the last group
  const representative = currentGroup[0];
  if (!representative) return groups;
  groups.push({
    representative,
    items: currentGroup,
    source: currentSource,
    count: currentGroup.length,
  });

  return groups;
}
