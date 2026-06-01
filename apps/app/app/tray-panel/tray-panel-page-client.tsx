"use client";

import { useNotifications } from "@radarboard/hooks/use-notifications";
import type { NotificationFeedItem } from "@radarboard/types/notifications";
import { useEffect } from "react";
import { getFeatureUiComponent } from "@/lib/extensions/runtime/ui/feature-ui";

const _SEVERITY_DOT: Record<string, string> = {
  critical: "bg-destructive",
  warning: "bg-warning",
  success: "bg-success",
  info: "bg-accent",
};

interface NotificationItemProps {
  item: NotificationFeedItem;
  compact?: boolean;
  onMarkRead?: (deliveryId: string) => void;
  onClick?: () => void;
}

const NotificationItem = getFeatureUiComponent<NotificationItemProps>("notifications", "item");

function TrayNotificationItem({
  item,
  onMarkRead,
}: {
  item: NotificationFeedItem;
  onMarkRead: (id: string) => void;
}) {
  const handleClick = () => {
    if (item.status === "delivered") {
      onMarkRead(item.deliveryId);
    }
  };

  return NotificationItem ? (
    <NotificationItem item={item} compact onMarkRead={onMarkRead} onClick={handleClick} />
  ) : null;
}

export function TrayPanelPageClient() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications({
    limit: 10,
    live: true,
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        import("@tauri-apps/api/core").then(({ invoke }) => {
          invoke("toggle_tray_panel").catch(() => undefined);
        });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="flex h-screen flex-col overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex items-center justify-between border-border border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="font-mono text-foreground text-w-sm uppercase tracking-[0.2em]">
            Notifications
          </h2>
          {unreadCount > 0 && (
            <span className="rounded-full bg-accent px-2 py-0.5 font-mono text-accent-foreground text-w-xs">
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={() => markAllRead()}
            className="font-mono text-accent text-w-xs uppercase tracking-[0.16em] hover:text-accent/80"
          >
            Mark All
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="flex h-full items-center justify-center p-6">
            <p className="font-mono text-dim text-w-sm">No notifications</p>
          </div>
        ) : (
          <div className="space-y-1 p-2">
            {notifications.map((item) => (
              <TrayNotificationItem key={item.deliveryId} item={item} onMarkRead={markRead} />
            ))}
          </div>
        )}
      </div>

      <div className="border-border border-t px-4 py-2.5">
        <button
          type="button"
          onClick={() => {
            import("@tauri-apps/api/core").then(({ invoke }) => {
              invoke("toggle_tray_panel").catch(() => undefined);
            });
            import("@tauri-apps/api/event").then(({ emit }) => {
              emit("navigate", "/").catch(() => undefined);
            });
          }}
          className="w-full text-center font-mono text-dim text-w-xs uppercase tracking-[0.16em] hover:text-foreground"
        >
          View All in App →
        </button>
      </div>
    </div>
  );
}
