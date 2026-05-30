"use client";

import { LayoutContext } from "@radarboard/plugin-sdk/components/layout-context";
import { getPlugin } from "@radarboard/plugin-sdk/registry";
import type { PluginDescriptor, PresentationMode } from "@radarboard/plugin-sdk/types";
import { pluginHasAlternateMode, resolvePresentationConfig } from "@radarboard/plugin-sdk/types";
import { usePluginAPI } from "@radarboard/plugin-sdk/use-plugin-api";
import type { ModalSize } from "@radarboard/types/ui";
import {
  APP_DIALOG_PANEL_CLASS,
  APP_DIALOG_SIZES,
  APP_DRAWER_PANEL_CLASS,
  DialogSizeToggle,
} from "@radarboard/ui/app-dialog";
import { Button } from "@radarboard/ui/button";
import { ErrorBoundary } from "@radarboard/ui/error-boundary";
import { cn } from "@radarboard/utils/cn";
import { AlertTriangle, Maximize2, PanelRight, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

// ---------------------------------------------------------------------------
// Size system (shared with app dialogs)
// ---------------------------------------------------------------------------

type OverlaySize = ModalSize;

// ---------------------------------------------------------------------------
// Presentation styles
// ---------------------------------------------------------------------------

const PANEL_CLASS: Record<PresentationMode, string> = {
  fullscreen: "flex flex-col",
  "side-panel": "ml-auto h-full flex flex-col",
  modal: "flex flex-col",
  "mini-hud": "fixed bottom-4 right-4 flex flex-col",
};

function getPanelClass(mode: PresentationMode, size: OverlaySize): string {
  const base = PANEL_CLASS[mode];

  if (mode === "fullscreen") {
    return cn(base, size === "lg" ? "m-4 flex-1" : APP_DIALOG_PANEL_CLASS[size]);
  }
  if (mode === "side-panel") {
    return cn(base, APP_DRAWER_PANEL_CLASS[size]);
  }
  if (mode === "modal") {
    return cn(base, APP_DIALOG_PANEL_CLASS[size]);
  }
  return base;
}

function getContainerClass(mode: PresentationMode, size: OverlaySize): string {
  switch (mode) {
    case "fullscreen":
      // L fills the viewport; S/M are centered like a modal
      return size === "lg" ? "flex flex-col" : "flex flex-col items-center justify-center";
    case "side-panel":
      return "flex";
    case "modal":
      return "flex items-center justify-center";
    case "mini-hud":
      return "";
    default:
      return "";
  }
}

/** Map presentation mode to the LayoutContext value. */
function toLayoutMode(mode: PresentationMode): "fullscreen" | "drawer" {
  return mode === "side-panel" ? "drawer" : "fullscreen";
}

// ---------------------------------------------------------------------------
// Size persistence (localStorage per plugin)
// ---------------------------------------------------------------------------

function getSavedSize(
  pluginId: string,
  mode: PresentationMode,
  fallback: OverlaySize
): OverlaySize {
  try {
    const key = `plugin-overlay-size:${pluginId}:${mode}`;
    const saved = localStorage.getItem(key);
    if (saved && APP_DIALOG_SIZES.includes(saved as OverlaySize)) {
      return saved as OverlaySize;
    }
  } catch {
    // SSR or localStorage unavailable
  }
  return fallback;
}

function saveSize(pluginId: string, mode: PresentationMode, size: OverlaySize): void {
  try {
    const key = `plugin-overlay-size:${pluginId}:${mode}`;
    localStorage.setItem(key, size);
  } catch {
    // SSR or localStorage unavailable
  }
}

// ---------------------------------------------------------------------------
// PluginOverlay
// ---------------------------------------------------------------------------

interface PluginOverlayProps {
  activePluginId: string | null;
  disabledPlugins?: Set<string>;
  onClose: () => void;
  /** Active presentation mode override (e.g. from URL query param). */
  pluginMode: PresentationMode | null;
  /** Callback to change the active presentation mode. */
  onPluginModeChange: (mode: PresentationMode) => void;
}

export function PluginOverlay({
  activePluginId,
  disabledPlugins = new Set<string>(),
  onClose,
  pluginMode,
  onPluginModeChange,
}: PluginOverlayProps) {
  const api = usePluginAPI();

  const descriptor = activePluginId ? getPlugin(activePluginId) : null;
  const config = descriptor ? resolvePresentationConfig(descriptor) : null;
  const activeMode = pluginMode ?? config?.default ?? "fullscreen";

  // Size state — persisted per plugin + mode
  const [overlaySize, setOverlaySize] = useState<OverlaySize>(() => {
    if (!activePluginId) return (config?.size as OverlaySize) ?? "lg";
    return getSavedSize(activePluginId, activeMode, (config?.size as OverlaySize) ?? "lg");
  });

  // Reset size when plugin or mode changes
  useEffect(() => {
    if (!activePluginId) return;
    setOverlaySize(getSavedSize(activePluginId, activeMode, (config?.size as OverlaySize) ?? "lg"));
  }, [activePluginId, activeMode, config?.size]);

  const handleSizeChange = useCallback(
    (size: OverlaySize) => {
      setOverlaySize(size);
      if (activePluginId) {
        saveSize(activePluginId, activeMode, size);
      }
    },
    [activePluginId, activeMode]
  );

  // Auto-close if the active plugin gets disabled
  useEffect(() => {
    if (activePluginId && disabledPlugins.has(activePluginId)) {
      onClose();
    }
  }, [activePluginId, disabledPlugins, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!activePluginId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [activePluginId, onClose]);

  // Lock scroll for fullscreen, side-panel, modal
  useEffect(() => {
    if (!activePluginId || !descriptor) return;
    if (activeMode === "mini-hud") return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [activePluginId, activeMode, descriptor]);

  if (!activePluginId || !descriptor || !config) return null;

  const PluginComponent = descriptor.component;

  // Mini-HUD renders without backdrop
  if (activeMode === "mini-hud") {
    return createPortal(
      <div className="fixed right-4 bottom-4 z-overlay overflow-hidden rounded-card border border-border bg-surface shadow-xl">
        <MiniHudHeader name={descriptor.name} onClose={onClose} />
        <ErrorBoundary
          title={descriptor.name}
          resetKeys={[activePluginId]}
          fallback={(error, reset) => (
            <PluginErrorFallback pluginName={descriptor.name} error={error} onRetry={reset} />
          )}
        >
          <PluginComponent api={api} />
        </ErrorBoundary>
      </div>,
      document.body
    );
  }

  const hasAlternates = pluginHasAlternateMode(descriptor);

  const handleToggleMode = () => {
    if (!hasAlternates) return;
    const allModes = [config.default, ...config.alternates];
    const currentIndex = allModes.indexOf(activeMode);
    const nextMode = allModes[(currentIndex + 1) % allModes.length] ?? config.default;
    onPluginModeChange(nextMode);
  };

  return createPortal(
    <div
      className={cn(
        "fade-in fixed inset-0 z-overlay animate-in duration-200",
        getContainerClass(activeMode, overlaySize)
      )}
      role="dialog"
      aria-modal="true"
      aria-label={descriptor.name}
    >
      {/* Backdrop */}
      <Button
        variant="ghost"
        className="absolute inset-0 h-auto w-auto cursor-default rounded-none bg-background/80 p-0 backdrop-blur-sm hover:bg-background/80"
        onClick={onClose}
        aria-label="Close plugin"
        tabIndex={-1}
      />

      {/* Panel */}
      <div
        className={cn(
          "slide-in-from-bottom-2 relative animate-in overflow-hidden border border-border bg-background duration-200",
          getPanelClass(activeMode, overlaySize)
        )}
      >
        <OverlayHeader
          descriptor={descriptor}
          activeMode={activeMode}
          hasAlternates={hasAlternates}
          overlaySize={overlaySize}
          onSizeChange={handleSizeChange}
          onToggleMode={handleToggleMode}
          onClose={onClose}
        />
        <div className="min-h-0 flex-1 overflow-auto">
          <ErrorBoundary
            title={descriptor.name}
            resetKeys={[activePluginId]}
            fallback={(error, reset) => (
              <PluginErrorFallback pluginName={descriptor.name} error={error} onRetry={reset} />
            )}
          >
            <LayoutContext.Provider value={toLayoutMode(activeMode)}>
              <PluginComponent api={api} />
            </LayoutContext.Provider>
          </ErrorBoundary>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ---------------------------------------------------------------------------
// Header components
// ---------------------------------------------------------------------------

function OverlayHeader({
  descriptor,
  activeMode,
  hasAlternates,
  overlaySize,
  onSizeChange,
  onToggleMode,
  onClose,
}: {
  descriptor: PluginDescriptor;
  activeMode: PresentationMode;
  hasAlternates: boolean;
  overlaySize: OverlaySize;
  onSizeChange: (size: OverlaySize) => void;
  onToggleMode: () => void;
  onClose: () => void;
}) {
  const Icon = descriptor.icon;
  return (
    <div className="flex shrink-0 items-center justify-between border-border border-b bg-surface-raised px-4 py-3">
      <div className="flex items-center gap-2">
        <Icon className="icon-base text-dim" />
        <h2 className="font-medium font-mono text-foreground-secondary text-w-base uppercase tracking-widest">
          {descriptor.name}
        </h2>
      </div>
      <div className="flex items-center gap-2">
        {/* Size toggle (S / M / L) */}
        <OverlaySizeToggle size={overlaySize} onSizeChange={onSizeChange} />

        {Boolean(hasAlternates) && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onToggleMode}
            className="h-8 w-8 p-0 text-dim transition-colors hover:text-foreground-secondary"
            aria-label={activeMode === "side-panel" ? "Switch to fullscreen" : "Switch to drawer"}
          >
            {activeMode === "side-panel" ? (
              <Maximize2 className="icon-base" />
            ) : (
              <PanelRight className="icon-base" />
            )}
          </Button>
        )}
        <CloseButton onClose={onClose} />
      </div>
    </div>
  );
}

function OverlaySizeToggle({
  size,
  onSizeChange,
}: {
  size: OverlaySize;
  onSizeChange: (size: OverlaySize) => void;
}) {
  return <DialogSizeToggle size={size} onSizeChange={onSizeChange} ariaLabel="Panel size" />;
}

function MiniHudHeader({ name, onClose }: { name: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between border-border border-b bg-surface-raised px-3 py-2">
      <span className="font-mono text-dim text-w-base uppercase tracking-widest">{name}</span>
      <CloseButton onClose={onClose} />
    </div>
  );
}

function PluginErrorFallback({
  pluginName,
  error,
  onRetry,
}: {
  pluginName: string;
  error: Error;
  onRetry: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <AlertTriangle className="h-6 w-6 text-warning" />
      <p className="font-mono text-foreground-secondary text-w-sm uppercase tracking-widest">
        {pluginName} encountered an error
      </p>
      <p className="max-w-xs font-mono text-dim text-w-sm">{error.message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

function CloseButton({ onClose }: { onClose: () => void }) {
  const handleClick = useCallback(() => onClose(), [onClose]);
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={handleClick}
      className="uppercase-none h-8 w-8 p-0 text-dim transition-colors hover:text-foreground-secondary"
      aria-label="Close plugin"
    >
      <X className="icon-base" />
    </Button>
  );
}
