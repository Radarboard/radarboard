"use client";

import {
  buildAssistantHandoffPrompt,
  SendToAssistantButton,
} from "@radarboard/assistant-ui/assistant-handoff";
import { useEffectiveLocale } from "@radarboard/hooks/use-effective-locale";
import { useEffectiveTimeZone } from "@radarboard/hooks/use-effective-timezone";
import type { AssistantHandoffItem } from "@radarboard/types/assistant";
import type { RaindropBookmark } from "@radarboard/types/raindrop";
import {
  DetailLink,
  DetailRow,
  DialogBody,
  DialogCancelButton,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@radarboard/ui/app-dialog";
import { formatDateTime } from "@radarboard/utils/format-date-time";
import { useState } from "react";

interface RaindropBookmarkDetailProps {
  bookmark: RaindropBookmark;
}

export function RaindropBookmarkDetail({ bookmark }: RaindropBookmarkDetailProps) {
  const effectiveLocale = useEffectiveLocale();
  const effectiveTimeZone = useEffectiveTimeZone();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      const { copyText } = await import("@radarboard/utils/clipboard");
      await copyText(bookmark.link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const assistantItem: AssistantHandoffItem = {
    id: String(bookmark.id),
    kind: "bookmark",
    title: bookmark.title,
    summary: bookmark.excerpt || bookmark.link,
    bodyMarkdown: [
      `## Bookmark`,
      `Title: ${bookmark.title}`,
      `URL: ${bookmark.link}`,
      `Collection: ${bookmark.collectionTitle}`,
      bookmark.excerpt ? `Excerpt: ${bookmark.excerpt}` : null,
      bookmark.tags.length > 0 ? `Tags: ${bookmark.tags.join(", ")}` : null,
    ]
      .filter(Boolean)
      .join("\n\n"),
    badge: bookmark.collectionTitle,
    sourceUrl: bookmark.link,
    metadata: {
      domain: bookmark.domain,
      collectionId: bookmark.collectionId,
      tags: bookmark.tags,
      raindropUrl: bookmark.raindropUrl,
    },
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Bookmark Detail</DialogTitle>
      </DialogHeader>
      <DialogBody>
        {bookmark.coverUrl ? (
          <div className="mb-4 overflow-hidden rounded-item border border-border bg-surface">
            <span
              role="img"
              aria-label={`${bookmark.title} preview`}
              className="block h-auto max-h-[280px] min-h-32 w-full bg-center bg-cover bg-no-repeat"
              style={{ backgroundImage: `url("${bookmark.coverUrl}")` }}
            />
          </div>
        ) : null}
        <div className="mb-4 space-y-2">
          <p className="break-words font-bold font-mono text-foreground text-w-lg">
            {bookmark.title}
          </p>
          {bookmark.excerpt ? (
            <p className="font-mono text-dim text-w-base leading-relaxed">{bookmark.excerpt}</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1">
          <DetailRow label="Domain">{bookmark.domain || "Unknown"}</DetailRow>
          <DetailRow label="Collection">{bookmark.collectionTitle}</DetailRow>
          <DetailRow label="Saved">
            {formatDateTime(bookmark.created, {
              locale: effectiveLocale,
              timeZone: effectiveTimeZone,
            })}
          </DetailRow>
          <DetailRow label="Tags">
            {bookmark.tags.length > 0 ? bookmark.tags.join(", ") : "No tags"}
          </DetailRow>
        </div>
      </DialogBody>
      <DialogFooter className="justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <DetailLink href={bookmark.link}>Open Original</DetailLink>
          <DetailLink href={bookmark.raindropUrl}>Open in Raindrop</DetailLink>
          {bookmark.collectionUrl ? (
            <DetailLink href={bookmark.collectionUrl}>Open Collection</DetailLink>
          ) : null}
          <SendToAssistantButton
            item={assistantItem}
            promptTemplate={buildAssistantHandoffPrompt("summarize-link", assistantItem)}
          />
        </div>
        <DialogCancelButton onClick={handleCopy}>
          {copied ? "Copied" : "Copy URL"}
        </DialogCancelButton>
      </DialogFooter>
    </>
  );
}
