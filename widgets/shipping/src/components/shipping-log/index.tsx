"use client";

import type { ShippingItem, ShippingSource } from "@radarboard/types/shipping";
import { Dialog } from "@radarboard/ui/app-dialog";
import { InfoRow } from "@radarboard/ui/info-row";
import { ScrollArea } from "@radarboard/ui/scroll-area";
import {
  CompactProjectBadge,
  toCompactProjectLabel,
} from "@radarboard/widget-engine/compact-project-badge";
import { useSelectedItem } from "@radarboard/widget-engine/hooks/use-selected-item";
import { WidgetModalDialogContent } from "@radarboard/widget-engine/widget-modal";
import { GitCommit, Pencil, SquareKanban } from "lucide-react";
import { useMemo } from "react";
import { ShippingDetail } from "../shipping-detail";

interface ShippingLogProps {
  items: ShippingItem[];
  /** Externally controlled selected item ID (for URL state). */
  selectedId?: string | null;
  /** Called when the selected item changes (for URL state sync). */
  onSelectedIdChange?: (id: string | null) => void;
  widgetId?: string;
}

function SourceIcon({ source }: { source: ShippingSource }) {
  const iconClass = "icon-xs text-dim";
  switch (source) {
    case "github":
      return <GitCommit className={iconClass} />;
    case "linear":
      return <SquareKanban className={iconClass} />;
    case "manual":
      return <Pencil className={iconClass} />;
    default:
      return null;
  }
}

export function ShippingLog({
  items,
  selectedId,
  onSelectedIdChange,
  widgetId = "shipping",
}: ShippingLogProps) {
  // Build a lookup map for resolving selectedId to an item
  const itemMap = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const selected = useSelectedItem(selectedId, itemMap);

  const handleSelect = (item: ShippingItem) => {
    onSelectedIdChange?.(item.id);
  };

  const handleClose = () => {
    onSelectedIdChange?.(null);
  };

  return (
    <>
      <ScrollArea className="h-full">
        <div className="flex flex-col">
          {items.map((item) => (
            <InfoRow
              key={item.id}
              onClick={() => handleSelect(item)}
              density="compact"
              className="py-1.5"
              subtitleClassName="mt-0.5"
              leading={<SourceIcon source={item.source} />}
              title={item.title}
              subtitle={
                <div className="flex items-center justify-between gap-3">
                  <CompactProjectBadge
                    color={item.projectColor}
                    label={toCompactProjectLabel(item.projectName)}
                  />
                  <span className="shrink-0 whitespace-nowrap font-mono text-dim text-w-sm">
                    {item.timeAgo}
                  </span>
                </div>
              }
            />
          ))}
        </div>
      </ScrollArea>
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) handleClose();
        }}
      >
        <WidgetModalDialogContent widgetId={widgetId} modalId="shipping.item" defaultSize="sm">
          {selected && <ShippingDetail item={selected} />}
        </WidgetModalDialogContent>
      </Dialog>
    </>
  );
}
