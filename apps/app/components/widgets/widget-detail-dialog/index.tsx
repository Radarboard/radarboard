"use client";

import { useCredentials } from "@radarboard/hooks/use-credentials";
import { useDashboard } from "@radarboard/hooks/use-dashboard";
import { Dialog, DialogHeader, DialogTitle } from "@radarboard/ui/app-dialog";
import { ErrorBoundary } from "@radarboard/ui/error-boundary";
import { WidgetModalDialogContent } from "@radarboard/widget-engine/widget-modal";
import type { WidgetDescriptor } from "@radarboard/widget-engine/widgets/registry";
import { WIDGET_REGISTRY } from "@radarboard/widget-engine/widgets/registry";
import { parseAsString, useQueryState } from "nuqs";
import { createElement } from "react";
import { WidgetConfigPanel } from "../widget-config-panel";

// ---------------------------------------------------------------------------
// Widget Detail Dialog
// ---------------------------------------------------------------------------

export function WidgetDetailDialog({
  descriptor,
  open,
  onOpenChange,
  title,
  config,
  onConfigChange,
  onConfigReplace,
  connectedKeys,
  onNavigateToIntegrations,
}: {
  descriptor: WidgetDescriptor;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  config: Record<string, unknown>;
  onConfigChange: (key: string, value: unknown) => void;
  onConfigReplace: (config: Record<string, unknown>) => void;
  connectedKeys: string[];
  onNavigateToIntegrations?: () => void;
}) {
  const handleNavigateToIntegrations = onNavigateToIntegrations
    ? () => {
        onOpenChange(false);
        onNavigateToIntegrations();
      }
    : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <WidgetModalDialogContent
        widgetId={descriptor.id}
        modalId="config"
        className="flex flex-col overflow-hidden p-0"
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>{title ?? descriptor.name}</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1">
          <ErrorBoundary title={descriptor.name}>
            <WidgetConfigPanel
              descriptor={descriptor}
              config={config}
              onConfigChange={onConfigChange}
              onConfigReplace={onConfigReplace}
              connectedKeys={connectedKeys}
              onNavigateToIntegrations={handleNavigateToIntegrations}
            />
          </ErrorBoundary>
        </div>
      </WidgetModalDialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Standalone Widget Config Dialog (driven by ?widget-config=<id> URL param)
// ---------------------------------------------------------------------------

/**
 * Renders a WidgetDetailDialog driven by the `?widget-config` query parameter.
 * Place this at the dashboard level so widget gear icons can open configuration
 * without going through the Settings modal.
 */
export function WidgetConfigFromUrl({
  onNavigateToIntegrations,
}: {
  onNavigateToIntegrations?: () => void;
}) {
  const { activeProjectSlug, projects, widgetConfigs, updateWidgetConfig } = useDashboard();
  const { connectedKeys } = useCredentials();
  const [configWidgetId, setConfigWidgetId] = useQueryState("widget-config", parseAsString);

  const descriptor = configWidgetId ? WIDGET_REGISTRY.get(configWidgetId) : null;

  if (!descriptor) return null;

  const resolvedConfig = {
    ...descriptor.defaultConfig,
    ...(widgetConfigs[descriptor.id] ?? {}),
  } as Record<string, unknown>;
  const displayTitle =
    descriptor.getDisplayName?.({
      projectSlug: activeProjectSlug,
      projects,
      config: resolvedConfig,
    }) ?? descriptor.name;

  return createElement(WidgetDetailDialog, {
    descriptor,
    open: configWidgetId !== null,
    title: displayTitle,
    onOpenChange: (open) => {
      if (!open) setConfigWidgetId(null);
    },
    config: resolvedConfig,
    onConfigReplace: (nextConfig) => {
      updateWidgetConfig(descriptor.id, nextConfig);
    },
    onConfigChange: (key, value) => {
      const current = widgetConfigs[descriptor.id] ?? {};
      updateWidgetConfig(descriptor.id, { ...current, [key]: value });
    },
    connectedKeys,
    onNavigateToIntegrations,
  });
}
