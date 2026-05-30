"use client";

import { API_ROUTES } from "@radarboard/types/api-routes";
import type { NotificationStreamMessage } from "@radarboard/types/notifications";
import { useSSE } from "./use-sse";

export function useNotificationStream(enabled = true) {
  return useSSE<NotificationStreamMessage>({
    url: API_ROUTES.notificationsStream,
    enabled,
  });
}
