"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  type DraggableAttributes,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  createDefaultDashboardWidgetLayout,
  normalizeDashboardWidgetLayout,
} from "@radarboard/hooks/dashboard-layout";
import { useCredentials } from "@radarboard/hooks/use-credentials";
import { useDashboard } from "@radarboard/hooks/use-dashboard";
import { getIntegration } from "@radarboard/integration-sdk";
import type { LayoutCell, LayoutDefinition } from "@radarboard/types/database";
import {
  ConfirmationDialog,
  Dialog,
  DialogBody,
  DialogCancelButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogSizeToggle,
  DialogTitle,
} from "@radarboard/ui/app-dialog";
import { Button } from "@radarboard/ui/button";
import { Input } from "@radarboard/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@radarboard/ui/tooltip";
import { cn } from "@radarboard/utils/cn";
import {
  generateGridTemplateAreas,
  getCellSlotName,
  getGridAreaName,
  getSortedCells,
  resolveColSizes,
  resolveRowSizes,
  sizesToGridTemplate,
} from "@radarboard/widget-engine/layouts";
import type { WidgetDescriptor } from "@radarboard/widget-engine/widgets/registry";
import { WIDGET_REGISTRY } from "@radarboard/widget-engine/widgets/registry";
import { GripVertical, Search, X } from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { RemoteServiceIcon } from "@/components/shared/remote-service-icon";
import { getServiceFaviconUrl } from "@/lib/service-favicons";

type AssignmentMap = Record<string, string | null>;
type PendingRemoval = {
  cellId: string;
  widgetName: string;
} | null;
type PendingReplace = {
  displacedName: string;
  sourceCellId: string | null;
  targetCellId: string;
  targetCellLabel: string;
  widgetId: string;
  widgetName: string;
} | null;

const WIDGET_LIBRARY_CATEGORY_LABELS: Record<string, string> = {
  revenue: "Revenue & Monetization",
  analytics: "Analytics & SEO",
  development: "Development",
  product: "Product & Delivery",
  infrastructure: "Deployment & Infrastructure",
  plugins: "Plugins",
  other: "Other",
};

const WIDGET_PLACEMENT_MODAL_SIZES = ["md", "lg"] as const;
type WidgetPlacementModalSize = (typeof WIDGET_PLACEMENT_MODAL_SIZES)[number];
const MAX_VISIBLE_SERVICE_ICONS = 2;
const noopDragRef = (_node: HTMLElement | null) => undefined;

const REQUIRED_INTEGRATION_TO_SERVICE_ID: Record<string, string> = {
  appStoreConnect: "app-store-connect",
  betterstack: "betterstack",
  github: "github",
  googleSearchConsole: "google-search-console",
  linear: "linear",
  npm: "npm",
  openCollective: "open-collective",
  openPanel: "openpanel",
  revenuecat: "revenuecat",
  sentry: "sentry",
  vercel: "vercel",
};

function getWidgetCategoryId(descriptor: WidgetDescriptor): string {
  return descriptor.id.includes("__") ? "plugins" : descriptor.catalogCategory?.trim() || "other";
}

function getWidgetServiceRequirements(descriptor: WidgetDescriptor) {
  const services = new Map<string, { id: string; label: string }>();

  for (const integrationKey of descriptor.requiredIntegrations) {
    const serviceId = REQUIRED_INTEGRATION_TO_SERVICE_ID[integrationKey] ?? integrationKey;
    if (!services.has(serviceId)) {
      const integration = getIntegration(serviceId);
      services.set(serviceId, {
        id: serviceId,
        label: integration?.name ?? integrationKey,
      });
    }
  }

  if (descriptor.auth) {
    const authList = Array.isArray(descriptor.auth) ? descriptor.auth : [descriptor.auth];
    for (const auth of authList) {
      if (auth.type === "none" || !auth.id) continue;
      if (!services.has(auth.id)) {
        services.set(auth.id, {
          id: auth.id,
          label: auth.name ?? auth.id,
        });
      }
    }
  }

  return Array.from(services.values());
}

