"use client";

import { API_ROUTES } from "@radarboard/types/api-routes";
import type {
  NotificationFeedItem,
  NotificationSeverity,
  NotificationStreamMessage,
} from "@radarboard/types/notifications";
import { useCallback, useEffect, useRef } from "react";
import useSWR from "swr";
import { apiFetcher, buildUrl } from "./fetcher";
import { useNotificationStream } from "./use-notification-stream";
import { usePollingInterval } from "./use-polling-interval";

interface NotificationsResponse {
  items: NotificationFeedItem[];
  nextCursor: number | null;
  unreadCount: number;
}

interface UseNotificationsOptions {
  source?: string;
  severity?: NotificationSeverity;
  projectSlug?: string;
  status?: "all" | "unread" | "read";
  includeDismissed?: boolean;
  limit?: number;
  live?: boolean;
}

function matchesFilters(
  item: NotificationFeedItem,
  options: Required<
    Pick<UseNotificationsOptions, "status" | "includeDismissed" | "limit" | "live">
  > &
    Pick<UseNotificationsOptions, "source" | "severity" | "projectSlug">
): boolean {
  if (options.source && options.source !== item.source) return false;
  if (options.severity && options.severity !== item.severity) return false;
  if (options.projectSlug && options.projectSlug !== (item.projectSlug ?? undefined)) return false;
  if (options.status === "read" && item.status !== "read") return false;
  if (options.status === "unread" && item.status !== "delivered") return false;
  if (!options.includeDismissed && item.status === "dismissed") return false;
  return true;
}

function applyStreamMessage(
  current: NotificationsResponse | undefined,
  message: NotificationStreamMessage,
  options: Required<
    Pick<UseNotificationsOptions, "status" | "includeDismissed" | "limit" | "live">
  > &
    Pick<UseNotificationsOptions, "source" | "severity" | "projectSlug">
): NotificationsResponse | undefined {
  if (!current) return current;

  if (message.type === "badge") {
    return { ...current, unreadCount: message.payload.unreadCount };
  }

  if (message.type === "status") {
    const items = current.items
      .map((item) =>
        item.deliveryId === message.payload.deliveryId
          ? { ...item, status: message.payload.status, readAt: Math.floor(Date.now() / 1000) }
          : item
      )
      .filter((item) => options.includeDismissed || item.status !== "dismissed");
    return { ...current, items };
  }

  if (!matchesFilters(message.payload, options)) {
    return current;
  }

  const items = [message.payload, ...current.items];
  const limit = options.limit ?? 50;
  return {
    ...current,
    items: items.slice(0, limit),
  };
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const {
    source,
    severity,
    projectSlug,
    status = "all",
    includeDismissed = false,
    limit = 50,
    live = true,
  } = options;

  const key = buildUrl(API_ROUTES.notifications, {
    source,
    severity,
    projectSlug,
    status,
    includeDismissed: includeDismissed ? "1" : null,
    limit: String(limit),
  });
  const refreshInterval = usePollingInterval("notifications-feed");

  const { data, error, isLoading, mutate } = useSWR<NotificationsResponse>(key, apiFetcher, {
    refreshInterval: live ? 0 : refreshInterval,
    revalidateOnFocus: false,
  });

  const stream = useNotificationStream(live);

  const optionsRef = useRef({
    source,
    severity,
    projectSlug,
    status,
    includeDismissed,
    limit,
    live,
  });
  optionsRef.current = { source, severity, projectSlug, status, includeDismissed, limit, live };

  useEffect(() => {
    if (!stream.data) return;
    mutate(
      (current) =>
        applyStreamMessage(current, stream.data as NotificationStreamMessage, optionsRef.current),
      { revalidate: false }
    ).catch(() => {
      /* fire-and-forget */
    });
  }, [mutate, stream.data]);

  const postAction = useCallback(
    async (body: Record<string, unknown>) => {
      const res = await fetch(API_ROUTES.notifications, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        throw new Error(`Notification action failed: ${res.status}`);
      }
      await mutate();
    },
    [mutate]
  );

  const markRead = useCallback(
    (id: string) => postAction({ action: "mark_read", id }),
    [postAction]
  );
  const dismiss = useCallback(
    (id: string) => postAction({ action: "mark_dismissed", id }),
    [postAction]
  );
  const markAllRead = useCallback(
    (filter?: { source?: string; projectSlug?: string }) =>
      postAction({ action: "mark_all_read", ...filter }),
    [postAction]
  );

  return {
    notifications: data?.items ?? [],
    unreadCount: data?.unreadCount ?? 0,
    nextCursor: data?.nextCursor ?? null,
    loading: isLoading,
    error: error?.message ?? null,
    connected: stream.connected,
    refetch: mutate,
    markRead,
    dismiss,
    markAllRead,
  };
}
