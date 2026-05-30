"use client";

import { Button } from "@radarboard/ui/button";
import { cn } from "@radarboard/utils/cn";
import type { ReactNode } from "react";

export interface InlineListColumn {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
}

interface InlineListHeaderProps {
  columns: InlineListColumn[];
  gridTemplateColumns: string;
}

export function InlineListHeader({ columns, gridTemplateColumns }: InlineListHeaderProps) {
  return (
    <div
      className="grid items-center gap-3 border-border border-b px-3 py-1.5"
      style={{ gridTemplateColumns }}
    >
      {columns.map((column) => (
        <div
          key={column.key}
          className={cn(
            "font-mono text-dim text-w-sm uppercase tracking-wider",
            column.align === "right" && "text-right",
            column.align === "center" && "text-center"
          )}
        >
          {column.label}
        </div>
      ))}
    </div>
  );
}

interface InlineListRowProps {
  cells: Array<{ key: string; content: ReactNode; align?: "left" | "right" | "center" }>;
  gridTemplateColumns: string;
  onClick?: () => void;
}

export function InlineListRow({ cells, gridTemplateColumns, onClick }: InlineListRowProps) {
  const content = (
    <div
      className="grid w-full items-center gap-3 px-3 py-1.5 text-w-sm"
      style={{ gridTemplateColumns }}
    >
      {cells.map((cell) => (
        <div
          key={cell.key}
          className={cn(
            cell.align === "right" && "text-right",
            cell.align === "center" && "text-center"
          )}
        >
          {cell.content}
        </div>
      ))}
    </div>
  );

  if (!onClick) {
    return content;
  }

  return (
    <Button
      type="button"
      variant="ghost"
      spacing="none"
      uppercase={false}
      rounded="none"
      onClick={onClick}
      className="w-full cursor-pointer justify-start text-left transition-colors hover:bg-surface-raised"
    >
      {content}
    </Button>
  );
}
