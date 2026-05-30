"use client";

import type { WidgetModalSize } from "@radarboard/types/database";
import { cn } from "@radarboard/utils/cn";
import { X } from "lucide-react";
import { domAnimation, LazyMotion, m, useReducedMotion } from "motion/react";
import { type ReactNode, type RefObject, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import type { WidgetExpandedLayoutIds } from "../widget-expanded-motion";
import {
  WIDGET_EXPANDED_CONTENT_DELAY,
  WIDGET_EXPANDED_FADE_TRANSITION,
  WIDGET_EXPANDED_LAYOUT_TRANSITION,
} from "../widget-expanded-motion";
import {
  DEFAULT_WIDGET_MODAL_SIZE,
  getLegacyExpandedSizeStorageKey,
  useWidgetModalSize,
  WIDGET_EXPANDED_CONTAINER_CLASS,
  WIDGET_EXPANDED_PANEL_CLASS,
  WidgetModalSizeToggle,
} from "../widget-modal";

// ---------------------------------------------------------------------------
// ExpandedPortal
// ---------------------------------------------------------------------------

interface ExpandedPortalProps {
  title: string;
  /** Used as the persisted preference key for the widget's expanded overlay size. */
  widgetId: string;
  sourceRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  children: ReactNode;
  layoutIds?: WidgetExpandedLayoutIds;
  /**
   * Default size applied when the user hasn't made a choice yet.
   * Set this from `WidgetDescriptor.expandedSize`. Defaults to the centralized widget medium size.
   */
  defaultSize?: WidgetModalSize;
}

export function ExpandedPortal({
  title,
  widgetId,
  sourceRef,
  onClose,
  children,
  layoutIds,
  defaultSize = DEFAULT_WIDGET_MODAL_SIZE,
}: ExpandedPortalProps) {
  const { size, setSize } = useWidgetModalSize({
    widgetId,
    modalId: "expanded",
    defaultSize,
    legacyStorageKey: getLegacyExpandedSizeStorageKey(widgetId),
  });
  const reducedMotion = useReducedMotion();
  const canUseSharedLayout = Boolean(layoutIds && !reducedMotion && sourceRef.current?.isConnected);
  const fadeTransition = reducedMotion ? { duration: 0 } : WIDGET_EXPANDED_FADE_TRANSITION;

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // Esc key
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [handleClose]);

  return createPortal(
    <LazyMotion features={domAnimation}>
      <div className={cn("fixed inset-0 z-overlay p-4", WIDGET_EXPANDED_CONTAINER_CLASS[size])}>
        {/* Backdrop */}
        <m.button
          type="button"
          className={cn("absolute inset-0 cursor-default bg-black/80 backdrop-blur-sm")}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={fadeTransition}
          onClick={handleClose}
          aria-label="Close expanded view"
          tabIndex={-1}
        />

        {/* Content panel — transition size changes smoothly */}
        <m.div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          layout={canUseSharedLayout}
          layoutId={canUseSharedLayout ? layoutIds?.shellId : undefined}
          transition={canUseSharedLayout ? WIDGET_EXPANDED_LAYOUT_TRANSITION : fadeTransition}
          initial={
            canUseSharedLayout
              ? undefined
              : reducedMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.98, y: 8 }
          }
          animate={
            canUseSharedLayout
              ? undefined
              : reducedMotion
                ? { opacity: 1 }
                : { opacity: 1, scale: 1, y: 0 }
          }
          exit={
            canUseSharedLayout
              ? undefined
              : reducedMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.98, y: 8 }
          }
          className={cn(
            "relative z-10 overflow-hidden border border-border bg-surface",
            WIDGET_EXPANDED_PANEL_CLASS[size]
          )}
        >
          {/* Header */}
          <m.div
            layout={canUseSharedLayout ? "position" : undefined}
            layoutId={canUseSharedLayout ? layoutIds?.headerId : undefined}
            transition={canUseSharedLayout ? WIDGET_EXPANDED_LAYOUT_TRANSITION : undefined}
            className="flex shrink-0 items-center justify-between border-border border-b bg-surface-raised px-4 py-3"
          >
            {canUseSharedLayout ? (
              <m.div
                layoutId={layoutIds?.titleId}
                transition={WIDGET_EXPANDED_LAYOUT_TRANSITION}
                className="flex min-w-0 flex-1 items-center"
              >
                <h2 className="truncate font-medium font-mono text-dim text-w-sm uppercase tracking-widest">
                  {title}
                </h2>
              </m.div>
            ) : (
              <div className="flex min-w-0 flex-1 items-center">
                <h2 className="truncate font-medium font-mono text-dim text-w-sm uppercase tracking-widest">
                  {title}
                </h2>
              </div>
            )}

            <m.div
              initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
              transition={{
                ...fadeTransition,
                delay: reducedMotion ? 0 : 0.08,
              }}
              className="flex shrink-0 items-center gap-2"
            >
              {/* Size toggle */}
              <WidgetModalSizeToggle size={size} onSizeChange={setSize} />

              {/* Close */}
              <button
                type="button"
                onClick={handleClose}
                className="ml-1 cursor-pointer text-dim transition-colors hover:text-foreground-secondary"
                aria-label="Close expanded view"
              >
                <X className="icon-sm" />
              </button>
            </m.div>
          </m.div>

          {/* Body */}
          <m.div
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
            transition={{
              ...fadeTransition,
              delay: reducedMotion ? 0 : WIDGET_EXPANDED_CONTENT_DELAY,
            }}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            {children}
          </m.div>
        </m.div>
      </div>
    </LazyMotion>,
    document.body
  );
}