function DraggableCellWidget({
  widgetId,
  descriptor,
  connectedKeys,
  cellLabelById,
  widgetToCellId,
  hideAssignment,
}: {
  widgetId: string;
  descriptor: WidgetDescriptor;
  connectedKeys: string[];
  cellLabelById: Map<string, string>;
  widgetToCellId: Map<string, string>;
  hideAssignment?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `chip-${widgetId}`,
  });
  const serviceRequirements = getWidgetServiceRequirements(descriptor);
  const assignedCellId = widgetToCellId.get(descriptor.id) ?? null;
  const { connected, total } = (() => {
    const authList = descriptor.auth
      ? Array.isArray(descriptor.auth)
        ? descriptor.auth
        : [descriptor.auth]
      : [];
    const connectable = authList.filter((a) => a.type === "api_key" || a.type === "oauth");
    return {
      connected: connectable.filter((a) => connectedKeys.includes(a.id ?? descriptor.id)).length,
      total: connectable.length,
    };
  })();

  return (
    <LibraryWidgetRow
      descriptor={descriptor}
      isAssigned={assignedCellId !== null}
      assignedSlot={assignedCellId ? (cellLabelById.get(assignedCellId) ?? null) : null}
      connectedServices={connected}
      totalServices={total}
      connectedKeys={connectedKeys}
      serviceRequirements={serviceRequirements}
      dragProps={{ ref: setNodeRef, isDragging, listeners, attributes }}
      hideAssignment={hideAssignment}
    />
  );
}

function DroppableCell({
  cell,
  cellLabel,
  widgetId,
  descriptor,
  connectedKeys,
  cellLabelById,
  widgetToCellId,
  onRequestRemove,
  style,
}: {
  cell: LayoutCell;
  cellLabel: string;
  widgetId: string | null;
  descriptor: WidgetDescriptor | null;
  connectedKeys: string[];
  cellLabelById: Map<string, string>;
  widgetToCellId: Map<string, string>;
  onRequestRemove?: () => void;
  style: React.CSSProperties;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: `cell-${cell.id}` });
  const isFilled = widgetId !== null && descriptor !== null;
  const sizeLabel = cell.rowSpan > 1 || cell.colSpan > 1 ? `${cell.colSpan}×${cell.rowSpan}` : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex flex-col border border-border bg-background transition-colors",
        isOver && "border-accent bg-accent/10"
      )}
    >
      <div className="flex items-center justify-between border-border border-b bg-surface px-2 py-1">
        <span className="font-mono text-dim text-w-sm uppercase tracking-wider">{cellLabel}</span>
        <div className="flex items-center gap-1">
          {Boolean(sizeLabel) && (
            <span className="font-mono text-dim/40 text-w-sm">{sizeLabel}</span>
          )}
          {isFilled && onRequestRemove ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    onRequestRemove();
                  }}
                  className="uppercase-none h-4 w-4 text-dim transition-colors hover:bg-surface-raised hover:text-destructive"
                  aria-label={`Remove ${descriptor.name} from ${cellLabel}`}
                >
                  <X className="h-2.5 w-2.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{`Remove ${descriptor.name} from ${cellLabel}`}</TooltipContent>
            </Tooltip>
          ) : null}
        </div>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center p-1.5">
        {isFilled ? (
          <div className="w-full max-w-sidebar">
            <DraggableCellWidget
              widgetId={widgetId}
              descriptor={descriptor}
              connectedKeys={connectedKeys}
              cellLabelById={cellLabelById}
              widgetToCellId={widgetToCellId}
              hideAssignment
            />
          </div>
        ) : (
          <span
            className={cn(
              "rounded-item border border-dashed px-2 py-1.5 font-mono text-xs",
              isOver ? "border-accent text-accent" : "border-border text-dim"
            )}
          >
            drop here
          </span>
        )}
      </div>
    </div>
  );
}

