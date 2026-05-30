"use client";

import type { NotificationFeedItem } from "@radarboard/types/notifications";
import { Badge } from "@radarboard/ui/badge";
import { Button } from "@radarboard/ui/button";
import { cn } from "@radarboard/utils/cn";
import type { LucideIcon } from "lucide-react";
import { Check, CircleDot, GitMerge, GitPullRequest, Rocket, Star, Tag, X } from "lucide-react";
import type { KeyboardEvent, ReactNode } from "react";
import { RemoteServiceIcon } from "./remote-service-icon";
import { getNotificationOpenUrl } from "../utils/notification-open-url";
import { getServiceFaviconUrl } from "../utils/service-favicons";

function formatRelativeTime(unixSeconds: number): string {
  const diff = Math.max(0, Math.floor(Date.now() / 1000) - unixSeconds);
  if (diff < 60) return "now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

const GITHUB_MENTION_RE = /@(\w[\w-]*)/g;

function NotificationBody({ body, source }: { body: string; source: string }) {
  if (source !== "github") return body;

  const parts: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of body.matchAll(GITHUB_MENTION_RE)) {
    const username = match[1];
    const start = match.index;

    if (start > lastIndex) {
      parts.push(body.slice(lastIndex, start));
    }

    parts.push(
      <a
        key={start}
        href={`https://github.com/${username}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-accent hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        @{username}
      </a>
    );

    lastIndex = start + match[0].length;
  }

  if (lastIndex < body.length) {
    parts.push(body.slice(lastIndex));
  }

  return parts.length > 0 ? parts : body;
}

const SEVERITY_STYLES = {
  critical: {
    border: "border-l-destructive",
    tint: "bg-destructive/10",
    label: "text-destructive",
    badge: "destructive" as const,
  },
  warning: {
    border: "border-l-warning",
    tint: "bg-warning/10",
    label: "text-warning",
    badge: "warning" as const,
  },
  info: {
    border: "border-l-accent",
    tint: "bg-accent/10",
    label: "text-accent",
    badge: "default" as const,
  },
  success: {
    border: "border-l-success",
    tint: "bg-success/10",
    label: "text-success",
    badge: "success" as const,
  },
};

const EVENT_TYPE_ICONS: Record<string, { icon: LucideIcon; className: string }> = {
  "star.received": { icon: Star, className: "text-warning" },
  "star.removed": { icon: Star, className: "text-dim" },
  "deploy.succeeded": { icon: Rocket, className: "text-success" },
  "deploy.failed": { icon: Rocket, className: "text-destructive" },
  "pr.opened": { icon: GitPullRequest, className: "text-accent" },
  "pr.merged": { icon: GitMerge, className: "text-success" },
  "version.published": { icon: Tag, className: "text-accent" },
  "issue.opened": { icon: CircleDot, className: "text-accent" },
};

function ItemIcon({
  source,
  eventType,
  severityLabel,
  compact,
}: {
  source: string;
  eventType: string;
  severityLabel: string;
  compact: boolean;
}) {
  const typeIcon = EVENT_TYPE_ICONS[eventType];
  const faviconUrl = getServiceFaviconUrl(source, compact ? 24 : 32);
  const iconSize = compact ? "icon-sm" : "icon-base";
  const TypeIcon = typeIcon?.icon;

  return (
    <div
      className={cn(
        "mt-0.5 flex shrink-0 items-center justify-center rounded-card border border-border bg-secondary",
        compact ? "h-8 w-8 rounded-card" : "h-9 w-9"
      )}
    >
      {typeIcon != null && TypeIcon ? (
        <TypeIcon className={cn(iconSize, typeIcon.className)} />
      ) : null}
      {!typeIcon && faviconUrl && (
        <RemoteServiceIcon
          src={faviconUrl}
          alt=""
          size={compact ? 18 : 20}
          className="rounded-item"
        />
      )}
      {!typeIcon && !faviconUrl && (
        <span className={cn("font-mono text-w-sm uppercase", severityLabel)}>
          {source.slice(0, 2)}
        </span>
      )}
    </div>
  );
}

function ItemBadges({
  item,
  unread,
  severityBadge,
}: {
  item: NotificationFeedItem;
  unread: boolean;
  severityBadge: "destructive" | "warning" | "default" | "success";
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      {item.projectSlug ? (
        <Badge className="bg-secondary text-dim">{item.projectSlug}</Badge>
      ) : null}
      {item.recordType === "digest" && item.eventCount ? (
        <Badge variant="default" className="bg-secondary text-dim">
          {item.eventCount} grouped
        </Badge>
      ) : null}
      {unread ? <Badge variant={severityBadge}>Unread</Badge> : null}
    </div>
  );
}

function ItemActions({
  deliveryId,
  unread,
  onMarkRead,
  onDismiss,
}: {
  deliveryId: string;
  unread: boolean;
  onMarkRead?: (id: string) => void;
  onDismiss?: (id: string) => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      {unread && onMarkRead ? (
        <Button
          variant="ghost"
          size="sm"
          className="uppercase-none h-7 px-2.5 text-accent text-w-sm hover:bg-accent/10 hover:text-accent"
          onClick={(event) => {
            event.stopPropagation();
            onMarkRead(deliveryId);
          }}
        >
          <Check className="icon-xs" />
          Read
        </Button>
      ) : null}
      {onDismiss ? (
        <Button
          variant="ghost"
          size="sm"
          className="uppercase-none h-7 px-2.5 text-dim text-w-sm hover:bg-muted hover:text-foreground-secondary"
          onClick={(event) => {
            event.stopPropagation();
            onDismiss(deliveryId);
          }}
        >
          <X className="icon-xs" />
          Dismiss
        </Button>
      ) : null}
    </div>
  );
}

export interface NotificationItemProps {
  item: NotificationFeedItem;
  compact?: boolean;
  onMarkRead?: (deliveryId: string) => void;
  onDismiss?: (deliveryId: string) => void;
  onClick?: () => void;
}

export function NotificationItem({
  item,
  compact = false,
  onMarkRead,
  onDismiss,
  onClick,
}: NotificationItemProps) {
  const severity = SEVERITY_STYLES[item.severity];
  const unread = item.status === "delivered";
  const openUrl = getNotificationOpenUrl(item);
  const activatable = Boolean(onClick || openUrl);

  function handleCardActivate() {
    if (onClick) {
      onClick();
      return;
    }
    if (openUrl) {
      window.open(openUrl, "_blank", "noopener,noreferrer");
      if (unread && onMarkRead) {
        onMarkRead(item.deliveryId);
      }
    }
  }

  function handleCardKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!activatable) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleCardActivate();
    }
  }

  const content = (
    <div className={cn("flex min-w-0 items-start gap-3", !unread && "opacity-60")}>
      <ItemIcon
        source={item.source}
        eventType={item.type}
        severityLabel={severity.label}
        compact={compact}
      />

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span
                className={cn("font-mono text-w-sm uppercase tracking-[0.2em]", severity.label)}
              >
                {item.severity}
              </span>
              <span className="font-mono text-dim/60 text-w-sm uppercase tracking-[0.16em]">
                {item.source}
              </span>
            </div>
            <div className="min-w-0 font-mono text-foreground text-w-sm normal-case leading-relaxed [overflow-wrap:anywhere]">
              {item.title}
            </div>
          </div>
          <div className="shrink-0 font-mono text-dim/60 text-w-sm uppercase tracking-[0.18em]">
            {formatRelativeTime(item.occurredAt)}
          </div>
        </div>

        {!compact && item.body ? (
          <p className="break-words text-muted-foreground text-w-sm leading-relaxed">
            <NotificationBody body={item.body} source={item.source} />
          </p>
        ) : null}

        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <ItemBadges item={item} unread={unread} severityBadge={severity.badge} />
          {!compact && (onMarkRead || onDismiss) ? (
            <ItemActions
              deliveryId={item.deliveryId}
              unread={unread}
              onMarkRead={onMarkRead}
              onDismiss={onDismiss}
            />
          ) : null}
        </div>
      </div>
    </div>
  );

  const shellClass = cn(
    "group w-full rounded-panel border border-border border-l-4 p-3 text-left font-sans transition-colors",
    severity.border,
    unread ? severity.tint : "bg-surface",
    compact ? "hover:border-accent/40" : "hover:border-accent/20",
    activatable && "cursor-pointer"
  );

  if (activatable) {
    return (
      // biome-ignore lint/a11y/useSemanticElements: Read/Dismiss controls are real <button>s and cannot be nested inside a native <button>.
      <div
        role="button"
        tabIndex={0}
        className={shellClass}
        onClick={handleCardActivate}
        onKeyDown={handleCardKeyDown}
        aria-label={
          openUrl && !onClick ? "Open notification link in a new tab" : "Open notification"
        }
      >
        {content}
      </div>
    );
  }

  return <article className={shellClass}>{content}</article>;
}
