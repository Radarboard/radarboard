"use client";

import { useAudioNotifications } from "@radarboard/hooks/use-audio-notifications";
import { useDesktopNotifications } from "@radarboard/hooks/use-desktop-notifications";
import { useNotificationPreferences } from "@radarboard/hooks/use-notification-preferences";
import type { NotificationFeedItem } from "@radarboard/types/notifications";
import { Button } from "@radarboard/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@radarboard/ui/tooltip";
import { cn } from "@radarboard/utils/cn";
import { Bell, BellDot } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { NotificationDropdown } from "./notification-dropdown";
import { NotificationPanel } from "./notification-panel";

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

export function NotificationCenterView({
  notifications,
  unreadCount,
  connected,
  liveUpdatesEnabled = true,
  tooltipLabel = "Notifications",
  markRead,
  dismiss,
  markAllRead,
}: NotificationCenterViewProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  const { preferences } = useNotificationPreferences();

  // Desktop notifications are enabled if the global preference includes "desktop" channel
  const desktopEnabled = useMemo(() => {
    const global = preferences.find((p) => p.id === "global");
    return global?.channels.includes("desktop") ?? false;
  }, [preferences]);

  const soundEnabled = useMemo(() => {
    const global = preferences.find((p) => p.id === "global");
    return global?.channels.includes("sound") ?? false;
  }, [preferences]);

  useDesktopNotifications(liveUpdatesEnabled && desktopEnabled);
  useAudioNotifications(liveUpdatesEnabled && soundEnabled);
  const hasCriticalUnread = notifications.some(
    (item) => item.status === "delivered" && item.severity === "critical"
  );

  useEffect(() => {
    if (!dropdownOpen) return;
    const updateAnchor = () => {
      setAnchorRect(rootRef.current?.getBoundingClientRect() ?? null);
    };

    updateAnchor();

    function onPointerDown(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (
        !rootRef.current?.contains(target as Node) &&
        !target?.closest('[data-notification-dropdown="true"]')
      ) {
        setDropdownOpen(false);
      }
    }

    window.addEventListener("resize", updateAnchor);
    window.addEventListener("scroll", updateAnchor, true);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      window.removeEventListener("resize", updateAnchor);
      window.removeEventListener("scroll", updateAnchor, true);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [dropdownOpen]);

  useEffect(() => {
    const onToggleNotifications = () => {
      setDropdownOpen((open) => !open);
    };

    const onShortcutToggle = (event: Event) => {
      onToggleNotifications();
      event.preventDefault?.();
    };

    window.addEventListener("radarboard:toggle-notifications", onShortcutToggle);

    return () => {
      window.removeEventListener("radarboard:toggle-notifications", onShortcutToggle);
    };
  }, []);

  return (
    <>
      <div ref={rootRef} className="relative shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDropdownOpen((open) => !open)}
              aria-label="Notifications"
              className={cn(
                "uppercase-none relative inline-flex h-7 min-w-8 items-center justify-center rounded-none border px-2 transition-colors 2xl:gap-2 2xl:px-2.5",
                dropdownOpen
                  ? "border-accent bg-accent/10 text-foreground"
                  : "border-border bg-surface text-dim hover:text-foreground-secondary"
              )}
            >
              {hasCriticalUnread ? <BellDot className="icon-sm" /> : <Bell className="icon-sm" />}
              <span className="hidden font-mono text-w-sm uppercase tracking-wider 2xl:inline">
                Notifications
              </span>
              {unreadCount > 0 ? (
                <span
                  className={cn(
                    "pointer-events-none absolute -top-1.5 -right-1.5 min-w-4 rounded-full px-1 text-center font-mono text-w-sm leading-4",
                    hasCriticalUnread ? "text-destructive-foreground" : "text-accent-foreground",
                    hasCriticalUnread ? "bg-destructive" : "bg-accent"
                  )}
                >
                  {unreadCount > 99 ? "99+" : String(unreadCount)}
                </span>
              ) : null}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{tooltipLabel}</TooltipContent>
        </Tooltip>

        <NotificationDropdown
          anchorRect={anchorRect}
          open={dropdownOpen}
          unreadCount={unreadCount}
          notifications={notifications}
          connected={connected}
          onOpenPanel={() => setPanelOpen(true)}
          onClose={() => setDropdownOpen(false)}
          onMarkRead={markRead}
            onMarkAllRead={markAllRead}
          />
      </div>

      <NotificationPanel
        open={panelOpen}
        notifications={notifications}
        unreadCount={unreadCount}
        connected={connected}
        onClose={() => setPanelOpen(false)}
        onMarkRead={markRead}
        onDismiss={dismiss}
        onMarkAllRead={markAllRead}
      />
    </>
  );
}