function DynamicLayoutGrid({
  layout,
  assignments,
  connectedKeys,
  cellLabelById,
  widgetToCellId,
  onRequestRemove,
}: {
  layout: LayoutDefinition;
  assignments: AssignmentMap;
  connectedKeys: string[];
  cellLabelById: Map<string, string>;
  widgetToCellId: Map<string, string>;
  onRequestRemove: (cellId: string, widgetName: string) => void;
}) {
  const sortedCells = useMemo(() => getSortedCells(layout.cells), [layout.cells]);
  const gridTemplateAreas = useMemo(() => generateGridTemplateAreas(layout), [layout]);
  const gridTemplateColumns = useMemo(() => sizesToGridTemplate(resolveColSizes(layout)), [layout]);
  const gridTemplateRows = useMemo(() => sizesToGridTemplate(resolveRowSizes(layout)), [layout]);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateAreas,
        gridTemplateColumns,
        gridTemplateRows,
        gap: "2px",
        height: "100%",
      }}
    >
      {sortedCells.map((cell, index) => {
        const widgetId = assignments[cell.id] ?? null;
        const descriptor = widgetId ? (WIDGET_REGISTRY.get(widgetId) ?? null) : null;

        return (
          <DroppableCell
            key={cell.id}
            cell={cell}
            cellLabel={getCellSlotName(index)}
            widgetId={widgetId}
            descriptor={descriptor}
            connectedKeys={connectedKeys}
            cellLabelById={cellLabelById}
            widgetToCellId={widgetToCellId}
            onRequestRemove={
              descriptor ? () => onRequestRemove(cell.id, descriptor.name) : undefined
            }
            style={{ gridArea: getGridAreaName(cell.id) }}
          />
        );
      })}
    </div>
  );
}

