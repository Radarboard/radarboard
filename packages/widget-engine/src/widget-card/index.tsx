"use client";

import type { DraggableAttributes, DraggableSyntheticListeners } from "@dnd-kit/core";
import { useDashboard } from "@radarboard/hooks/use-dashboard";
import type { FontScale, WidgetModalSize } from "@radarboard/types/database";
import { Button } from "@radarboard/ui/button";
import { cn } from "@radarboard/utils/cn";
import { formatDateTime } from "@radarboard/utils/format-date-time";
import type { WidgetChromeStatus, WidgetExpandAction } from "@radarboard/widget-sdk/widget-types";
import {
  Camera,
  ExternalLink,
  GripVertical,
  Maximize2,
  RefreshCw,
  Settings,
  Trash2,
} from "lucide-react";
import {
  AnimatePresence,
  domAnimation,
  LayoutGroup,
  LazyMotion,
  m,
  useReducedMotion,
} from "motion/react";
import type React from "react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { FreshnessIndicator } from "../components/freshness-indicator";
import { ExpandedPortal } from "../expanded-portal";
import { useExportWidgetImage } from "../hooks/use-export-widget-image";
import {
  getWidgetExpandedLayoutIds,
  WIDGET_EXPANDED_FADE_TRANSITION,
  WIDGET_EXPANDED_LAYOUT_TRANSITION,
} from "../widget-expanded-motion";
import { DEFAULT_WIDGET_MODAL_SIZE } from "../widget-modal";

interface WidgetCardProps {
  title: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  action?: ReactNode;
  widgetId?: string;
  expandedContent?: ReactNode;
  /** Controls the size of the expanded overlay. Defaults to the centralized widget medium size. */
  expandedSize?: WidgetModalSize;
  /** Controls what happens on expand. Defaults to "expanded-view". */
  expandAction?: WidgetExpandAction;
  /** Unix timestamp (seconds) when data was last fetched from upstream. */
  fetchedAt?: number | null;
  /** Called when the user clicks the manual refresh button. */
  onRefetch?: (() => Promise<void>) | null;
  /** Whether a refetch is currently in flight. */
  isRefetching?: boolean;
  /** Called when the user clicks the configure (gear) button. */
  onConfigure?: () => void;
  /** Called when the user removes the widget from the active layout. */
  onRemove?: () => void;
  /** Controls whether compact utility actions should be available. */
  chromeStatus?: WidgetChromeStatus;
  // --- Edit mode / DnD props (injected by WidgetSlot) ---
  /** Whether layout edit mode is currently active. */
  isEditMode?: boolean;
  /** Whether this card is currently being dragged. */
  isDragging?: boolean;
  /** Ref callback for the drag handle element (from useDraggable). */
  dragHandleRef?: (el: HTMLElement | null) => void;
  /** Event listeners for the drag handle (from useDraggable). */
  dragHandleListeners?: DraggableSyntheticListeners;
  /** ARIA attributes for the drag handle (from useDraggable). */
  dragHandleAttributes?: DraggableAttributes;
}

function timeAgoShort(unixSeconds: number): string {
  const diff = Math.floor(Date.now() / 1000) - unixSeconds;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function dispatchPluginNavigation(pluginId: string) {
  window.dispatchEvent(
    new CustomEvent("radarboard:navigate", {
      detail: `?plugin=${pluginId}`,
    })
  );
}

/** Tick every 30s so the "Xm ago" label stays fresh */
function useFetchedAtTick(fetchedAt?: number | null) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!fetchedAt) return;
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, [fetchedAt]);
}

function useWidgetDoubleClick(
  isExpandable: boolean,
  isEditMode: boolean,
  handleExpand: () => void
) {
  return useCallback(
    (e: React.MouseEvent) => {
      if (!isExpandable || isEditMode) return;
      const target = e.target as HTMLElement;
      if (shouldIgnoreExpand(target)) return;
      handleExpand();
    },
    [isExpandable, isEditMode, handleExpand]
  );
}

function shouldIgnoreExpand(target: HTMLElement): boolean {
  if (target.closest("button, a, input, select, textarea, [role='button']")) {
    return true;
  }

  const selection = window.getSelection();
  return Boolean(selection && selection.toString().length > 0);
}

