"use client";

import type { DraggableAttributes, DraggableSyntheticListeners } from "@dnd-kit/core";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { useDashboard } from "@radarboard/hooks/use-dashboard";
import { ALL_PROJECTS_SLUG } from "@radarboard/types/dashboard";
import { ConfirmationDialog, DialogDescription } from "@radarboard/ui/app-dialog";
import { Button } from "@radarboard/ui/button";
import { ErrorBoundary } from "@radarboard/ui/error-boundary";
import { cn } from "@radarboard/utils/cn";
import { canPlaceWidgetInScope, type DashboardScope } from "@radarboard/widget-sdk/dashboard-scope";
import { emitWidgetDebugEvent } from "@radarboard/widget-sdk/debug-events";
import {
  extractInstanceOverrides,
  getActiveVariantId,
  resolveVariantConfig,
} from "@radarboard/widget-sdk/variant-utils";
import type { WidgetChromeStatus, WidgetRenderProps } from "@radarboard/widget-sdk/widget-types";
import { Plug, Plus } from "lucide-react";
import type React from "react";
import { useCallback, useMemo, useState } from "react";
import { WidgetCard } from "../widget-card";
import { DEFAULT_WIDGET_MODAL_SIZE } from "../widget-modal";
import { WidgetPickerPopover } from "../widget-picker-popover";
import { WIDGET_REGISTRY } from "../widgets/registry";

/** Stable empty-config reference so memoized config/props don't churn each render. */
const EMPTY_WIDGET_CONFIG: Record<string, unknown> = {};

