"use client";

import type { NotificationFeedItem } from "@radarboard/types/notifications";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNotificationStream } from "./use-notification-stream";

export type DesktopPermission = "default" | "granted" | "denied" | "unsupported";

function getPermission(): DesktopPermission {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission as DesktopPermission;
}

function fireDesktopNotification(item: NotificationFeedItem): void {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  if (document.hasFocus()) return;

  const n = new Notification(item.title, {
    body: item.body ?? item.source,
    tag: item.notificationId,
    // Only vibrate / persist for critical
    requireInteraction: item.severity === "critical",
    silent: item.severity === "info",
  });

  // Auto-close info notifications after 8 seconds
  if (item.severity === "info") {
    setTimeout(() => n.close(), 8_000);
  }
}

export function useDesktopNotifications(enabled = true) {
  const [permission, setPermission] = useState<DesktopPermission>(getPermission);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const stream = useNotificationStream(enabled);

  useEffect(() => {
    if (!enabled) return;
    const msg = stream.data;
    if (!msg || msg.type !== "event") return;
    if (!enabledRef.current) return;
    fireDesktopNotification(msg.payload);
  }, [stream.data, enabled]);

  const requestPermission = useCallback(async (): Promise<DesktopPermission> => {
    if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
    if (Notification.permission === "granted") {
      setPermission("granted");
      return "granted";
    }
    const result = await Notification.requestPermission();
    setPermission(result as DesktopPermission);
    return result as DesktopPermission;
  }, []);

  return { permission, requestPermission };
}
