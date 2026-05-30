"use client";

import { API_ROUTES } from "@radarboard/types/api-routes";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { apiFetcher, buildUrl } from "./fetcher";
import { useNotificationStream } from "./use-notification-stream";
import { usePollingInterval } from "./use-polling-interval";

interface UnreadCountResponse {
  unreadCount: number;
}

export function useUnreadCount() {
  const [liveUnreadCount, setLiveUnreadCount] = useState<number | null>(null);
  const key = buildUrl(API_ROUTES.notifications, { countOnly: "1" });
  const refreshInterval = usePollingInterval("notifications-badge");
  const { data, error, isLoading, mutate } = useSWR<UnreadCountResponse>(key, apiFetcher, {
    refreshInterval,
    revalidateOnFocus: false,
  });

  const stream = useNotificationStream(true);

  useEffect(() => {
    if (stream.data?.type === "badge") {
      setLiveUnreadCount(stream.data.payload.unreadCount);
    }
  }, [stream.data]);

  return {
    unreadCount: liveUnreadCount ?? data?.unreadCount ?? 0,
    loading: isLoading,
    error: error?.message ?? null,
    refetch: mutate,
    connected: stream.connected,
  };
}