async function executeManualRefresh(
  refetch: () => Promise<void>,
  ctx: { projectSlug: string | null; entityId: string; cellId: string }
) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  const base = {
    source: "widget/manual" as const,
    projectSlug: ctx.projectSlug,
    requestId,
    entityType: "widget" as const,
    entityId: ctx.entityId,
  };

  await emitWidgetDebugEvent({
    ...base,
    level: "info",
    eventType: "widget.manual_refresh.started",
    message: "Widget manual refresh started",
    status: "started",
    metadata: { cellId: ctx.cellId },
  });

  try {
    await refetch();
    await emitWidgetDebugEvent({
      ...base,
      level: "info",
      eventType: "widget.manual_refresh.completed",
      message: "Widget manual refresh completed",
      status: "completed",
      durationMs: Date.now() - startedAt,
      metadata: { cellId: ctx.cellId },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await emitWidgetDebugEvent({
      ...base,
      level: "error",
      eventType: "widget.manual_refresh.failed",
      message: "Widget manual refresh failed",
      status: "failed",
      durationMs: Date.now() - startedAt,
      metadata: { cellId: ctx.cellId, error: message },
    });
    throw error;
  }
}

interface WidgetSlotProps {
  cellId: string;
  className?: string;
  style?: React.CSSProperties;
  selectedDetailId?: string | null;
  onSelectedDetailIdChange?: (id: string | null) => void;
  onConfigure?: (widgetId: string) => void;
  /** Widget ID that was intended for this cell (from the applied blueprint). */
  suggestedWidgetId?: string | null;
  /** Callback to open the integration connection flow for a service. */
  onConnectService?: (serviceId: string) => void;
}

export function WidgetSlot({
  cellId,
  className,
  style,
  selectedDetailId,
  onSelectedDetailIdChange,
  onConfigure,
  suggestedWidgetId,
  onConnectService,
}: WidgetSlotProps) {
  const {
    projects,
    activeProjectSlug,
    timeRange,
    widgetLayout,
    widgetConfigs,
    isEditMode,
    updateWidgetLayout,
  } = useDashboard();

  const widgetId = widgetLayout[cellId] ?? null;
  const dashboardScope: DashboardScope =
    activeProjectSlug === null || activeProjectSlug === ALL_PROJECTS_SLUG
      ? "all-projects"
      : "project";

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `cell-${cellId}`,
    disabled: !isEditMode,
    data: { cellId, widgetId },
  });

  const {
    attributes: dragAttributes,
    listeners: dragListeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({
    id: `drag-${cellId}`,
    disabled: !isEditMode || !widgetId,
    data: { cellId, widgetId },
  });

  const [slotUi, setSlotUi] = useState<{
    fetchedAt: number | null;
    refetch: (() => Promise<void>) | null;
    isRefetching: boolean;
    chromeStatus: WidgetChromeStatus;
    pickerOpen: boolean;
    removeDialogOpen: boolean;
  }>({
    fetchedAt: null,
    refetch: null,
    isRefetching: false,
    chromeStatus: "default",
    pickerOpen: false,
    removeDialogOpen: false,
  });

  const handleFetchedAt = useCallback((timestamp: number | null) => {
    setSlotUi((current) => ({ ...current, fetchedAt: timestamp }));
  }, []);

  const handleRefetch = useCallback((refetchFn: (() => Promise<void>) | null) => {
    setSlotUi((current) => ({
      ...current,
      refetch: refetchFn,
    }));
  }, []);

  const handleChromeStateChange = useCallback((status: WidgetChromeStatus) => {
    setSlotUi((current) => ({ ...current, chromeStatus: status }));
  }, []);

  const handleConfigure = useCallback(() => {
    if (widgetId && onConfigure) onConfigure(widgetId);
  }, [widgetId, onConfigure]);

  const handlePickWidget = useCallback(
    (selectedWidgetId: string) => {
      updateWidgetLayout({ ...widgetLayout, [cellId]: selectedWidgetId });
    },
    [cellId, updateWidgetLayout, widgetLayout]
  );

  const handleRemoveWidget = useCallback(() => {
    updateWidgetLayout({ ...widgetLayout, [cellId]: null });
    setSlotUi((current) => ({ ...current, removeDialogOpen: false }));
  }, [cellId, updateWidgetLayout, widgetLayout]);

  const rawDescriptor = widgetId ? (WIDGET_REGISTRY.get(widgetId) ?? null) : null;
  const descriptor =
    rawDescriptor && canPlaceWidgetInScope(rawDescriptor, dashboardScope) ? rawDescriptor : null;
  const descriptorId = descriptor?.id ?? null;
  const handleManualRefetch = useCallback(async () => {
    if (!slotUi.refetch || !descriptorId) return;
    setSlotUi((current) => ({ ...current, isRefetching: true }));
    try {
      await executeManualRefresh(slotUi.refetch, {
        projectSlug: activeProjectSlug,
        entityId: descriptorId,
        cellId,
      });
    } finally {
      setSlotUi((current) => ({ ...current, isRefetching: false }));
    }
  }, [activeProjectSlug, cellId, descriptorId, slotUi.refetch]);

  // Config/props are memoized here (above the early returns) so hooks stay
  // unconditional. Stabilizing these lets a slot's own chrome-state changes
  // (refetching, dialogs) re-render without re-rendering the widget body.
  const instanceConfig = descriptor
    ? (widgetConfigs[descriptor.id] ?? EMPTY_WIDGET_CONFIG)
    : EMPTY_WIDGET_CONFIG;

  const mergedConfig = useMemo(() => {
    if (!descriptor) return EMPTY_WIDGET_CONFIG;
    const base = resolveVariantConfig(descriptor, instanceConfig) as Record<string, unknown>;
    return { ...base, ...extractInstanceOverrides(instanceConfig) };
  }, [descriptor, instanceConfig]);

  const effectiveTimeRange = useMemo(() => {
    const cfg = mergedConfig as Record<string, unknown>;
    if (cfg.ignoreTimeRange !== true) return timeRange;
    const custom = cfg.customTimeRange;
    if (typeof custom === "string" && custom) return custom as typeof timeRange;
    return "7d" as const;
  }, [mergedConfig, timeRange]);

  const activeVariantId = useMemo(
    () => (descriptor ? getActiveVariantId(descriptor, instanceConfig) : undefined),
    [descriptor, instanceConfig]
  );

  const title = useMemo(() => {
    if (!descriptor) return "";
    return (
      descriptor.getDisplayName?.({
        projectSlug: activeProjectSlug,
        projects,
        config: mergedConfig,
      }) ?? descriptor.name
    );
  }, [descriptor, activeProjectSlug, projects, mergedConfig]);

  const sharedProps = useMemo(
    () => ({
      widgetId: descriptor?.id ?? "",
      projectSlug: activeProjectSlug,
      timeRange: effectiveTimeRange,
      config: mergedConfig,
      selectedDetailId,
      onSelectedDetailIdChange,
      onFetchedAt: handleFetchedAt,
      onRefetch: handleRefetch,
      onChromeStateChange: handleChromeStateChange,
      activeVariantId,
      onConnectService,
    }),
    [
      descriptor,
      activeProjectSlug,
      effectiveTimeRange,
      mergedConfig,
      selectedDetailId,
      onSelectedDetailIdChange,
      handleFetchedAt,
      handleRefetch,
      handleChromeStateChange,
      activeVariantId,
      onConnectService,
    ]
  );

  if (widgetId && !rawDescriptor) {
    return (
      <div
        ref={setDropRef}
        style={style}
        className={cn(
          "dashboard-cell flex items-center justify-center bg-[var(--widget-bg)]",
          className
        )}
      >
        <span className="font-mono text-dim text-w-base">Unknown widget: {widgetId}</span>
      </div>
    );
  }

  if (!descriptor) {
    return (
      <EmptySlot
        setDropRef={setDropRef}
        style={style}
        className={className}
        isEditMode={isEditMode}
        isOver={isOver}
        pickerOpen={slotUi.pickerOpen}
        setPickerOpen={(pickerOpen) => setSlotUi((current) => ({ ...current, pickerOpen }))}
        widgetLayout={{ ...widgetLayout, [cellId]: null }}
        dashboardScope={dashboardScope}
        onSelect={handlePickWidget}
        suggestedWidgetId={suggestedWidgetId}
        onConnectService={onConnectService}
      />
    );
  }

  return (
    <PopulatedSlot
      descriptor={descriptor}
      title={title}
      sharedProps={sharedProps}
      setDropRef={setDropRef}
      style={style}
      className={className}
      isEditMode={isEditMode}
      isOver={isOver}
      isDragging={isDragging}
      fetchedAt={slotUi.fetchedAt}
      refetch={slotUi.refetch}
      handleManualRefetch={handleManualRefetch}
      isRefetching={slotUi.isRefetching}
      chromeStatus={slotUi.chromeStatus}
      onConfigure={onConfigure}
      handleConfigure={handleConfigure}
      setRemoveDialogOpen={(removeDialogOpen) =>
        setSlotUi((current) => ({ ...current, removeDialogOpen }))
      }
      removeDialogOpen={slotUi.removeDialogOpen}
      handleRemoveWidget={handleRemoveWidget}
      setDragRef={setDragRef}
      dragListeners={dragListeners}
      dragAttributes={dragAttributes}
    />
  );
}

