"use client";

import { NotificationCenterView } from "@radarboard/feature-notifications";
import { useNotifications } from "@radarboard/hooks/use-notifications";
import { useFormattedAppShortcutLabel } from "@/hooks/app/use-app-shortcuts";
import { useTauriTraySync } from "@/hooks/desktop/use-tauri-tray-sync";
import { isClientE2EMode } from "@/lib/e2e";

export function NotificationCenter() {
  const liveUpdatesEnabled = !isClientE2EMode();
  const notificationsShortcutLabel = useFormattedAppShortcutLabel("notifications");
  const { notifications, unreadCount, connected, markRead, dismiss, markAllRead } =
    useNotifications({ limit: 80, live: liveUpdatesEnabled });

  useTauriTraySync({ notifications, unreadCount, markAllRead });

  const tooltipLabel = notificationsShortcutLabel
    ? `Notifications ${notificationsShortcutLabel}`
    : "Notifications";

  return (
    <NotificationCenterView
      notifications={notifications}
      unreadCount={unreadCount}
      connected={connected}
      liveUpdatesEnabled={liveUpdatesEnabled}
      tooltipLabel={tooltipLabel}
      markRead={markRead}
      dismiss={dismiss}
      markAllRead={() => markAllRead()}
    />
  );
}
