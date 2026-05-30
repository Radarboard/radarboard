"use client";

import { Button } from "@radarboard/ui/button";
import { RichTextViewer } from "@radarboard/ui/rich-text-viewer";
import { cn } from "@radarboard/utils/cn";
import { Clock, RotateCcw, X } from "lucide-react";
import { useState } from "react";
import type { NoteSnapshot } from "../types";

interface NoteHistoryProps {
  snapshots: NoteSnapshot[];
  onRestore: (snapshot: NoteSnapshot) => void;
  onClose: () => void;
}

export function NoteHistory({ snapshots, onRestore, onClose }: NoteHistoryProps) {
  const [selectedId, setSelectedId] = useState<string | null>(snapshots[0]?.id ?? null);
  const selectedSnapshot = snapshots.find((s) => s.id === selectedId);

  return (
    <div className="flex h-full flex-col bg-surface">
      {/* Header */}
      <div className="flex items-center justify-between border-border border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Clock className="icon-base text-dim" />
          <span className="font-mono text-foreground-secondary text-w-base">Version History</span>
          <span className="text-dim text-w-sm">({snapshots.length})</span>
        </div>
        <Button
          type="button"
          onClick={onClose}
          variant="ghost"
          size="icon"
          uppercase={false}
          className="text-dim hover:text-foreground-secondary"
          aria-label="Close history"
        >
          <X className="icon-base" />
        </Button>
      </div>

      {snapshots.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-dim text-sm">
          No snapshots yet. Edits create snapshots automatically.
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          {/* Snapshot list */}
          <div className="scrollbar-thin w-[200px] overflow-y-auto border-border border-r">
            {snapshots.map((s) => (
              <Button
                key={s.id}
                type="button"
                onClick={() => setSelectedId(s.id)}
                variant={selectedId === s.id ? "secondary" : "ghost"}
                uppercase={false}
                fullWidth
                className={cn(
                  "h-auto rounded-none border-border border-b px-3 py-2 text-left",
                  selectedId === s.id
                    ? "bg-secondary text-foreground-secondary"
                    : "text-dim hover:bg-secondary/50"
                )}
              >
                <div className="font-mono text-w-sm">{formatTimestamp(s.createdAt)}</div>
                <div className="mt-0.5 truncate text-dim text-w-xs">{s.title}</div>
              </Button>
            ))}
          </div>

          {/* Preview + restore */}
          <div className="flex min-w-0 flex-1 flex-col">
            {selectedSnapshot && (
              <>
                <div className="flex items-center justify-between border-border border-b px-4 py-2">
                  <span className="font-mono text-dim text-w-sm">
                    {formatTimestamp(selectedSnapshot.createdAt)}
                  </span>
                  <Button
                    type="button"
                    onClick={() => onRestore(selectedSnapshot)}
                    variant="outline"
                    uppercase={false}
                    className="gap-1.5"
                  >
                    <RotateCcw className="icon-base" />
                    Restore
                  </Button>
                </div>
                <div className="scrollbar-thin flex-1 overflow-y-auto px-4 py-3">
                  {selectedSnapshot.content ? (
                    <RichTextViewer markdown={selectedSnapshot.content} className="text-sm" />
                  ) : (
                    <div className="text-dim text-sm italic">Empty snapshot.</div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
