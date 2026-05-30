"use client";

import type { DashboardPageConfig } from "@radarboard/types/database";
import { Button } from "@radarboard/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@radarboard/ui/tooltip";
import { cn } from "@radarboard/utils/cn";

interface PageTabsProps {
  pages: DashboardPageConfig[];
  activeSlug: string;
  onSelect: (slug: string) => void;
}

export function PageTabs({ pages, activeSlug, onSelect }: PageTabsProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-wrap items-center gap-1 overflow-x-hidden px-2 py-2">
        {pages.map((page) => {
          const isActive = page.slug === activeSlug;

          return (
            <Tooltip key={page.slug}>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  uppercase={false}
                  onClick={() => onSelect(page.slug)}
                  className={cn(
                    "max-w-[220px] rounded-item border px-3 py-1 font-mono text-w-sm uppercase tracking-wider transition-colors",
                    isActive
                      ? "border-accent bg-[#16213f] text-[#f4f7ff]"
                      : "border-border bg-surface text-dim hover:border-border hover:text-foreground-secondary"
                  )}
                >
                  <span className="block truncate">{page.name}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{page.name}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
