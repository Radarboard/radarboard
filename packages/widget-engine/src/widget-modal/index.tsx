"use client";

import { DashboardContext } from "@radarboard/hooks/use-dashboard";
import type { WidgetModalSize } from "@radarboard/types/database";
import { APP_DIALOG_SIZES, DialogContent, DialogSizeToggle } from "@radarboard/ui/app-dialog";
import { cn } from "@radarboard/utils/cn";
import type { ComponentPropsWithoutRef } from "react";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

export const WIDGET_MODAL_SIZES: WidgetModalSize[] = [...APP_DIALOG_SIZES];
export const DEFAULT_WIDGET_MODAL_SIZE: WidgetModalSize = "md";

export const WIDGET_DIALOG_SIZE_CLASS: Record<WidgetModalSize, string> = {
  sm: "",
  md: "",
  lg: "",
};

export const WIDGET_EXPANDED_PANEL_CLASS: Record<WidgetModalSize, string> = {
  lg: "rb-dialog-size-lg flex flex-1 flex-col",
  md: "rb-dialog-size-md flex flex-col",
  sm: "rb-dialog-size-sm flex flex-col",
};

export const WIDGET_EXPANDED_CONTAINER_CLASS: Record<WidgetModalSize, string> = {
  lg: "flex flex-col",
  md: "flex items-center justify-center",
  sm: "flex items-center justify-center",
};

export const WIDGET_MODAL_RESIZABLE_CLASS =
  "resize min-w-[720px] min-h-[520px] max-w-[95vw] max-h-[95vh]";

const WidgetModalSizeContext = createContext<WidgetModalSize | null>(null);

export function getLegacyExpandedSizeStorageKey(widgetId: string): string {
  return `radarboard:expanded-size:${widgetId}`;
}

function isWidgetModalSize(value: string): value is WidgetModalSize {
  return WIDGET_MODAL_SIZES.includes(value as WidgetModalSize);
}

function readLegacyWidgetModalSize(storageKey?: string | null): WidgetModalSize | null {
  if (!storageKey || typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(storageKey);
    return raw && isWidgetModalSize(raw) ? raw : null;
  } catch {
    return null;
  }
}

interface UseWidgetModalSizeOptions {
  widgetId?: string | null;
  modalId: string;
  defaultSize: WidgetModalSize;
  legacyStorageKey?: string | null;
}

export function useWidgetModalSize({
  widgetId,
  modalId,
  defaultSize,
  legacyStorageKey,
}: UseWidgetModalSizeOptions) {
  const dashboard = useContext(DashboardContext);
  const persistedSize =
    widgetId && dashboard ? dashboard.modalPrefs[widgetId]?.[modalId] : undefined;
  const legacySize =
    widgetId && dashboard && !persistedSize ? readLegacyWidgetModalSize(legacyStorageKey) : null;
  const [localSize, setLocalSize] = useState<WidgetModalSize>(defaultSize);

  useEffect(() => {
    if (widgetId && dashboard) return;
    setLocalSize(defaultSize);
  }, [dashboard, defaultSize, widgetId]);

  useEffect(() => {
    if (
      !widgetId ||
      !dashboard ||
      persistedSize ||
      !legacyStorageKey ||
      typeof window === "undefined"
    ) {
      return;
    }

    const raw = window.localStorage.getItem(legacyStorageKey);
    if (!raw) return;

    if (isWidgetModalSize(raw)) {
      dashboard.updateWidgetModalSize(widgetId, modalId, raw);
    }

    window.localStorage.removeItem(legacyStorageKey);
  }, [dashboard, legacyStorageKey, modalId, persistedSize, widgetId]);

  const size =
    widgetId && dashboard
      ? (persistedSize ??
        legacySize ??
        dashboard.getWidgetModalSize(widgetId, modalId, defaultSize))
      : localSize;

  const setSize = useCallback(
    (nextSize: WidgetModalSize) => {
      if (widgetId && dashboard) {
        dashboard.updateWidgetModalSize(widgetId, modalId, nextSize);
        return;
      }

      setLocalSize(nextSize);
    },
    [dashboard, modalId, widgetId]
  );

  return { size, setSize };
}

export function WidgetModalSizeToggle({
  size,
  onSizeChange,
  className,
}: {
  size: WidgetModalSize;
  onSizeChange: (size: WidgetModalSize) => void;
  className?: string;
}) {
  return (
    <DialogSizeToggle
      size={size}
      onSizeChange={onSizeChange}
      className={cn("", className)}
      ariaLabel="Panel size"
    />
  );
}

export function useCurrentWidgetModalSize(
  fallback: WidgetModalSize = DEFAULT_WIDGET_MODAL_SIZE
): WidgetModalSize {
  return useContext(WidgetModalSizeContext) ?? fallback;
}

interface WidgetModalDialogContentProps
  extends Omit<ComponentPropsWithoutRef<typeof DialogContent>, "size"> {
  widgetId?: string | null;
  modalId: string;
  defaultSize?: WidgetModalSize;
  resizable?: boolean;
  legacyStorageKey?: string | null;
  showSizeToggle?: boolean;
}

export function WidgetModalDialogContent({
  widgetId,
  modalId,
  defaultSize = DEFAULT_WIDGET_MODAL_SIZE,
  resizable = false,
  legacyStorageKey,
  showSizeToggle = true,
  className,
  children,
  style,
  "aria-describedby": ariaDescribedBy,
  ...props
}: WidgetModalDialogContentProps) {
  const { size, setSize } = useWidgetModalSize({
    widgetId,
    modalId,
    defaultSize,
    legacyStorageKey,
  });

  return (
    <WidgetModalSizeContext value={size}>
      <DialogContent
        aria-describedby={ariaDescribedBy ?? undefined}
        key={resizable ? `${widgetId ?? "detached"}:${modalId}:${size}` : undefined}
        size={size}
        className={cn(
          "flex flex-col",
          WIDGET_DIALOG_SIZE_CLASS[size],
          resizable && WIDGET_MODAL_RESIZABLE_CLASS,
          className
        )}
        style={style}
        {...props}
      >
        {showSizeToggle && widgetId ? (
          <div className="absolute top-2 right-10 z-20 flex items-center gap-1">
            <WidgetModalSizeToggle size={size} onSizeChange={setSize} />
          </div>
        ) : null}
        {children}
      </DialogContent>
    </WidgetModalSizeContext>
  );
}
