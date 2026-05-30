"use client";

import { useEffectiveLocale } from "@radarboard/hooks/use-effective-locale";
import { useEffectiveTimeZone } from "@radarboard/hooks/use-effective-timezone";
import type { RaindropCollection } from "@radarboard/types/raindrop";
import {
  DetailLink,
  DetailRow,
  DialogBody,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@radarboard/ui/app-dialog";
import { formatDateTime } from "@radarboard/utils/format-date-time";

interface RaindropCollectionDetailProps {
  collection: RaindropCollection;
}

export function RaindropCollectionDetail({ collection }: RaindropCollectionDetailProps) {
  const effectiveLocale = useEffectiveLocale();
  const effectiveTimeZone = useEffectiveTimeZone();

  return (
    <>
      <DialogHeader>
        <DialogTitle>Collection Detail</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <div className="mb-4 space-y-2">
          <p className="break-words font-bold font-mono text-foreground text-w-lg">
            {collection.title}
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <DetailRow label="Bookmarks">{collection.count}</DetailRow>
          <DetailRow label="Parent">
            {collection.parentId != null ? `Collection ${collection.parentId}` : "Top level"}
          </DetailRow>
          <DetailRow label="Updated">
            {collection.lastUpdate
              ? formatDateTime(collection.lastUpdate, {
                  locale: effectiveLocale,
                  timeZone: effectiveTimeZone,
                })
              : "Unknown"}
          </DetailRow>
        </div>
      </DialogBody>
      <DialogFooter>
        <DetailLink href={collection.collectionUrl}>Open Collection</DetailLink>
      </DialogFooter>
    </>
  );
}
