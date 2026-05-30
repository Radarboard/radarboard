"use client";

import type { NotificationFeedItem } from "@radarboard/types/notifications";
import { useEffect, useRef } from "react";
import { isTauri } from "@/lib/platform";

interface TrayEventItem {
  deliveryId: string;
  title: string;
  severity: string;
  source: string;
}

/**
 * Hook that synchronizes notification state with the Tauri system tray.
 *
 * - Updates the tray icon state (normal/badge/critical/paused) based on unread count and severity.
 * - Sends the latest 5 notifications as "recent events" for the tray submenu.
 * - Listens for tray menu actions (pause, mark-all-read, resume, navigate).
 */
export function useTauriTraySync({
  notifications,
  unreadCount,
  markAllRead,
}: {
  notifications: NotificationFeedItem[];
  unreadCount: number;
  markAllRead: () => void;
}) {
  const prevStateRef = useRef<string>("");

  useEffect(() => {
    if (!isTauri()) return;

    const syncTray = async () => {
      try {
        const { invoke } = await import("@tauri-apps/api/core");

        // Determine tray state based on notifications
        const hasCritical = notifications.some(
          (n) => n.severity === "critical" && n.status !== "read" && n.status !== "dismissed"
        );

        let state = "normal";
        if (hasCritical) {
          state = "critical";
        } else if (unreadCount > 0) {
          state = "badge";
        }

        // Build status text
        const statusText =
          unreadCount === 0
            ? "No unread notifications"
            : `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`;

        // Only update if state actually changed
        const stateKey = `${state}-${unreadCount}`;
        if (stateKey !== prevStateRef.current) {
          prevStateRef.current = stateKey;
          await invoke("set_tray_state", {
            state,
            unreadCount,
            statusText,
          });
        }

        // Send latest 5 events for the "Recent Events" tray submenu
        const recentEvents: TrayEventItem[] = notifications.slice(0, 5).map((n) => ({
          deliveryId: n.deliveryId,
          title: n.title,
          severity: n.severity,
          source: n.source,
        }));

        await invoke("update_tray_recent_events", { events: recentEvents });
      } catch (_err) {
        // Not in Tauri or invoke failed — silently ignore
      }
    };

    syncTray();
  }, [notifications, unreadCount]);

  // Listen for tray menu events
  useEffect(() => {
    if (!isTauri()) return;

    const unlisten: (() => void)[] = [];

    const setupListeners = async () => {
      const { listen } = await import("@tauri-apps/api/event");

      const unlistenMarkRead = await listen("mark-all-read", () => {
        markAllRead();
      });
      unlisten.push(unlistenMarkRead);

      const unlistenPause = await listen<number>("pause-notifications", (_event) => {
        // Pause handling is owned by native code for now.
      });
      unlisten.push(unlistenPause);

      const unlistenResume = await listen("resume-notifications", () => {
        // Resume handling is owned by native code for now.
      });
      unlisten.push(unlistenResume);

      const unlistenNavigate = await listen<string>("navigate", (event) => {
        // Navigate the main window to a specific path
        if (typeof window !== "undefined" && event.payload) {
          window.location.href = event.payload;
        }
      });
      unlisten.push(unlistenNavigate);
    };

    setupListeners();

    return () => {
      for (const fn of unlisten) {
        fn();
      }
    };
  }, [markAllRead]);
}