function WidgetHeaderText({
  title,
  fetchedAt,
  effectiveLocale,
  effectiveTimezone,
  interactive = false,
}: {
  title: string;
  fetchedAt?: number | null;
  effectiveLocale: string;
  effectiveTimezone: string;
  interactive?: boolean;
}) {
  return (
    <>
      <span className="flex min-w-0 items-center gap-1.5">
        <h2
          className={cn(
            "min-w-0 truncate font-medium font-mono text-dim text-w-sm uppercase tracking-widest",
            interactive &&
              "transition-colors group-hover:text-foreground-secondary group-focus-visible:text-foreground-secondary"
          )}
        >
          {title}
        </h2>
        {fetchedAt != null && <FreshnessIndicator fetchedAt={fetchedAt * 1000} />}
      </span>
      {fetchedAt !== null && fetchedAt !== undefined && (
        <span
          className="shrink-0 font-mono text-dim text-w-sm"
          title={
            formatDateTime(new Date(fetchedAt * 1000), {
              locale: effectiveLocale,
              timeZone: effectiveTimezone,
            }) ?? undefined
          }
        >
          {timeAgoShort(fetchedAt)}
        </span>
      )}
    </>
  );
}

function WidgetCardActions({
  title,
  isEditMode,
  isExpandable,
  isRefetching,
  isExporting,
  opensPlugin,
  chromeStatus,
  onRefetch,
  onConfigure,
  onRemove,
  onExpand,
  onExport,
  action,
}: {
  title: string;
  isEditMode: boolean;
  isExpandable: boolean;
  isRefetching: boolean;
  isExporting: boolean;
  opensPlugin: boolean;
  chromeStatus: WidgetChromeStatus;
  onRefetch: (() => Promise<void>) | null;
  onConfigure?: () => void;
  onRemove?: () => void;
  onExpand: () => void;
  onExport: () => void;
  action?: React.ReactNode;
}) {
  const showUtilityActions = chromeStatus !== "disconnected";

  return (
    <div className="flex shrink-0 items-center gap-1.5" data-export-exclude>
      {showUtilityActions && onRefetch ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => {
            onRefetch()?.catch(() => {
              // Ignore refresh errors
            });
          }}
          disabled={isRefetching}
          className="uppercase-none h-auto w-auto cursor-pointer p-0.5 text-dim transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={`Refresh ${title}`}
        >
          <RefreshCw className={cn("icon-xs", isRefetching && "animate-spin")} />
        </Button>
      ) : null}
      {onConfigure && !isEditMode ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onConfigure}
          className="uppercase-none h-auto w-auto cursor-pointer p-0.5 text-dim transition-colors hover:text-foreground"
          aria-label={`Configure ${title}`}
        >
          <Settings className="icon-xs" />
        </Button>
      ) : null}
      {showUtilityActions && !isEditMode && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          data-export-exclude
          onClick={onExport}
          disabled={isExporting}
          className="uppercase-none h-auto w-auto cursor-pointer p-0.5 text-dim transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={`Export ${title} as image`}
        >
          <Camera className={cn("icon-xs", isExporting && "animate-pulse")} />
        </Button>
      )}
      {Boolean(onRemove) && isEditMode && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          data-export-exclude
          onClick={onRemove}
          className="uppercase-none h-auto w-auto cursor-pointer p-0.5 text-dim transition-colors hover:text-destructive"
          aria-label={`Remove ${title}`}
        >
          <Trash2 className="icon-xs" />
        </Button>
      )}
      {showUtilityActions && isExpandable && !isEditMode && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onExpand}
          className="uppercase-none h-auto w-auto cursor-pointer p-0.5 text-dim transition-colors hover:text-foreground"
          aria-label={opensPlugin ? `Open ${title}` : `Expand ${title}`}
        >
          {opensPlugin ? <ExternalLink className="icon-xs" /> : <Maximize2 className="icon-xs" />}
        </Button>
      )}
      {action}
    </div>
  );
}

