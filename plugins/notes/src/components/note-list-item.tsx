"use client";

import { ListRowChip, PluginListRow } from "@radarboard/plugin-sdk/components/list-row";
import { formatRelativeTime } from "@radarboard/plugin-sdk/utils";
import { Button } from "@radarboard/ui/button";
import { cn } from "@radarboard/utils/cn";
import { Archive, Star, StickyNote } from "lucide-react";
import { highlightMatches } from "../hooks/use-note-search";
import type { Note } from "../types";

interface NoteListItemProps {
  note: Note;
  selected: boolean;
  searchQuery: string;
  onClick: () => void;
  onPin: (id: string) => void;
}

/** Strip markdown syntax for a clean plaintext preview. */
function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]+`/g, " ")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_~[\]()!>|\\]/g, "")
    .replace(/\n+/g, " ")
    .trim();
}

export function NoteListItem({ note, selected, searchQuery, onClick, onPin }: NoteListItemProps) {
  const preview = stripMarkdown(note.content);
  const titleSegments = highlightMatches(note.title, searchQuery);
  const previewText = preview.length > 100 ? `${preview.slice(0, 100)}...` : preview;

  return (
    <PluginListRow
      indicator={<StickyNote className="icon-sm text-dim" />}
      title={titleSegments.map((seg) => {
        const key = `${seg.highlighted ? "h" : "t"}-${seg.text}`;
        return seg.highlighted ? (
          <mark key={key} className="rounded-sm bg-amber-400/30 px-0.5 text-foreground-secondary">
            {seg.text}
          </mark>
        ) : (
          <span key={key}>{seg.text}</span>
        );
      })}
      titleBadge={
        <>
          {Boolean(note.pinned) && (
            <Star className="icon-xs shrink-0 fill-amber-400 text-amber-400" />
          )}
          {note.status === "archived" && <Archive className="icon-xs shrink-0 text-dim" />}
        </>
      }
      subtitle={previewText || undefined}
      chips={
        note.tags.length > 0
          ? note.tags.slice(0, 6).map((tag) => <ListRowChip key={tag}>{tag}</ListRowChip>)
          : undefined
      }
      meta={formatRelativeTime(note.updatedAt)}
      selected={selected}
      onClick={onClick}
      hoverActions={
        note.status === "active" ? (
          <Button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPin(note.id);
            }}
            variant="ghost"
            size="icon"
            uppercase={false}
            className={cn(
              note.pinned
                ? "text-amber-400 hover:text-amber-300"
                : "text-dim hover:text-foreground-secondary"
            )}
            aria-label={note.pinned ? "Unpin" : "Pin"}
          >
            <Star className={cn("icon-sm", note.pinned && "fill-amber-400")} />
          </Button>
        ) : undefined
      }
    />
  );
}
