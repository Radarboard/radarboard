"use client";

import { useEffectiveLocale } from "@radarboard/hooks/use-effective-locale";
import { useEffectiveTimeZone } from "@radarboard/hooks/use-effective-timezone";
import type { ShippingItem } from "@radarboard/types/shipping";
import {
  DetailLink,
  DetailRow,
  DialogBody,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@radarboard/ui/app-dialog";
import { Badge } from "@radarboard/ui/badge";
import { formatDateTime } from "@radarboard/utils/format-date-time";

interface ShippingDetailProps {
  item: ShippingItem;
}

export function ShippingDetail({ item }: ShippingDetailProps) {
  const effectiveLocale = useEffectiveLocale();
  const effectiveTimezone = useEffectiveTimeZone();
  const createdDate = item.createdAt ? new Date(item.createdAt) : null;
  const getSourceLabel = () => {
    if (item.source === "github") return "GitHub";
    if (item.source === "linear") return "Linear";
    return "Manual";
  };
  const sourceLabel = getSourceLabel();

  return (
    <>
      <DialogHeader>
        <DialogTitle>Shipping Detail</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <p className="mb-4 font-mono text-foreground text-w-lg">{item.title}</p>
        <div className="flex flex-col gap-1">
          <DetailRow label="Source">
            <Badge variant="default">{sourceLabel}</Badge>
          </DetailRow>
          <DetailRow label="Project">
            <Badge variant="project" color={item.projectColor}>
              {item.projectName}
            </Badge>
          </DetailRow>
          <DetailRow label="Age">{item.timeAgo}</DetailRow>
          {createdDate ? (
            <DetailRow label="Created">
              {formatDateTime(createdDate, {
                locale: effectiveLocale,
                timeZone: effectiveTimezone,
              })}
            </DetailRow>
          ) : null}
        </div>
      </DialogBody>
      {item.url ? (
        <DialogFooter>
          <DetailLink href={item.url}>View on {sourceLabel}</DetailLink>
        </DialogFooter>
      ) : null}
    </>
  );
}