function WidgetHeaderTitle({
  title,
  fetchedAt,
  effectiveLocale,
  effectiveTimezone,
  isInteractive,
  opensPlugin,
  onExpand,
  sharedTitleLayoutId,
  transitionEnabled,
}: {
  title: string;
  fetchedAt?: number | null;
  effectiveLocale: string;
  effectiveTimezone: string;
  isInteractive: boolean;
  opensPlugin?: boolean;
  onExpand: () => void;
  sharedTitleLayoutId?: string;
  transitionEnabled?: boolean;
}) {
  const content = isInteractive ? (
    <Button
      type="button"
      variant="ghost"
      onClick={onExpand}
      className="group uppercase-none -mx-1 -my-0.5 flex h-auto min-w-0 flex-1 cursor-pointer items-center justify-between gap-2 rounded-item px-1 py-0.5 text-left transition-colors hover:bg-surface-raised focus-visible:bg-surface-raised focus-visible:outline-none"
      aria-label={opensPlugin ? `Open ${title}` : `Expand ${title}`}
    >
      <WidgetHeaderText
        title={title}
        fetchedAt={fetchedAt}
        effectiveLocale={effectiveLocale}
        effectiveTimezone={effectiveTimezone}
        interactive
      />
    </Button>
  ) : (
    <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
      <WidgetHeaderText
        title={title}
        fetchedAt={fetchedAt}
        effectiveLocale={effectiveLocale}
        effectiveTimezone={effectiveTimezone}
      />
    </div>
  );

  if (!sharedTitleLayoutId || !transitionEnabled) return content;

  return (
    <m.div
      layoutId={sharedTitleLayoutId}
      transition={WIDGET_EXPANDED_LAYOUT_TRANSITION}
      className="flex min-w-0 flex-1 items-center"
    >
      {content}
    </m.div>
  );
}