function EmptySlot({
  setDropRef,
  style,
  className,
  isEditMode,
  isOver,
  pickerOpen,
  setPickerOpen,
  widgetLayout,
  dashboardScope,
  onSelect,
  suggestedWidgetId,
  onConnectService,
}: {
  setDropRef: (node: HTMLElement | null) => void;
  style?: React.CSSProperties;
  className?: string;
  isEditMode: boolean;
  isOver: boolean;
  pickerOpen: boolean;
  setPickerOpen: (open: boolean) => void;
  widgetLayout: Record<string, string | null>;
  dashboardScope: DashboardScope;
  onSelect: (widgetId: string) => void;
  suggestedWidgetId?: string | null;
  onConnectService?: (serviceId: string) => void;
}) {
  const rawSuggestedDescriptor = suggestedWidgetId ? WIDGET_REGISTRY.get(suggestedWidgetId) : null;
  const suggestedDescriptor =
    rawSuggestedDescriptor && canPlaceWidgetInScope(rawSuggestedDescriptor, dashboardScope)
      ? rawSuggestedDescriptor
      : null;
  const missingService =
    suggestedDescriptor && onConnectService
      ? (suggestedDescriptor.requiredIntegrations[0] ?? null)
      : null;
  const emptySlotAction =
    missingService && onConnectService ? (
      <Button
        type="button"
        onClick={() => onConnectService(missingService)}
        className={cn(
          "absolute inset-0 flex flex-col items-center justify-center gap-2",
          "h-auto rounded-item border border-border border-dashed",
          "text-dim hover:border-accent hover:text-foreground-secondary",
          "group cursor-pointer transition-colors"
        )}
        variant="ghost"
        uppercase={false}
      >
        <Plug className="icon-base transition-transform group-hover:scale-110" />
        <span className="font-mono text-w-xs uppercase tracking-widest">
          Connect {suggestedDescriptor?.name ?? missingService}
        </span>
      </Button>
    ) : (
      <Button
        type="button"
        onClick={() => setPickerOpen(true)}
        className={cn(
          "absolute inset-0 flex items-center justify-center",
          "h-auto rounded-item border border-border border-dashed",
          "text-[#333] hover:border-border hover:text-dim",
          "group cursor-pointer transition-colors"
        )}
        variant="ghost"
        uppercase={false}
      >
        <Plus className="icon-base transition-transform group-hover:scale-110" />
      </Button>
    );

  return (
    <div
      ref={setDropRef}
      style={style}
      className={cn(
        "dashboard-cell relative bg-[var(--widget-bg)]",
        className,
        isEditMode && isOver && "rounded-item ring-2 ring-[var(--color-accent)] ring-inset"
      )}
    >
      {emptySlotAction}
      <WidgetPickerPopover
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        widgetLayout={widgetLayout}
        dashboardScope={dashboardScope}
        onSelect={onSelect}
      />
    </div>
  );
}

