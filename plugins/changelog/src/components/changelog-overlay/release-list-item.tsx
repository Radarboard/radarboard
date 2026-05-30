import { SendToContextMenu } from "@radarboard/plugin-sdk/components/intent-menu";
import { ListRowChip, PluginListRow } from "@radarboard/plugin-sdk/components/list-row";
import { Button } from "@radarboard/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@radarboard/ui/tooltip";
import { cn } from "@radarboard/utils/cn";
import { CompactProjectBadge } from "@radarboard/widget-engine/compact-project-badge";
import { Archive, ArchiveRestore, BookOpen, MailOpen } from "lucide-react";
import type { ChangelogEntry } from "../../types";
import { QUALITY_VARIANTS } from "../constants";
import { formatReleaseDate, getSourceVariant } from "../utils";
import { Pill } from "./pill";

export function ReleaseListItem({
  entry,
  isRead,
  isArchived,
  projectBadges,
  active,
  onSelect,
  onMarkRead,
  onMarkUnread,
  onArchive,
  onUnarchive,
}: {
  entry: ChangelogEntry;
  isRead: boolean;
  isArchived: boolean;
  projectBadges: Array<{ slug: string; label: string; color: string }>;
  active: boolean;
  onSelect: () => void;
  onMarkRead: () => void;
  onMarkUnread: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
}) {
  return (
    <SendToContextMenu
      sourcePluginId="changelog"
      payload={{
        kind: "structured",
        itemType: "changelog-entry",
        title: `${entry.packageName} v${entry.version}`,
        bodyMarkdown: entry.body ?? entry.description,
        data: entry as unknown as Record<string, unknown>,
        tags: [entry.packageName, `v${entry.version}`],
        projectSlug: entry.projectSlugs[0] ?? null,
      }}
    >
      <PluginListRow
        dotColor={isRead ? "bg-dim" : "bg-foreground-secondary"}
        title={
          <span className={cn(isRead ? "text-dim" : "font-semibold text-foreground-secondary")}>
            {entry.packageName}
          </span>
        }
        subtitle={entry.title}
        meta={formatReleaseDate(entry.publishedAt)}
        selected={active}
        onClick={onSelect}
        className={!isRead && !isArchived && !active ? "bg-accent/5" : undefined}
        hoverActions={
          <>
            {isRead ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onMarkUnread();
                    }}
                    variant="ghost"
                    size="icon"
                    uppercase={false}
                    className="text-dim hover:text-foreground-secondary"
                    aria-label="Mark unread"
                  >
                    <MailOpen className="icon-sm" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Mark unread</TooltipContent>
              </Tooltip>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onMarkRead();
                    }}
                    variant="ghost"
                    size="icon"
                    uppercase={false}
                    className="text-dim hover:text-foreground-secondary"
                    aria-label="Mark read"
                  >
                    <BookOpen className="icon-sm" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Mark read</TooltipContent>
              </Tooltip>
            )}
            {isArchived ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onUnarchive();
                    }}
                    variant="ghost"
                    size="icon"
                    uppercase={false}
                    className="text-dim hover:text-foreground-secondary"
                    aria-label="Unarchive"
                  >
                    <ArchiveRestore className="icon-sm" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Unarchive</TooltipContent>
              </Tooltip>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onArchive();
                    }}
                    variant="ghost"
                    size="icon"
                    uppercase={false}
                    className="text-dim hover:text-foreground-secondary"
                    aria-label="Archive"
                  >
                    <Archive className="icon-sm" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Archive</TooltipContent>
              </Tooltip>
            )}
          </>
        }
        chips={
          <>
            <ListRowChip>v{entry.version}</ListRowChip>
            {!isRead && (
              <ListRowChip className="border-border bg-secondary text-muted-foreground">
                UNREAD
              </ListRowChip>
            )}
            <Pill variant={QUALITY_VARIANTS[entry.notesQuality]}>
              {entry.notesQuality === "full" ? "Full notes" : "Minimal"}
            </Pill>
            <Pill variant={getSourceVariant(entry.sourceType)}>
              {entry.sourceType.replace(/_/g, " ")}
            </Pill>
            {projectBadges.slice(0, 2).map((badge) => (
              <CompactProjectBadge key={badge.slug} color={badge.color} label={badge.label} />
            ))}
            {projectBadges.length > 2 ? (
              <ListRowChip>+{projectBadges.length - 2}</ListRowChip>
            ) : null}
          </>
        }
      />
    </SendToContextMenu>
  );
}
