"use client";

import { Button } from "@radarboard/ui/button";
import { Archive, Pencil, Trash2 } from "lucide-react";

export interface SidebarContextMenuProps {
  onRename: () => void;
  onArchive: () => void;
  onDelete?: () => void;
  onClose: () => void;
}

export function SidebarContextMenu({
  onRename,
  onArchive,
  onDelete,
  onClose,
}: SidebarContextMenuProps) {
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        spacing="none"
        uppercase={false}
        className="fixed inset-0 z-10 h-full w-full rounded-none bg-transparent p-0 hover:bg-transparent"
        onClick={onClose}
        aria-label="Close context menu"
      />
      <div className="absolute top-full right-2 z-20 mt-0.5 min-w-[120px] rounded border border-border bg-surface-raised py-1 shadow-lg">
        <Button
          type="button"
          onClick={onRename}
          variant="ghost"
          uppercase={false}
          fullWidth
          className="justify-start text-foreground-secondary"
        >
          <Pencil className="icon-base" /> Rename
        </Button>
        <Button
          type="button"
          onClick={onArchive}
          variant="ghost"
          uppercase={false}
          fullWidth
          className="justify-start text-foreground-secondary"
        >
          <Archive className="icon-base" /> Archive
        </Button>
        {Boolean(onDelete) && (
          <Button
            type="button"
            onClick={onDelete}
            variant="ghost"
            uppercase={false}
            fullWidth
            className="justify-start text-destructive"
          >
            <Trash2 className="icon-base" /> Delete
          </Button>
        )}
      </div>
    </>
  );
}
