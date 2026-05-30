"use client";

import { useEffect } from "react";

const DEFAULT_DELAY_MS = 2500;

/**
 * Auto–mark-read after a delay when the user selects an unread item.
 *
 * Starts a timer when `selectedItemId` is non-null and `isUnread` is true.
 * Fires `onMarkRead(selectedItemId)` after `delayMs` if the item is still
 * selected and still unread. The timer is cleared on selection change,
 * when the item becomes read/archived, or on unmount.
 *
 * Shared across changelog, rss-reader, and any future plugin with
 * read/unread semantics.
 */
export function useDelayedMarkRead({
  selectedItemId,
  isUnread,
  onMarkRead,
  delayMs = DEFAULT_DELAY_MS,
}: {
  selectedItemId: string | null;
  isUnread: boolean;
  onMarkRead: (itemId: string) => void;
  delayMs?: number;
}) {
  useEffect(() => {
    if (!selectedItemId || !isUnread) return;

    const timer = window.setTimeout(() => {
      onMarkRead(selectedItemId);
    }, delayMs);

    return () => window.clearTimeout(timer);
  }, [selectedItemId, isUnread, onMarkRead, delayMs]);
}