function LibraryWidgetRow({
  descriptor,
  isAssigned,
  assignedSlot,
  connectedServices,
  totalServices,
  connectedKeys,
  dragProps,
  serviceRequirements,
  hideAssignment,
}: {
  descriptor: WidgetDescriptor;
  isAssigned: boolean;
  assignedSlot: string | null;
  connectedServices: number;
  totalServices: number;
  connectedKeys: string[];
  serviceRequirements: Array<{ id: string; label: string }>;
  dragProps: {
    ref: (node: HTMLElement | null) => void;
    style?: React.CSSProperties;
    isDragging: boolean;
    listeners?: Record<string, unknown>;
    attributes?: DraggableAttributes;
  };
  hideAssignment?: boolean;
}) {
  const visibleServices = serviceRequirements.slice(0, MAX_VISIBLE_SERVICE_ICONS);
  const hiddenServiceCount = Math.max(serviceRequirements.length - visibleServices.length, 0);

  return (
    <div
      ref={dragProps.ref}
      style={dragProps.style}
      className={cn(
        "cursor-grab rounded-item border transition-all active:cursor-grabbing",
        isAssigned
          ? "border-accent/30 bg-secondary/20 shadow-sm hover:border-accent"
          : "border-border bg-surface opacity-60 hover:opacity-80",
        dragProps.isDragging && "opacity-0"
      )}
      {...dragProps.listeners}
      {...dragProps.attributes}
    >
      <div className="flex items-start gap-2 px-2.5 py-1.5">
        <GripVertical className="icon-xs shrink-0 text-dim" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1.5">
            <span className="min-w-0 flex-1 truncate font-mono text-foreground text-w-sm">
              {descriptor.name}
            </span>
            {serviceRequirements.length > 0 ? (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex shrink-0 items-center gap-1">
                      {visibleServices.map((service) => {
                        const faviconUrl = getServiceFaviconUrl(service.id, 32);
                        const isConnected = connectedKeys.includes(service.id);
                        return (
                          <span
                            key={service.id}
                            className={cn(
                              "inline-flex h-4 w-4 items-center justify-center rounded-full border",
                              isConnected
                                ? "border-border bg-surface-raised"
                                : "border-border bg-surface"
                            )}
                          >
                            <RemoteServiceIcon
                              src={faviconUrl}
                              alt={service.label}
                              size={12}
                              className={cn("rounded-full border-0", !isConnected && "opacity-50")}
                            />
                          </span>
                        );
                      })}
                      {hiddenServiceCount > 0 ? (
                        <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full border border-border bg-surface px-1 font-mono text-dim text-w-sm">
                          +{hiddenServiceCount}
                        </span>
                      ) : null}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    className="font-mono text-w-xs normal-case tracking-normal"
                  >
                    <div className="space-y-1">
                      {serviceRequirements.map((service) => {
                        const isConnected = connectedKeys.includes(service.id);
                        return (
                          <div key={service.id} className="flex items-center gap-2">
                            <span
                              className={cn(
                                "inline-block h-1.5 w-1.5 rounded-full",
                                isConnected ? "bg-success" : "bg-dim"
                              )}
                            />
                            <span>
                              {service.label}
                              {isConnected ? " connected" : " required"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-dim text-w-sm leading-relaxed">
            {descriptor.description}
          </p>
          {!hideAssignment && (
            <div className="mt-1 flex items-center gap-1.5 font-mono text-dim text-w-sm">
              {isAssigned && assignedSlot ? (
                <>
                  <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  <span className="truncate text-accent">Placed on {assignedSlot}</span>
                </>
              ) : (
                <span className="truncate">
                  {totalServices > 0
                    ? connectedServices > 0
                      ? `${connectedServices}/${totalServices} connected`
                      : "Needs connection"
                    : "Ready to place"}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LibraryWidgetDragPreview({
  descriptor,
  isAssigned,
  assignedSlot,
  connectedServices,
  totalServices,
  connectedKeys,
  serviceRequirements,
}: {
  descriptor: WidgetDescriptor;
  isAssigned: boolean;
  assignedSlot: string | null;
  connectedServices: number;
  totalServices: number;
  connectedKeys: string[];
  serviceRequirements: Array<{ id: string; label: string }>;
}) {
  return (
    <div className="w-64 rounded-item border border-accent bg-surface-raised shadow-xl">
      <LibraryWidgetRow
        descriptor={descriptor}
        isAssigned={isAssigned}
        assignedSlot={assignedSlot}
        connectedServices={connectedServices}
        totalServices={totalServices}
        connectedKeys={connectedKeys}
        serviceRequirements={serviceRequirements}
        dragProps={{ ref: noopDragRef, isDragging: false }}
        hideAssignment
      />
    </div>
  );
}

function DraggableLibraryWidget({
  descriptor,
  isAssigned,
  assignedSlot,
  connectedServices,
  totalServices,
  connectedKeys,
}: {
  descriptor: WidgetDescriptor;
  isAssigned: boolean;
  assignedSlot: string | null;
  connectedServices: number;
  totalServices: number;
  connectedKeys: string[];
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `lib-${descriptor.id}`,
  });
  const serviceRequirements = getWidgetServiceRequirements(descriptor);

  return (
    <LibraryWidgetRow
      descriptor={descriptor}
      isAssigned={isAssigned}
      assignedSlot={assignedSlot}
      connectedServices={connectedServices}
      totalServices={totalServices}
      connectedKeys={connectedKeys}
      serviceRequirements={serviceRequirements}
      dragProps={{ ref: setNodeRef, isDragging, listeners, attributes }}
    />
  );
}

function useProjectWidgetPlacementState(effectiveAssignments: AssignmentMap, open: boolean) {
  const previousOpen = useRef(open);
  const [uiState, setUiState] = useState<{
    activeDragId: string | null;
    assignments: AssignmentMap;
    modalSize: WidgetPlacementModalSize;
    pendingRemoval: PendingRemoval;
    pendingReplace: PendingReplace;
    searchQuery: string;
  }>({
    activeDragId: null,
    assignments: effectiveAssignments,
    modalSize: "md",
    pendingRemoval: null,
    pendingReplace: null,
    searchQuery: "",
  });

  useEffect(() => {
    if (open && !previousOpen.current) {
      setUiState((current) => ({ ...current, modalSize: "md" }));
    }
    previousOpen.current = open;
  }, [open]);

  useEffect(() => {
    setUiState((current) => ({ ...current, assignments: effectiveAssignments }));
  }, [effectiveAssignments]);

  return { setUiState, uiState };
}

function WidgetLibrarySidebar({
  cellLabelById,
  connectedKeys,
  countServices,
  filteredWidgets,
  groupedWidgets,
  searchQuery,
  setSearchQuery,
  widgetToCellId,
}: {
  cellLabelById: Map<string, string>;
  connectedKeys: string[];
  countServices: (descriptor: WidgetDescriptor) => { connected: number; total: number };
  filteredWidgets: WidgetDescriptor[];
  groupedWidgets: Array<{ id: string; label: string; widgets: WidgetDescriptor[] }>;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  widgetToCellId: Map<string, string>;
}) {
  return (
    <div className="flex w-sidebar shrink-0 flex-col overflow-hidden border-border border-r">
      <div className="shrink-0 px-4 pt-3 pb-2">
        <div className="mb-2 font-mono text-dim text-w-sm uppercase tracking-widest">
          Widget Library
        </div>
        <div className="relative">
          <Search className="icon-xs absolute top-1/2 left-2.5 -translate-y-1/2 text-dim" />
          <Input
            type="text"
            placeholder="Search widgets…"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="h-8 w-full py-1.5 pr-3 pl-8 font-mono text-w-sm"
          />
        </div>
      </div>

      <div className="scrollbar-thin flex-1 overflow-y-auto px-4 pb-4">
        <div className="pb-2 font-mono text-dim text-w-sm">
          {filteredWidgets.length} {filteredWidgets.length === 1 ? "widget" : "widgets"}
        </div>
        {groupedWidgets.length === 0 ? (
          <div className="rounded-item border border-border border-dashed px-3 py-4 font-mono text-dim text-w-sm">
            No widgets match that search yet.
          </div>
        ) : (
          <div className="space-y-4">
            {groupedWidgets.map((group) => (
              <section key={group.id}>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <h3 className="font-mono text-dim text-w-sm uppercase tracking-widest">
                    {group.label}
                  </h3>
                  <span className="font-mono text-dim/70 text-w-sm">{group.widgets.length}</span>
                </div>
                <div className="space-y-1.5">
                  {group.widgets.map((descriptor) => {
                    const assignedCellId = widgetToCellId.get(descriptor.id) ?? null;
                    const { connected, total } = countServices(descriptor);
                    return (
                      <DraggableLibraryWidget
                        key={descriptor.id}
                        descriptor={descriptor}
                        isAssigned={assignedCellId !== null}
                        assignedSlot={
                          assignedCellId ? (cellLabelById.get(assignedCellId) ?? null) : null
                        }
                        connectedServices={connected}
                        totalServices={total}
                        connectedKeys={connectedKeys}
                      />
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function WidgetPlacementPreview({
  assignments,
  cellLabelById,
  connectedKeys,
  layout,
  onRequestRemove,
  sortedCells,
}: {
  assignments: AssignmentMap;
  cellLabelById: Map<string, string>;
  connectedKeys: string[];
  layout: LayoutDefinition;
  onRequestRemove: (cellId: string, widgetName: string) => void;
  sortedCells: LayoutCell[];
}) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="shrink-0 px-4 pt-3 pb-2">
        <div className="font-mono text-dim text-w-sm uppercase tracking-widest">Layout Preview</div>
        <div className="mt-0.5 text-dim/60 text-w-sm">
          Drag widgets from the library to place them. These changes stay scoped to this project,
          page, and layout.
        </div>
      </div>

      <div className="flex-1 overflow-hidden p-4 pt-2">
        <div className="h-full overflow-hidden rounded-item border border-border bg-background p-0.5">
          <DynamicLayoutGrid
            layout={layout}
            assignments={assignments}
            connectedKeys={connectedKeys}
            cellLabelById={cellLabelById}
            widgetToCellId={
              new Map(
                Object.entries(assignments)
                  .filter(([, widgetId]) => widgetId)
                  .map(([cellId, widgetId]) => [widgetId as string, cellId])
              )
            }
            onRequestRemove={onRequestRemove}
          />
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap gap-2 border-border border-t px-4 py-2">
        {sortedCells.map((cell) => {
          const widgetId = assignments[cell.id] ?? null;
          const descriptor = widgetId ? WIDGET_REGISTRY.get(widgetId) : null;
          if (!descriptor) return null;

          const label = cellLabelById.get(cell.id) ?? cell.id;
          return (
            <Tooltip key={cell.id}>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onRequestRemove(cell.id, descriptor.name)}
                  className="group uppercase-none flex h-auto items-center gap-1 rounded-item border border-border bg-surface px-2 py-1 font-sans transition-colors hover:border-destructive"
                >
                  <span className="font-mono text-dim text-w-sm">{label}</span>
                  <span className="font-mono text-foreground-secondary text-w-sm">
                    {descriptor.name}
                  </span>
                  <X className="h-2.5 w-2.5 text-dim transition-colors group-hover:text-destructive" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{`Remove ${descriptor.name} from ${label}`}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}

function WidgetPlacementHeader({
  layout,
  modalSize,
  pageName,
  projectName,
  setModalSize,
}: {
  layout: LayoutDefinition;
  modalSize: WidgetPlacementModalSize;
  pageName: string;
  projectName: string;
  setModalSize: (size: WidgetPlacementModalSize) => void;
}) {
  return (
    <DialogHeader className="shrink-0 border-border border-b px-5 py-4">
      <DialogTitle className="flex items-start gap-2 font-mono text-w-base">
        <span className="min-w-0 flex-1">
          Widget Placement — <span className="text-accent">{projectName}</span>
          <span className="ml-2 font-normal text-dim text-xs">
            {pageName} · {layout.name} · {layout.cells.length}{" "}
            {layout.cells.length === 1 ? "cell" : "cells"}
          </span>
        </span>
        <DialogSizeToggle
          size={modalSize}
          sizes={WIDGET_PLACEMENT_MODAL_SIZES}
          onSizeChange={(size) => {
            if (size === "md" || size === "lg") {
              setModalSize(size);
            }
          }}
          ariaLabel="Widget placement size"
          className="mt-0.5"
        />
      </DialogTitle>
      <DialogDescription>
        Drag widgets from the library into open slots. Changes stay scoped to{" "}
        <span className="text-foreground-secondary">{projectName}</span>,{" "}
        <span className="text-foreground-secondary">{pageName}</span>, and{" "}
        <span className="text-foreground-secondary">{layout.name}</span>.
      </DialogDescription>
    </DialogHeader>
  );
}

function WidgetPlacementDialogs({
  executePlace,
  handleRemoveFromCell,
  layout,
  pendingRemoval,
  pendingReplace,
  projectName,
  setPendingRemoval,
  setPendingReplace,
}: {
  executePlace: (widgetId: string, targetCellId: string) => void;
  handleRemoveFromCell: (cellId: string) => void;
  layout: LayoutDefinition;
  pendingRemoval: PendingRemoval;
  pendingReplace: PendingReplace;
  projectName: string;
  setPendingRemoval: (value: PendingRemoval) => void;
  setPendingReplace: (value: PendingReplace) => void;
}) {
  return (
    <>
      <ConfirmationDialog
        open={pendingRemoval !== null}
        onOpenChange={(nextOpen) => !nextOpen && setPendingRemoval(null)}
        title="Remove Widget"
        confirmLabel="Remove widget"
        onConfirm={() => {
          if (pendingRemoval) handleRemoveFromCell(pendingRemoval.cellId);
        }}
        successToast={
          pendingRemoval
            ? `Removed ${pendingRemoval.widgetName} from ${projectName}`
            : "Widget removed"
        }
        errorToast="Failed to remove widget"
      >
        <DialogDescription>
          {pendingRemoval ? (
            <>
              Remove <span className="text-foreground">{pendingRemoval.widgetName}</span>
              from <span className="text-foreground"> {projectName}</span> on the
              <span className="text-foreground"> {layout.name}</span> layout?
            </>
          ) : null}
        </DialogDescription>
      </ConfirmationDialog>

      <Dialog
        open={pendingReplace !== null}
        onOpenChange={(nextOpen) => !nextOpen && setPendingReplace(null)}
      >
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Replace Widget</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <DialogDescription>
              {pendingReplace ? (
                <>
                  <span className="text-foreground">{pendingReplace.targetCellLabel}</span> already
                  has <span className="text-foreground">{pendingReplace.displacedName}</span>.
                  Replace it with{" "}
                  <span className="text-foreground">{pendingReplace.widgetName}</span>?
                  {pendingReplace.sourceCellId
                    ? " The existing widget will swap to the source cell."
                    : " The existing widget will be unassigned."}
                </>
              ) : null}
            </DialogDescription>
          </DialogBody>
          <DialogFooter className="justify-end">
            <DialogCancelButton onClick={() => setPendingReplace(null)}>Cancel</DialogCancelButton>
            <Button
              onClick={() => {
                if (pendingReplace) {
                  executePlace(pendingReplace.widgetId, pendingReplace.targetCellId);
                }
                setPendingReplace(null);
              }}
            >
              Replace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ProjectWidgetPlacementModal({
  open,
  onOpenChange,
  projectSlug,
  projectName,
  pageSlug,
  pageName,
  layout,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectSlug: string;
  projectName: string;
  pageSlug: string;
  pageName: string;
  layout: LayoutDefinition;
}) {
  const { projectLayouts, updateProjectPageWidgetLayout } = useDashboard();
  const { connectedKeys } = useCredentials();

  const sortedCells = useMemo(() => getSortedCells(layout.cells), [layout.cells]);
  const cellLabelById = useMemo(
    () => new Map(sortedCells.map((cell, index) => [cell.id, getCellSlotName(index)])),
    [sortedCells]
  );

  const effectiveAssignments = useMemo<AssignmentMap>(() => {
    const savedLayout =
      projectLayouts[projectSlug]?.pages?.find((page) => page.slug === pageSlug)?.widgetLayouts?.[
        layout.id
      ] ?? {};

    return Object.keys(savedLayout).length > 0
      ? normalizeDashboardWidgetLayout(layout, savedLayout)
      : createDefaultDashboardWidgetLayout(layout);
  }, [layout, pageSlug, projectLayouts, projectSlug]);
  const {
    uiState: { activeDragId, assignments, modalSize, pendingRemoval, pendingReplace, searchQuery },
    setUiState,
  } = useProjectWidgetPlacementState(effectiveAssignments, open);

  const widgetToCellId = useMemo(() => {
    const map = new Map<string, string>();
    for (const [cellId, widgetId] of Object.entries(assignments)) {
      if (widgetId) map.set(widgetId, cellId);
    }
    return map;
  }, [assignments]);

  function countServices(descriptor: WidgetDescriptor) {
    const getAuthList = () => {
      if (!descriptor.auth) return [];
      return Array.isArray(descriptor.auth) ? descriptor.auth : [descriptor.auth];
    };
    const authList = getAuthList();
    const connectable = authList.filter((auth) => auth.type === "api_key" || auth.type === "oauth");
    const total = connectable.length;
    const connected = connectable.filter((auth) =>
      connectedKeys.includes(auth.id ?? descriptor.id)
    ).length;
    return { connected, total };
  }

  const allWidgets = useMemo(() => Array.from(WIDGET_REGISTRY.values()), []);

  const filteredWidgets = useMemo(() => {
    if (!searchQuery.trim()) return allWidgets;
    const query = searchQuery.toLowerCase();
    return allWidgets.filter(
      (widget) =>
        widget.name.toLowerCase().includes(query) ||
        widget.description.toLowerCase().includes(query) ||
        widget.id.toLowerCase().includes(query)
    );
  }, [allWidgets, searchQuery]);

  const groupedWidgets = useMemo(() => {
    const categories = new Map<string, WidgetDescriptor[]>();

    for (const widget of filteredWidgets) {
      const categoryId = getWidgetCategoryId(widget);
      const entries = categories.get(categoryId) ?? [];
      entries.push(widget);
      categories.set(categoryId, entries);
    }

    const orderedCategoryIds = Object.keys(WIDGET_LIBRARY_CATEGORY_LABELS);
    const dynamicCategoryIds = Array.from(categories.keys()).filter(
      (categoryId) => !orderedCategoryIds.includes(categoryId)
    );

    return [...orderedCategoryIds, ...dynamicCategoryIds]
      .filter((categoryId) => (categories.get(categoryId)?.length ?? 0) > 0)
      .map((categoryId) => ({
        id: categoryId,
        label: WIDGET_LIBRARY_CATEGORY_LABELS[categoryId] ?? categoryId,
        widgets: (categories.get(categoryId) ?? []).sort((a, b) => a.name.localeCompare(b.name)),
      }));
  }, [filteredWidgets]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  function applyAssignments(next: AssignmentMap) {
    setUiState((current) => ({ ...current, assignments: next }));
    const toSave: AssignmentMap = {};
    for (const cell of sortedCells) {
      toSave[cell.id] = next[cell.id] ?? null;
    }
    updateProjectPageWidgetLayout(projectSlug, pageSlug, layout.id, toSave);
  }

  function executePlace(widgetId: string, targetCellId: string) {
    const currentCellId = widgetToCellId.get(widgetId);
    const next = { ...assignments };
    if (currentCellId) next[currentCellId] = null;

    const displaced = next[targetCellId];
    if (displaced && currentCellId) next[currentCellId] = displaced;

    next[targetCellId] = widgetId;
    applyAssignments(next);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setUiState((current) => ({ ...current, activeDragId: null }));
    if (!over) return;

    const overId = over.id as string;
    if (!overId.startsWith("cell-")) return;

    const targetCellId = overId.replace("cell-", "");
    const activeId = active.id as string;

    let widgetId: string;
    if (activeId.startsWith("lib-")) widgetId = activeId.replace("lib-", "");
    else if (activeId.startsWith("chip-")) widgetId = activeId.replace("chip-", "");
    else return;

    const currentCellId = widgetToCellId.get(widgetId);
    if (currentCellId === targetCellId) return;

    const displaced = assignments[targetCellId];
    const displacedDescriptor = displaced ? WIDGET_REGISTRY.get(displaced) : null;
    const draggedDescriptor = WIDGET_REGISTRY.get(widgetId);

    // If the target cell already has a widget, ask for confirmation
    if (displacedDescriptor && draggedDescriptor) {
      setUiState((current) => ({
        ...current,
        pendingReplace: {
          widgetId,
          widgetName: draggedDescriptor.name,
          targetCellId,
          targetCellLabel: cellLabelById.get(targetCellId) ?? targetCellId,
          displacedName: displacedDescriptor.name,
          sourceCellId: currentCellId ?? null,
        },
      }));
      return;
    }

    executePlace(widgetId, targetCellId);
  }

  function handleDragStart(event: DragStartEvent) {
    setUiState((current) => ({ ...current, activeDragId: event.active.id as string }));
  }

  function handleRemoveFromCell(cellId: string) {
    applyAssignments({ ...assignments, [cellId]: null });
    setUiState((current) => ({ ...current, pendingRemoval: null }));
  }

  const activeDragDescriptor = useMemo(() => {
    if (!activeDragId) return null;

    const widgetId = activeDragId.startsWith("lib-")
      ? activeDragId.replace("lib-", "")
      : activeDragId.startsWith("chip-")
        ? activeDragId.replace("chip-", "")
        : null;

    return widgetId ? (WIDGET_REGISTRY.get(widgetId) ?? null) : null;
  }, [activeDragId]);

  const activeAssignedSlot = useMemo(() => {
    if (!activeDragDescriptor) return null;
    const assignedCellId = widgetToCellId.get(activeDragDescriptor.id);
    return assignedCellId ? (cellLabelById.get(assignedCellId) ?? null) : null;
  }, [activeDragDescriptor, cellLabelById, widgetToCellId]);

  return (
    <DndContext
      collisionDetection={closestCenter}
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setUiState((current) => ({ ...current, activeDragId: null }))}
    >
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          size={modalSize}
          key={`${projectSlug}:${pageSlug}:${layout.id}`}
          className="flex flex-col gap-0 overflow-hidden p-0"
        >
          <WidgetPlacementHeader
            layout={layout}
            modalSize={modalSize}
            pageName={pageName}
            projectName={projectName}
            setModalSize={(size) => setUiState((current) => ({ ...current, modalSize: size }))}
          />
          <div className="flex min-h-0 flex-1 overflow-hidden">
            <WidgetLibrarySidebar
              cellLabelById={cellLabelById}
              connectedKeys={connectedKeys}
              countServices={countServices}
              filteredWidgets={filteredWidgets}
              groupedWidgets={groupedWidgets}
              searchQuery={searchQuery}
              setSearchQuery={(value) =>
                setUiState((current) => ({ ...current, searchQuery: value }))
              }
              widgetToCellId={widgetToCellId}
            />

            <WidgetPlacementPreview
              assignments={assignments}
              cellLabelById={cellLabelById}
              connectedKeys={connectedKeys}
              layout={layout}
              onRequestRemove={(cellId, widgetName) =>
                setUiState((current) => ({
                  ...current,
                  pendingRemoval: { cellId, widgetName },
                }))
              }
              sortedCells={sortedCells}
            />
          </div>

          <WidgetPlacementDialogs
            executePlace={executePlace}
            handleRemoveFromCell={handleRemoveFromCell}
            layout={layout}
            pendingRemoval={pendingRemoval}
            pendingReplace={pendingReplace}
            projectName={projectName}
            setPendingRemoval={(value) =>
              setUiState((current) => ({ ...current, pendingRemoval: value }))
            }
            setPendingReplace={(value) =>
              setUiState((current) => ({ ...current, pendingReplace: value }))
            }
          />
        </DialogContent>
      </Dialog>

      {typeof document !== "undefined" &&
        createPortal(
          <DragOverlay dropAnimation={null} zIndex={9999}>
            {activeDragDescriptor ? (
              <LibraryWidgetDragPreview
                descriptor={activeDragDescriptor}
                isAssigned={widgetToCellId.has(activeDragDescriptor.id)}
                assignedSlot={activeAssignedSlot}
                connectedServices={countServices(activeDragDescriptor).connected}
                totalServices={countServices(activeDragDescriptor).total}
                connectedKeys={connectedKeys}
                serviceRequirements={getWidgetServiceRequirements(activeDragDescriptor)}
              />
            ) : null}
          </DragOverlay>,
          document.body
        )}
    </DndContext>
  );
}
