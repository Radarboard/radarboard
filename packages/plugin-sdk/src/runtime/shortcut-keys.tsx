"use client";

import { cn } from "@radarboard/utils/cn";
import { formatShortcutParts, resolveShortcutPlatform } from "@radarboard/utils/shortcut-label";
import { useMemo } from "react";

export function ShortcutKeys({
  shortcut,
  className,
  keyClassName,
}: {
  shortcut: string;
  className?: string;
  keyClassName?: string;
}) {
  const platform = useMemo(() => resolveShortcutPlatform(), []);
  const parts = useMemo(() => formatShortcutParts(shortcut, platform), [platform, shortcut]);

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {parts.map((part) => (
        <kbd
          key={`${shortcut}-${part}`}
          className={cn(
            "inline-flex min-w-5 items-center justify-center rounded-item border border-border bg-secondary px-1.5 py-0.5 font-medium text-foreground-secondary text-w-sm leading-none",
            keyClassName
          )}
        >
          {part}
        </kbd>
      ))}
    </span>
  );
}
