"use client";

import type { NotificationFeedItem } from "@radarboard/types/notifications";
import { Badge } from "@radarboard/ui/badge";
import { Button } from "@radarboard/ui/button";
import { Input } from "@radarboard/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@radarboard/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@radarboard/ui/tabs";
import { cn } from "@radarboard/utils/cn";
import { ChevronDown, ChevronRight, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { NotificationItem } from "./notification-item";
import { groupNotifications } from "../utils/notification-grouping";

type FilterTab = "all" | "critical" | "warning" | "info" | "success";

interface NotificationPanelProps {
  open: boolean;
  notifications: NotificationFeedItem[];
  unreadCount: number;
  connected: boolean;
  onClose: () => void;
  onMarkRead: (deliveryId: string) => void;
  onDismiss: (deliveryId: string) => void;
  onMarkAllRead: () => void;
}

const TABS: Array<{ id: FilterTab; label: string }> = [
  { id: "all", label: "All" },
  { id: "critical", label: "Critical" },
  { id: "warning", label: "Warnings" },
  { id: "info", label: "Info" },
  { id: "success", label: "Success" },
];

export function NotificationPanel({
  open,
  notifications,
  unreadCount,
  connected,
  onClose,
  onMarkRead,
  onDismiss,
  onMarkAllRead,
}: NotificationPanelProps) {
  const [tab, setTab] = useState<FilterTab>("all");
  const [source, setSource] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  const sourceOptions = useMemo(() => {
    return Array.from(new Set(notifications.map((item) => item.source))).sort();
  }, [notifications]);

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return notifications.filter((item) => {
      if (tab !== "all" && item.severity !== tab) return false;
      if (source !== "all" && item.source !== source) return false;
      if (!query) return true;
      return (
        item.title.toLowerCase().includes(query) ||
        item.body?.toLowerCase().includes(query) ||
        item.source.toLowerCase().includes(query) ||
        item.projectSlug?.toLowerCase().includes(query)
      );
    });
  }, [notifications, searchQuery, source, tab]);

  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    const div = document.createElement("div");
    div.id = "notification-portal";
    document.body.appendChild(div);
    setPortalContainer(div);
    return () => {
      document.body.removeChild(div);
    };
  }, []);

  if (!open || !portalContainer) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-modal flex"
      role="dialog"
      aria-modal="true"
      aria-label="Notifications panel"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-background/80 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close notifications panel"
        tabIndex={-1}
      />

      <div className="relative ml-auto flex h-full w-[min(520px,100vw)] flex-col border-border border-l bg-surface shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-border border-b bg-surface-raised px-5 py-4">
          <div>
            <div className="font-mono text-dim text-w-sm uppercase tracking-[0.22em]">
              Notifications
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge className="bg-secondary text-foreground-secondary">
                {notifications.length} loaded
              </Badge>
              <Badge
                className={cn(
                  connected
                    ? "border-success/20 bg-success/10 text-success"
                    : "border-destructive/20 bg-destructive/10 text-destructive"
                )}
              >
                {connected ? "Live stream" : "Stream disconnected"}
              </Badge>
              {unreadCount > 0 ? <Badge variant="warning">{unreadCount} unread</Badge> : null}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="uppercase-none h-8 px-3 text-foreground-secondary text-w-sm"
              onClick={onMarkAllRead}
              disabled={unreadCount === 0}
            >
              Mark all read
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="uppercase-none h-8 w-8 text-dim hover:text-foreground"
              onClick={onClose}
              aria-label="Close notifications"
            >
              <X className="icon-sm" />
            </Button>
          </div>
        </div>

        <div className="space-y-4 border-border border-b px-5 py-4">
          <Tabs value={tab} onValueChange={(v) => setTab(v as FilterTab)}>
            <TabsList>
              {TABS.map((tabOption) => {
                const count =
                  tabOption.id === "all"
                    ? notifications.length
                    : notifications.filter((item) => item.severity === tabOption.id).length;
                return (
                  <TabsTrigger key={tabOption.id} value={tabOption.id} className="gap-2">
                    <span>{tabOption.label}</span>
                    <span className="text-w-sm opacity-60">{count}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>

          <div className="grid grid-cols-[1fr_140px] gap-3 max-sm:grid-cols-1">
            <div className="relative block min-w-0">
              <Search className="icon-xs pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-dim" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search notifications..."
                className="h-9 w-full pl-9"
                aria-label="Search notifications"
              />
            </div>

            <Select value={source} onValueChange={setSource}>
              <SelectTrigger className="h-9" aria-label="Filter by source">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                {sourceOptions.map((sourceOption) => (
                  <SelectItem key={sourceOption} value={sourceOption}>
                    {sourceOption}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-5">
          {filtered.length === 0 ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center rounded-panel border border-border border-dashed bg-secondary/30 px-8 text-center">
              <div className="font-mono text-dim text-w-sm uppercase tracking-[0.2em]">
                All caught up
              </div>
              <p className="mt-3 max-w-sidebar text-muted-foreground text-w-base leading-relaxed">
                Nothing matches the current filters. Try a different tab, source, or search term.
              </p>
            </div>
          ) : (
            <GroupedNotificationList
              notifications={filtered}
              onMarkRead={onMarkRead}
              onDismiss={onDismiss}
            />
          )}
        </div>
      </div>
    </div>,
    portalContainer
  );
}

// ---------------------------------------------------------------------------
// Grouped notification list
// ---------------------------------------------------------------------------

function GroupedNotificationList({
  notifications,
  onMarkRead,
  onDismiss,
}: {
  notifications: NotificationFeedItem[];
  onMarkRead: (deliveryId: string) => void;
  onDismiss: (deliveryId: string) => void;
}) {
  const groups = useMemo(() => groupNotifications(notifications), [notifications]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      {groups.map((group) => {
        const groupKey = group.representative.deliveryId;

        if (group.count === 1) {
          return (
            <NotificationItem
              key={groupKey}
              item={group.representative}
              onMarkRead={onMarkRead}
              onDismiss={onDismiss}
            />
          );
        }

        const isExpanded = expandedGroups.has(groupKey);

        return (
          <div key={groupKey} className="rounded-lg border border-border">
            <Button
              type="button"
              variant="ghost"
              uppercase={false}
              fullWidth
              className="h-auto justify-start gap-2 px-3 py-2 text-left hover:bg-muted/50"
              onClick={() => toggleGroup(groupKey)}
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3 shrink-0 text-dim" />
              ) : (
                <ChevronRight className="h-3 w-3 shrink-0 text-dim" />
              )}
              <span className="min-w-0 flex-1 truncate font-mono text-w-sm">{group.source}</span>
              <Badge variant="secondary" className="shrink-0">
                {group.count}
              </Badge>
            </Button>

            {isExpanded && (
              <div className="space-y-2 border-border border-t px-2 py-2">
                {group.items.map((item) => (
                  <NotificationItem
                    key={item.deliveryId}
                    item={item}
                    onMarkRead={onMarkRead}
                    onDismiss={onDismiss}
                  />
                ))}
              </div>
            )}

            {!isExpanded && (
              <div className="px-3 pb-2">
                <NotificationItem
                  item={group.representative}
                  onMarkRead={onMarkRead}
                  onDismiss={onDismiss}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
