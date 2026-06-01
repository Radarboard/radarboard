"use client";

import type { DashboardPageConfig } from "@radarboard/types/database";
import { Button } from "@radarboard/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@radarboard/ui/tooltip";
import { cn } from "@radarboard/utils/cn";
import { Plus } from "lucide-react";

interface PageTabsProps {
  pages: DashboardPageConfig[];
  activeSlug: string;
  onSelect: (slug: string) => void;
  onAddPage?: () => void;
}

function AddPageButton({ onAddPage }: { onAddPage: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          uppercase={false}
          rounded="none"
          aria-label="Add page"
          data-testid="page-tabs-add-page"
          onClick={onAddPage}
          className="h-7 w-7 shrink-0 border border-border text-dim transition-interactive hover:text-foreground-secondary"
        >
          <Plus className="icon-sm" aria-hidden="true" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">Add page</TooltipContent>
    </Tooltip>
  );
}

export function PageTabs({ pages, activeSlug, onSelect, onAddPage }: PageTabsProps) {
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
                    "max-w-56 rounded-item border px-3 py-1 font-mono text-w-sm uppercase tracking-wider transition-interactive",
                    isActive
                      ? "border-accent bg-accent text-primary-foreground"
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
        {onAddPage ? <AddPageButton onAddPage={onAddPage} /> : null}
      </div>
    </TooltipProvider>
  );
}