export function WidgetCard({
  title,
  children,
  className,
  contentClassName,
  action,
  widgetId,
  expandedContent,
  expandedSize = DEFAULT_WIDGET_MODAL_SIZE,
  expandAction,
  fetchedAt,
  onRefetch,
  isRefetching = false,
  onConfigure,
  onRemove,
  chromeStatus = "default",
  isEditMode = false,
  isDragging = false,
  dragHandleRef,
  dragHandleListeners,
  dragHandleAttributes,
}: WidgetCardProps) {
  const cardRef = useRef<HTMLElement>(null);
  const {
    expandedWidgetId,
    expandWidget,
    collapseWidget,
    effectiveLocale,
    effectiveTimezone,
    widgetConfigs,
  } = useDashboard();
  const reduceMotion = useReducedMotion();

  const opensPlugin = expandAction?.type === "open-plugin";
  const utilityActionsVisible = chromeStatus !== "disconnected";

  // Per-widget font scale — when set, overrides the global preference via CSS cascade
  const perWidgetFontScale = widgetId
    ? (widgetConfigs[widgetId]?.fontScale as FontScale | undefined)
    : undefined;
  const isExpanded = widgetId != null && expandedWidgetId === widgetId;
  const isExpandable = widgetId != null && (expandedContent != null || opensPlugin);
  const layoutIds = widgetId ? getWidgetExpandedLayoutIds(widgetId) : null;
  const enableSharedLayout = Boolean(layoutIds && isExpandable && !reduceMotion);

  useFetchedAtTick(fetchedAt);

  const handleExpand = useCallback(() => {
    if (!widgetId) return;
    if (opensPlugin) {
      dispatchPluginNavigation(expandAction.pluginId);
    } else {
      expandWidget(widgetId);
    }
  }, [widgetId, opensPlugin, expandAction, expandWidget]);

  const isInteractiveHeader = isExpandable && !isEditMode && utilityActionsVisible;
  const compactFadeTransition = reduceMotion ? { duration: 0 } : WIDGET_EXPANDED_FADE_TRANSITION;

  const handleDoubleClick = useWidgetDoubleClick(
    isExpandable && utilityActionsVisible,
    isEditMode,
    handleExpand
  );

  const { exportAsPng, isExporting } = useExportWidgetImage({ cardRef, title });

  const handleRefetch = useCallback(async () => {
    if (onRefetch) await onRefetch();
  }, [onRefetch]);

  const card = (
    <m.section
      ref={cardRef}
      aria-label={title}
      layout={enableSharedLayout}
      layoutId={enableSharedLayout ? layoutIds?.shellId : undefined}
      transition={enableSharedLayout ? WIDGET_EXPANDED_LAYOUT_TRANSITION : undefined}
      className={cn(
        "widget-card flex flex-col overflow-hidden",
        className,
        isDragging && "opacity-30"
      )}
      onDoubleClick={isExpandable && utilityActionsVisible ? handleDoubleClick : undefined}
      {...(perWidgetFontScale ? { "data-font-scale": perWidgetFontScale } : {})}
    >
      <m.div
        layout={enableSharedLayout ? "position" : undefined}
        layoutId={enableSharedLayout ? layoutIds?.headerId : undefined}
        transition={enableSharedLayout ? WIDGET_EXPANDED_LAYOUT_TRANSITION : undefined}
        className={cn(
          "flex items-center justify-between border-border border-b bg-surface px-3 py-2",
          isInteractiveHeader && "gap-2"
        )}
      >
        {/* Drag handle — only shown in edit mode */}
        {Boolean(isEditMode) && dragHandleRef && (
          <Button
            ref={dragHandleRef}
            type="button"
            variant="ghost"
            size="icon"
            data-export-exclude
            className="uppercase-none mr-1.5 h-auto w-auto shrink-0 cursor-grab touch-none p-0.5 text-dim transition-colors hover:text-foreground active:cursor-grabbing"
            aria-label={`Drag to reorder ${title}`}
            {...dragHandleListeners}
            {...dragHandleAttributes}
          >
            <GripVertical className="icon-xs" />
          </Button>
        )}

        <WidgetHeaderTitle
          title={title}
          fetchedAt={fetchedAt}
          effectiveLocale={effectiveLocale}
          effectiveTimezone={effectiveTimezone}
          isInteractive={isInteractiveHeader}
          opensPlugin={opensPlugin}
          onExpand={handleExpand}
          sharedTitleLayoutId={layoutIds?.titleId}
          transitionEnabled={enableSharedLayout}
        />

        <m.div
          animate={{ opacity: isExpanded ? 0 : 1 }}
          transition={compactFadeTransition}
          className="shrink-0"
          style={isExpanded ? { pointerEvents: "none" } : undefined}
        >
          <WidgetCardActions
            title={title}
            isEditMode={isEditMode}
            isExpandable={isExpandable}
            isRefetching={isRefetching}
            isExporting={isExporting}
            opensPlugin={opensPlugin}
            chromeStatus={chromeStatus}
            onRefetch={onRefetch ? handleRefetch : null}
            onConfigure={onConfigure}
            onRemove={onRemove}
            onExpand={handleExpand}
            onExport={exportAsPng}
            action={action}
          />
        </m.div>
      </m.div>

      <m.div
        animate={{ opacity: isExpanded ? 0 : 1 }}
        transition={compactFadeTransition}
        className={cn("h-full min-h-0 flex-1 overflow-hidden", contentClassName)}
      >
        {children}
      </m.div>
    </m.section>
  );

  if (!layoutIds) {
    return (
      <LazyMotion features={domAnimation}>
        {card}
        {Boolean(isExpanded) && expandedContent && widgetId && (
          <ExpandedPortal
            title={title}
            widgetId={widgetId}
            sourceRef={cardRef}
            onClose={collapseWidget}
            defaultSize={expandedSize}
          >
            {expandedContent}
          </ExpandedPortal>
        )}
      </LazyMotion>
    );
  }

  return (
    <LazyMotion features={domAnimation}>
      <LayoutGroup id={layoutIds.groupId}>
        {card}
        <AnimatePresence>
          {Boolean(isExpanded) && expandedContent && widgetId && (
            <ExpandedPortal
              title={title}
              widgetId={widgetId}
              sourceRef={cardRef}
              onClose={collapseWidget}
              defaultSize={expandedSize}
              layoutIds={layoutIds}
            >
              {expandedContent}
            </ExpandedPortal>
          )}
        </AnimatePresence>
      </LayoutGroup>
    </LazyMotion>
  );
}
