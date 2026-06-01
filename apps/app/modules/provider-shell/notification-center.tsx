"use client";

import { useDemoMode } from "@radarboard/hooks/use-demo-mode";
import { useNotifications } from "@radarboard/hooks/use-notifications";
import type {
  NotificationDeliveryStatus,
  NotificationFeedItem,
  NotificationSeverity,
} from "@radarboard/types/notifications";
import { MOCK_NOTIFICATIONS } from "@radarboard/widget-engine/demo";
import { useCallback, useMemo, useState } from "react";
import { useFormattedAppShortcutLabel } from "@/hooks/app/use-app-shortcuts";
import { useTauriTraySync } from "@/hooks/desktop/use-tauri-tray-sync";
import { isClientE2EMode } from "@/lib/e2e";
import { getFeatureUiComponent } from "@/lib/extensions/runtime/ui/feature-ui";

const DEMO_NOTIFICATION_SEVERITY: Record<string, NotificationSeverity> = {
  github: "info",
  "google-search-console": "success",
  stripe: "success",
  vercel: "success",
};

interface NotificationCenterViewProps {
  notifications: NotificationFeedItem[];
  unreadCount: number;
  connected: boolean;
  liveUpdatesEnabled?: boolean;
  tooltipLabel?: string;
  markRead: (deliveryId: string) => void;
  dismiss: (deliveryId: string) => void;
  markAllRead: () => void;
}

const NotificationCenterView = getFeatureUiComponent<NotificationCenterViewProps>(
  "notifications",
  "center"
);

export function toDemoNotificationFeedItem(
  statusById: Record<string, NotificationDeliveryStatus>,
  nowSeconds: number
): NotificationFeedItem[] {
  return MOCK_NOTIFICATIONS.map((item) => {
    const occurredAt = Math.floor(new Date(item.createdAt).getTime() / 1000);
    const status = statusById[item.id] ?? (item.read ? "read" : "delivered");
    return {
      deliveryId: item.id,
      recordType: "event",
      notificationId: item.id,
      source: item.source,
      type: "demo",
      severity: DEMO_NOTIFICATION_SEVERITY[item.source] ?? "info",
      projectSlug: "pixel-studio",
      title: item.title,
      body: item.body,
      metadata: item.url ? { url: item.url } : {},
      occurredAt,
      createdAt: occurredAt,
      eventCount: null,
      status,
      channel: "in_app",
      deliveredAt: occurredAt,
      readAt: status === "read" ? nowSeconds : null,
    } satisfies NotificationFeedItem;
  }).filter((item) => item.status !== "dismissed");
}

export function NotificationCenter() {
  const liveUpdatesEnabled = !isClientE2EMode();
  const notificationsShortcutLabel = useFormattedAppShortcutLabel("notifications");
  const { isDemoMode } = useDemoMode();
  const [demoStatusById, setDemoStatusById] = useState<Record<string, NotificationDeliveryStatus>>(
    {}
  );
  const { notifications, unreadCount, connected, markRead, dismiss, markAllRead } =
    useNotifications({ limit: 80, live: liveUpdatesEnabled });

  const demoNotifications = useMemo(
    () => toDemoNotificationFeedItem(demoStatusById, Math.floor(Date.now() / 1000)),
    [demoStatusById]
  );

  const shouldUseDemoNotifications = isDemoMode && notifications.length === 0;
  const visibleNotifications = shouldUseDemoNotifications ? demoNotifications : notifications;
  const visibleUnreadCount = shouldUseDemoNotifications
    ? demoNotifications.filter((item) => item.status === "delivered").length
    : unreadCount;
  const visibleConnected = shouldUseDemoNotifications ? true : connected;

  const markDemoRead = useCallback((deliveryId: string) => {
    setDemoStatusById((current) => ({ ...current, [deliveryId]: "read" }));
  }, []);

  const dismissDemo = useCallback((deliveryId: string) => {
    setDemoStatusById((current) => ({ ...current, [deliveryId]: "dismissed" }));
  }, []);

  const markAllDemoRead = useCallback(() => {
    setDemoStatusById((current) => {
      const next = { ...current };
      for (const item of MOCK_NOTIFICATIONS) {
        if (next[item.id] !== "dismissed") {
          next[item.id] = "read";
        }
      }
      return next;
    });
  }, []);

  const handleMarkRead = shouldUseDemoNotifications ? markDemoRead : markRead;
  const handleDismiss = shouldUseDemoNotifications ? dismissDemo : dismiss;
  const handleMarkAllRead = shouldUseDemoNotifications ? markAllDemoRead : () => markAllRead();

  useTauriTraySync({
    notifications: visibleNotifications,
    unreadCount: visibleUnreadCount,
    markAllRead: handleMarkAllRead,
  });

  const tooltipLabel = notificationsShortcutLabel
    ? `Notifications ${notificationsShortcutLabel}`
    : "Notifications";

  return (
    NotificationCenterView && (
      <NotificationCenterView
        notifications={visibleNotifications}
        unreadCount={visibleUnreadCount}
        connected={visibleConnected}
        liveUpdatesEnabled={liveUpdatesEnabled}
        tooltipLabel={tooltipLabel}
        markRead={handleMarkRead}
        dismiss={handleDismiss}
        markAllRead={handleMarkAllRead}
      />
    )
  );
}
