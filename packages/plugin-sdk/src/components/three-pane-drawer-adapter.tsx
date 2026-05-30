"use client";

import { Button } from "@radarboard/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@radarboard/ui/tabs";
import { cn } from "@radarboard/utils/cn";
import { X } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface ThreePaneDrawerAdapterProps {
  sidebar: ReactNode;
  list: ReactNode;
  detail: ReactNode;
  className?: string;
  sidebarClassName?: string;
  listClassName?: string;
  detailClassName?: string;
  /** Label for the sidebar tab. */
  sidebarTabLabel?: string;
  /** Label for the list tab. */
  listTabLabel?: string;
  /**
   * Stable key identifying the current detail content (e.g. the selected item ID).
   * When this changes, the detail modal opens automatically.
   *
   * Without this, the adapter cannot reliably detect new selections because
   * React creates new JSX object references on every render — so comparing
   * `detail !== prevDetail` is always true and causes an infinite open loop.
   */
  detailKey?: string | null;
}

/**
 * Renders a ThreePaneWorkspace-compatible layout for narrow drawer containers.
 *
 * Instead of 3 side-by-side columns, it shows:
 * - A tab bar with 2 tabs (sidebar content + list content)
 * - When `detailKey` changes (user selected a new item), the detail content
 *   opens in a centered modal overlay that floats above the drawer.
 *
 * On initial mount (e.g. switching from fullscreen → drawer while an article
 * is selected), the modal stays closed because `prevDetailKeyRef` is initialized
 * to the current `detailKey` — the effect sees no change.
 */
export function ThreePaneDrawerAdapter({
  sidebar,
  list,
  detail,
  className,
  sidebarClassName,
  listClassName,
  detailClassName,
  sidebarTabLabel = "Browse",
  listTabLabel = "List",
  detailKey,
}: ThreePaneDrawerAdapterProps) {
  const [detailOpen, setDetailOpen] = useState(false);
  const prevDetailKeyRef = useRef(detailKey);

  // Open the detail modal only when a genuinely NEW item is selected.
  // On mount, prevDetailKeyRef is initialized to the current detailKey,
  // so switching from fullscreen → drawer does NOT auto-open.
  useEffect(() => {
    if (detailKey && detailKey !== prevDetailKeyRef.current) {
      setDetailOpen(true);
    }
    prevDetailKeyRef.current = detailKey;
  }, [detailKey]);

  const closeDetail = useCallback(() => setDetailOpen(false), []);

  // Close on Escape
  useEffect(() => {
    if (!detailOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        setDetailOpen(false);
      }
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [detailOpen]);

  return (
    <>
      <Tabs defaultValue="list" className={cn("flex h-full min-h-0 flex-col", className)}>
        <TabsList>
          <TabsTrigger value="browse">{sidebarTabLabel}</TabsTrigger>
          <TabsTrigger value="list">{listTabLabel}</TabsTrigger>
        </TabsList>

        <TabsContent
          value="browse"
          className={cn("min-h-0 flex-1 overflow-auto", sidebarClassName)}
        >
          {sidebar}
        </TabsContent>

        <TabsContent value="list" className={cn("min-h-0 flex-1 overflow-auto", listClassName)}>
          {list}
        </TabsContent>
      </Tabs>

      {/* Detail modal — rendered via portal above the drawer overlay (z-[70]) */}
      {detailOpen &&
        detailKey != null &&
        createPortal(
          <div
            className="fade-in fixed inset-0 z-[70] flex animate-in items-center justify-center duration-150"
            role="dialog"
            aria-modal="true"
            aria-label="Detail view"
          >
            {/* Backdrop */}
            <button
              type="button"
              className="absolute inset-0 cursor-default bg-background/60 backdrop-blur-sm"
              onClick={closeDetail}
              aria-label="Close detail"
              tabIndex={-1}
            />

            {/* Detail panel */}
            <div
              className={cn(
                "relative flex flex-col overflow-hidden rounded-card border border-border bg-background shadow-2xl",
                "h-[80vh] w-[90vw] max-w-3xl",
                "slide-in-from-bottom-2 animate-in duration-200",
                detailClassName
              )}
            >
              {/* Close button */}
              <div className="flex shrink-0 items-center justify-end border-border border-b bg-surface-raised px-3 py-2">
                <Button
                  type="button"
                  onClick={closeDetail}
                  variant="ghost"
                  size="icon"
                  uppercase={false}
                  className="text-dim hover:text-foreground-secondary"
                  aria-label="Close detail"
                >
                  <X className="icon-base" />
                </Button>
              </div>

              {/* Content */}
              <div className="min-h-0 flex-1 overflow-auto">{detail}</div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