function resolveExpandedContent(
  descriptor: ReturnType<typeof WIDGET_REGISTRY.get> & object,
  sharedProps: WidgetRenderProps<Record<string, unknown>>
) {
  if (descriptor.expandAction?.type === "open-plugin") return undefined;
  const ExpandedComponent = descriptor.expandedComponent;
  if (!ExpandedComponent) return undefined;
  return <ExpandedComponent {...sharedProps} />;
}

function PopulatedSlot({
  descriptor,
  title,
  sharedProps,
  setDropRef,
  style,
  className,
  isEditMode,
  isOver,
  isDragging,
  fetchedAt,
  refetch,
  handleManualRefetch,
  isRefetching,
  chromeStatus,
  onConfigure,
  handleConfigure,
  setRemoveDialogOpen,
  removeDialogOpen,
  handleRemoveWidget,
  setDragRef,
  dragListeners,
  dragAttributes,
}: {
  descriptor: ReturnType<typeof WIDGET_REGISTRY.get> & object;
  title: string;
  sharedProps: WidgetRenderProps<Record<string, unknown>>;
  setDropRef: (node: HTMLElement | null) => void;
  style?: React.CSSProperties;
  className?: string;
  isEditMode: boolean;
  isOver: boolean;
  isDragging: boolean;
  fetchedAt: number | null;
  refetch: (() => Promise<void>) | null;
  handleManualRefetch: () => Promise<void>;
  isRefetching: boolean;
  chromeStatus: WidgetChromeStatus;
  onConfigure?: (widgetId: string) => void;
  handleConfigure: () => void;
  setRemoveDialogOpen: (open: boolean) => void;
  removeDialogOpen: boolean;
  handleRemoveWidget: () => void;
  setDragRef: (node: HTMLElement | null) => void;
  dragListeners: DraggableSyntheticListeners | undefined;
  dragAttributes: DraggableAttributes;
}) {
  const Component = descriptor.component;
  // Memoize the widget body element: when this slot re-renders for chrome-only
  // reasons (refetch spinner, dialogs), the same element reference lets React
  // skip re-rendering the widget's (often expensive) data component.
  const widgetContent = useMemo(() => <Component {...sharedProps} />, [Component, sharedProps]);
  const expandedContent = useMemo(
    () => resolveExpandedContent(descriptor, sharedProps),
    [descriptor, sharedProps]
  );

  return (
    <div
      ref={setDropRef}
      style={style}
      className={cn(
        "dashboard-cell bg-[var(--widget-bg)]",
        className,
        isEditMode && isOver && "rounded-item ring-2 ring-[var(--color-accent)] ring-inset"
      )}
    >
      <ErrorBoundary title={title} className="h-full">
        <WidgetCard
          title={title}
          className="h-full"
          widgetId={descriptor.id}
          fetchedAt={fetchedAt}
          onRefetch={refetch ? handleManualRefetch : null}
          isRefetching={isRefetching}
          chromeStatus={chromeStatus}
          onConfigure={onConfigure ? handleConfigure : undefined}
          onRemove={isEditMode ? () => setRemoveDialogOpen(true) : undefined}
          expandedContent={expandedContent}
          expandedSize={descriptor.expandedSize ?? DEFAULT_WIDGET_MODAL_SIZE}
          expandAction={descriptor.expandAction}
          isEditMode={isEditMode}
          isDragging={isDragging}
          dragHandleRef={setDragRef}
          dragHandleListeners={dragListeners}
          dragHandleAttributes={dragAttributes}
        >
          {widgetContent}
        </WidgetCard>

        <ConfirmationDialog
          open={removeDialogOpen}
          onOpenChange={setRemoveDialogOpen}
          title="Remove Widget"
          confirmLabel="Remove widget"
          onConfirm={handleRemoveWidget}
          successToast={`Removed ${title}`}
          errorToast="Failed to remove widget"
        >
          <DialogDescription>
            Remove <span className="text-foreground">{title}</span> from this project and the
            current layout?
          </DialogDescription>
        </ConfirmationDialog>
      </ErrorBoundary>
    </div>
  );
}
