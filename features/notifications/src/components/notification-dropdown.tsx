"use client";

import type { NotificationFeedItem } from "@radarboard/types/notifications";
import { Button } from "@radarboard/ui/button";
import { cn } from "@radarboard/utils/cn";
import { CheckCheck, ExternalLink, RadioTower } from "lucide-react";
import { createPortal } from "react-dom";
import { getNotificationOpenUrl } from "../utils/notification-open-url";
import { NotificationItem } from "./notification-item";

interface NotificationDropdownProps {
  anchorRect: DOMRect | null;
  open: boolean;
  unreadCount: number;
  notifications: NotificationFeedItem[];
  connected: boolean;
  onOpenPanel: () => void;
  onClose: () => void;
  onMarkRead: (deliveryId: string) => void;
  onMarkAllRead: () => void;
}

export function NotificationDropdown({
  anchorRect,
  open,
  unreadCount,
  notifications,
  connected,
  onOpenPanel,
  onClose,
  onMarkRead,
  onMarkAllRead,
}: NotificationDropdownProps) {
  if (!open || !anchorRect || typeof document === "undefined") return null;

  const previewItems = notifications.slice(0, 10);
  const width = Math.min(440, window.innerWidth - 32);
  const left = Math.max(16, anchorRect.right - width);
  const top = Math.min(anchorRect.bottom + 12, window.innerHeight - 24);

  return createPortal(
    <div
      data-notification-dropdown="true"
      className="fixed z-modal overflow-hidden rounded-panel border border-border bg-surface shadow-popover"
      style={{
        width,
        left,
        top,
        maxHeight: `min(820px, calc(100vh - ${top + 16}px))`,
      }}
    >
      <div className="flex items-center justify-between gap-3 border-border border-b px-4 py-3">
        <div>
          <div className="font-mono text-dim text-w-sm uppercase tracking-[0.22em]">
            Notifications
          </div>
          <div className="mt-1 text-dim/60 text-w-sm">
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {unreadCount > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="uppercase-none h-7 px-2 text-dim text-w-sm hover:text-foreground-secondary"
              onClick={onMarkAllRead}
            >
              <CheckCheck className="icon-xs" />
            </Button>
          ) : null}
          <div className="flex items-center gap-2 font-mono text-dim/60 text-w-sm uppercase tracking-[0.16em]">
            <RadioTower
              className={cn("icon-xs", connected ? "text-success" : "text-destructive")}
            />
            {connected ? "Live" : "Offline"}
          </div>
        </div>
      </div>

      {previewItems.length === 0 ? (
        <div className="px-4 py-10 text-center font-mono text-dim/60 text-w-sm">
          No notifications yet.
        </div>
      ) : (
        <div className="scrollbar-thin max-h-[700px] space-y-2 overflow-y-auto overflow-x-hidden p-3">
          {previewItems.map((item) => (
            <NotificationItem
              key={item.deliveryId}
              item={item}
              compact
              onClick={() => {
                const url = getNotificationOpenUrl(item);
                if (url) {
                  window.open(url, "_blank", "noopener,noreferrer");
                  if (item.status === "delivered") {
                    onMarkRead(item.deliveryId);
                  }
                  onClose();
                  return;
                }
                if (item.status === "delivered") {
                  onMarkRead(item.deliveryId);
                }
                onOpenPanel();
                onClose();
              }}
            />
          ))}
        </div>
      )}

      <div className="border-border border-t p-3">
        <Button
          variant="outline"
          className="uppercase-none h-8 w-full justify-between rounded-panel px-3 text-foreground-secondary text-w-sm"
          onClick={() => {
            onOpenPanel();
            onClose();
          }}
        >
          View all notifications
          <ExternalLink className="icon-xs" />
        </Button>
      </div>
    </div>,
    document.body
  );
}
