"use client";

import { useDashboard } from "@radarboard/hooks/use-dashboard";
import type { TimeRange } from "@radarboard/types/dashboard";
import type { FontScale } from "@radarboard/types/database";
import {
  formatPollingInterval,
  getEffectivePollingInterval,
  getPollingSourceDefinition,
  type PollingSourceId,
} from "@radarboard/types/polling";
import { Button } from "@radarboard/ui/button";
import { ErrorBoundary } from "@radarboard/ui/error-boundary";
import { Label } from "@radarboard/ui/label";
import { Switch } from "@radarboard/ui/switch";
import { Textarea } from "@radarboard/ui/textarea";
import { cn } from "@radarboard/utils/cn";
import {
  getDefaultMaxItems,
  hasMaxItemsSections,
  type WidgetTemplateConfig,
} from "@radarboard/widget-engine/templates";
import { WIDGET_REGISTRY, type WidgetDescriptor } from "@radarboard/widget-engine/widgets/registry";
import {
  collectProjectLinkedRepoSelections,
  resolveWidgetGitHubRepoSelections,
  StarsRepositoriesSection,
} from "@radarboard/widget-github-stars/config";
import {
  createCustomVariant,
  DEFAULT_VARIANT_ID,
  getActiveVariantId,
  getAvailableVariants,
  getVariantConfig,
  isBuiltInVariant,
  resolveVariantConfig,
} from "@radarboard/widget-sdk/variant-utils";
import type { CustomVariant } from "@radarboard/widget-sdk/widget-types";
import { BookOpen, Copy, Plus, X } from "lucide-react";
import { createElement, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { RemoteServiceIcon } from "@/components/shared/remote-service-icon";
import { useSettings } from "@/hooks/settings/use-settings";
import { getServiceFaviconUrl } from "@/lib/service-favicons";
import {
  finalizePackagePatternDraft,
  parsePackagePatterns,
  resolvePackagePatternDraft,
} from "../package-patterns";
import { WidgetVisualEditor } from "../widget-visual-editor";

const MAX_ITEMS_OPTIONS: { value: number | undefined; label: string }[] = [
  { value: 5, label: "5" },
  { value: 10, label: "10" },
  { value: 25, label: "25" },
  { value: 50, label: "50" },
  { value: undefined, label: "All" },
];

const FONT_SCALE_OPTIONS: { value: FontScale | "global"; label: string }[] = [
  { value: "sm", label: "Small" },
  { value: "md", label: "Default" },
  { value: "lg", label: "Large" },
  { value: "global", label: "Global" },
];

/** Default when "Custom time range" is turned on (matches common dashboard default). */
const DEFAULT_WIDGET_CUSTOM_TIME_RANGE: TimeRange = "7d";

const WIDGET_TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: "today", label: "TODAY" },
  { value: "7d", label: "7D" },
  { value: "15d", label: "15D" },
  { value: "30d", label: "30D" },
  { value: "3m", label: "90D" },
  { value: "1y", label: "1Y" },
  { value: "all", label: "ALL" },
];

/** Extract the auth array from a widget descriptor. */
export function getAuthList(descriptor: WidgetDescriptor) {
  if (!descriptor.auth) return [];
  return Array.isArray(descriptor.auth) ? descriptor.auth : [descriptor.auth];
}

function ServiceRow({
  service,
  connectedKeys,
  disabledServices,
  onToggle,
}: {
  service: { id?: string; name?: string; type: string };
  connectedKeys: string[];
  disabledServices: string[];
  onToggle: (credKey: string, enabled: boolean) => void;
}) {
  const credKey = service.id ?? "";
  const isConnected = connectedKeys.includes(credKey);
  const isEnabled = !disabledServices.includes(credKey);
  const faviconUrl = getServiceFaviconUrl(credKey, 32);

  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-item border p-3 transition-colors",
        isEnabled && isConnected
          ? "border-border bg-surface-raised"
          : "border-border bg-surface opacity-60"
      )}
    >
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          {faviconUrl ? (
            <RemoteServiceIcon
              src={faviconUrl}
              alt=""
              size={20}
              className={cn(
                "rounded-item",
                !isConnected && "opacity-40 grayscale",
                !isEnabled && "opacity-30"
              )}
            />
          ) : (
            <span className="icon-base inline-block rounded-item bg-muted" />
          )}
          <span
            className={cn(
              "absolute -right-0.5 -bottom-0.5 h-2 w-2 rounded-full border-2 border-surface-raised",
              (() => {
                if (isConnected) return isEnabled ? "bg-success" : "bg-warning";
                return "bg-dim";
              })()
            )}
          />
        </div>
        <div>
          <div className="font-mono text-foreground-secondary text-xs">
            {service.name ?? credKey}
          </div>
          <div className={cn("font-mono text-w-sm", isConnected ? "text-success" : "text-dim")}>
            {isConnected ? "Connected" : "Not connected"}
          </div>
        </div>
      </div>
      <Switch
        checked={isEnabled}
        onCheckedChange={(checked) => onToggle(credKey, checked)}
        disabled={!isConnected}
        aria-label={`${isEnabled ? "Disable" : "Enable"} ${service.name ?? credKey}`}
      />
    </div>
  );
}

function resolveWidgetPollingSourceIds(
  descriptor: WidgetDescriptor,
  context: {
    projectSlug: string | null;
    projects: ReturnType<typeof useDashboard>["projects"];
    config: Record<string, unknown>;
  }
): PollingSourceId[] {
  const polling = descriptor.polling;
  if (!polling) return [];
  if (polling.getSourceIds) return polling.getSourceIds(context);
  return polling.sourceIds ?? [];
}

function MaxItemsControl({
  visible,
  currentMaxItems,
  cap,
  onConfigChange,
}: {
  visible: boolean;
  currentMaxItems: number | undefined;
  cap: number | undefined;
  onConfigChange: (key: string, value: unknown) => void;
}) {
  if (!visible) return null;
  const options = cap
    ? MAX_ITEMS_OPTIONS.filter((opt) => opt.value === undefined || opt.value <= cap)
    : MAX_ITEMS_OPTIONS;
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="font-mono text-foreground-secondary text-w-sm">Max items</div>
        <div className="mt-0.5 font-mono text-dim text-w-sm">Limit items shown in lists</div>
      </div>
      <div className="flex items-center gap-0.5 rounded-item border border-border bg-surface p-0.5">
        {options.map((opt) => {
          const isActive =
            opt.value === undefined ? currentMaxItems == null : currentMaxItems === opt.value;
          return (
            <Button
              key={opt.label}
              type="button"
              variant="ghost"
              onClick={() => onConfigChange("maxItems", opt.value)}
              className={cn(
                "h-auto rounded-item px-2 py-1 font-mono font-normal text-w-sm uppercase tracking-wider transition-colors",
                isActive
                  ? "bg-secondary text-foreground"
                  : "text-dim hover:bg-muted hover:text-foreground-secondary"
              )}
            >
              {opt.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

function CustomTimeRangeControl({
  visible,
  currentRange,
  onRangeChange,
}: {
  visible: boolean;
  currentRange: TimeRange;
  onRangeChange: (value: TimeRange) => void;
}) {
  if (!visible) return null;
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="font-mono text-foreground-secondary text-w-sm">Widget period</div>
        <div className="mt-0.5 font-mono text-dim text-w-sm">
          Same presets as the dashboard time range
        </div>
      </div>
      <div className="flex items-center gap-0.5 rounded-item border border-border bg-surface p-0.5">
        {WIDGET_TIME_RANGE_OPTIONS.map((opt) => {
          const isActive = currentRange === opt.value;
          return (
            <Button
              key={opt.value}
              type="button"
              variant="ghost"
              onClick={() => onRangeChange(opt.value)}
              className={cn(
                "h-auto rounded-item px-2 py-1 font-mono font-normal text-w-sm uppercase tracking-wider transition-colors",
                isActive
                  ? "bg-secondary text-foreground"
                  : "text-dim hover:bg-muted hover:text-foreground-secondary"
              )}
            >
              {opt.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

function PollingIntervalsSection({
  descriptor,
  pollingSourceIds,
  preferences,
  updatePollingInterval,
}: {
  descriptor: WidgetDescriptor;
  pollingSourceIds: PollingSourceId[];
  preferences: ReturnType<typeof useDashboard>["preferences"];
  updatePollingInterval: (sourceId: PollingSourceId, intervalMs: number) => void;
}) {
  if (pollingSourceIds.length === 0) return null;

  return (
    <div>
      <div className="mb-3 font-mono text-muted-foreground text-w-sm uppercase tracking-wider">
        Refresh
      </div>
      <div className="space-y-3 rounded-item border border-border bg-surface-raised p-3">
        {pollingSourceIds.map((sourceId) => {
          const source = getPollingSourceDefinition(sourceId);
          if (!source) return null;
          const effectiveInterval = getEffectivePollingInterval(sourceId, preferences.polling);
          const relatedWidgetNames = source.widgetIds
            .filter((widgetId) => widgetId !== descriptor.id)
            .map((widgetId) => WIDGET_REGISTRY.get(widgetId)?.name ?? widgetId);

          return (
            <div key={sourceId} className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-mono text-foreground-secondary text-w-sm">
                    {source.label}
                  </div>
                  <div className="mt-1 font-mono text-dim text-w-sm">
                    Current interval: {formatPollingInterval(effectiveInterval)}
                  </div>
                </div>
                {relatedWidgetNames.length > 0 ? (
                  <div className="max-w-[220px] text-right font-mono text-dim text-w-sm">
                    Shared with {relatedWidgetNames.join(", ")}
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {source.allowedIntervalsMs.map((intervalMs) => {
                  const isActive = intervalMs === effectiveInterval;
                  return (
                    <Button
                      key={intervalMs}
                      type="button"
                      variant={isActive ? "default" : "outline"}
                      onClick={() => updatePollingInterval(sourceId, intervalMs)}
                      className={cn(
                        "h-auto px-3 py-1.5 font-mono text-w-sm uppercase tracking-widest transition-colors",
                        isActive
                          ? "border-accent/30 bg-accent/20 text-accent"
                          : "border-border text-dim hover:text-foreground-secondary"
                      )}
                    >
                      {formatPollingInterval(intervalMs)}
                    </Button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function VisualEditorPane({
  config,
  descriptor,
  includePackagesDraft,
  excludePackagesDraft,
  onConfigReplace,
}: {
  config: Record<string, unknown>;
  descriptor: WidgetDescriptor;
  includePackagesDraft: string;
  excludePackagesDraft: string;
  onConfigReplace: (config: Record<string, unknown>) => void;
}) {
  const activeVId = getActiveVariantId(descriptor, config);
  const isBuiltInActive = activeVId ? isBuiltInVariant(descriptor, activeVId) : true;
  const hasVariants = (descriptor.variants?.length ?? 0) > 0;

  const variantAwareConfigReplace =
    hasVariants && activeVId && !isBuiltInActive
      ? (nextConfig: Record<string, unknown>) => {
          const customVariants = ((config.customVariants ?? []) as CustomVariant[]).map(
            (variant) => (variant.id === activeVId ? { ...variant, config: nextConfig } : variant)
          );
          onConfigReplace({ ...config, customVariants });
        }
      : onConfigReplace;

  return (
    <div className="scrollbar-thin min-h-0 overflow-y-auto p-5">
      {hasVariants && isBuiltInActive ? (
        <div className="flex h-full flex-col items-center justify-center gap-3 py-12 text-center">
          <p className="font-mono text-dim text-w-sm">
            Built-in layouts cannot be edited directly.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const activeConfig = resolveVariantConfig(descriptor, config) as Record<
                string,
                unknown
              >;
              const activeVariant = descriptor.variants?.find(
                (variant) => variant.id === activeVId
              );
              const newVariant = createCustomVariant(
                `${activeVariant?.name ?? "Custom"} (copy)`,
                activeConfig
              );
              const existing = (config.customVariants ?? []) as CustomVariant[];
              onConfigReplace({
                ...config,
                activeVariant: newVariant.id,
                customVariants: [...existing, newVariant],
              });
            }}
            className="font-mono"
          >
            <Copy className="icon-xs mr-1.5" />
            Duplicate to customize
          </Button>
        </div>
      ) : (
        <ErrorBoundary title="Visual Editor">
          <WidgetVisualEditor
            descriptor={descriptor}
            config={config}
            onConfigReplace={variantAwareConfigReplace}
            previewOverrides={
              descriptor.id === "npm-downloads"
                ? {
                    includePackages: parsePackagePatterns(includePackagesDraft),
                    excludePackages: parsePackagePatterns(excludePackagesDraft),
                  }
                : undefined
            }
          />
        </ErrorBoundary>
      )}
    </div>
  );
}

function NpmPackageFiltersSection({
  excludePackagesDraft,
  finishPackageDraft,
  includePackagesDraft,
  onConfigChange,
  setExcludePackagesDraft,
  setIncludePackagesDraft,
  setIsEditingExcludePackages,
  setIsEditingIncludePackages,
}: {
  excludePackagesDraft: string;
  finishPackageDraft: ReturnType<typeof useWidgetConfigPanelState>["finishPackageDraft"];
  includePackagesDraft: string;
  onConfigChange: (key: string, value: unknown) => void;
  setExcludePackagesDraft: React.Dispatch<React.SetStateAction<string>>;
  setIncludePackagesDraft: React.Dispatch<React.SetStateAction<string>>;
  setIsEditingExcludePackages: React.Dispatch<React.SetStateAction<boolean>>;
  setIsEditingIncludePackages: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  return (
    <div>
      <div className="mb-3 font-mono text-muted-foreground text-w-sm uppercase tracking-wider">
        Package Filters
      </div>
      <div className="space-y-4 rounded-item border border-border bg-surface-raised p-3">
        <div className="space-y-1">
          <Label htmlFor="npm-include-packages">Include Packages</Label>
          <Textarea
            id="npm-include-packages"
            value={includePackagesDraft}
            onFocus={() => setIsEditingIncludePackages(true)}
            onChange={(event) => {
              const nextValue = event.target.value;
              setIncludePackagesDraft(nextValue);
              onConfigChange("includePackages", parsePackagePatterns(nextValue));
            }}
            onBlur={(event) =>
              finishPackageDraft(
                "includePackages",
                event.target.value,
                setIncludePackagesDraft,
                setIsEditingIncludePackages
              )
            }
            placeholder={"package-one\npackage-two"}
            className="min-h-[84px] bg-surface"
          />
          <p className="text-dim/60 text-w-sm">
            Optional. Enter exact package names, one per line or comma-separated.
          </p>
        </div>

        <div className="space-y-1">
          <Label htmlFor="npm-exclude-packages">Exclude Packages</Label>
          <Textarea
            id="npm-exclude-packages"
            value={excludePackagesDraft}
            onFocus={() => setIsEditingExcludePackages(true)}
            onChange={(event) => {
              const nextValue = event.target.value;
              setExcludePackagesDraft(nextValue);
              onConfigChange("excludePackages", parsePackagePatterns(nextValue));
            }}
            onBlur={(event) =>
              finishPackageDraft(
                "excludePackages",
                event.target.value,
                setExcludePackagesDraft,
                setIsEditingExcludePackages
              )
            }
            placeholder={"package-to-hide"}
            className="min-h-[84px] bg-surface"
          />
          <p className="text-dim/60 text-w-sm">
            Exact package names only. Exclusions always win over inclusions.
          </p>
        </div>
      </div>
    </div>
  );
}

function ServiceIntegrationsSection({
  connectableServices,
  connectedKeys,
  descriptor,
  disabledServices,
  hasMultipleServices,
  onNavigateToIntegrations,
  toggleService,
}: {
  connectableServices: ReturnType<typeof useWidgetConfigPanelState>["connectableServices"];
  connectedKeys: string[];
  descriptor: WidgetDescriptor;
  disabledServices: string[];
  hasMultipleServices: boolean;
  onNavigateToIntegrations?: () => void;
  toggleService: ReturnType<typeof useWidgetConfigPanelState>["toggleService"];
}) {
  if (connectableServices.length === 0) return null;

  return (
    <div>
      <div className="mb-3 font-mono text-muted-foreground text-w-sm uppercase tracking-wider">
        Integrations
      </div>
      {hasMultipleServices ? (
        <p className="mb-3 text-muted-foreground text-w-sm">
          Toggle which data sources are active for this widget.
        </p>
      ) : null}
      <div className="space-y-2">
        {connectableServices.map((service) => (
          <ServiceRow
            key={service.id ?? descriptor.id}
            service={service}
            connectedKeys={connectedKeys}
            disabledServices={disabledServices}
            onToggle={toggleService}
          />
        ))}
      </div>
      {onNavigateToIntegrations ? (
        <Button
          type="button"
          variant="ghost-link"
          onClick={onNavigateToIntegrations}
          uppercase={false}
          className="mt-3 font-normal text-accent hover:text-accent/80"
        >
          Manage connections in Integrations
        </Button>
      ) : null}
    </div>
  );
}

function useWidgetConfigPanelState(
  descriptor: WidgetDescriptor,
  config: Record<string, unknown>,
  onConfigChange: (key: string, value: unknown) => void
) {
  const { activeProjectSlug, preferences, projects, updatePreferences } = useDashboard();
  const { projectIntegrations } = useSettings();
  const authList = getAuthList(descriptor);
  const connectableServices = authList.filter((a) => a.type !== "none" && a.id);
  const disabledServices = (config.disabledServices as string[]) ?? [];
  const visualEditorBinding = descriptor.visualEditor;
  const visualEditorConfig =
    visualEditorBinding?.kind === "template"
      ? visualEditorBinding.getConfig({ projectSlug: activeProjectSlug, projects, config })
      : null;
  const hasVisualEditor = visualEditorConfig !== null;
  const hasListSections = visualEditorConfig
    ? hasMaxItemsSections(visualEditorConfig as WidgetTemplateConfig)
    : false;
  const displayDescription =
    descriptor.getDisplayDescription?.({ projectSlug: activeProjectSlug, projects, config }) ??
    descriptor.description;
  const pollingSourceIds = resolveWidgetPollingSourceIds(descriptor, {
    projectSlug: activeProjectSlug,
    projects,
    config,
  });

  const [includePackagesDraft, setIncludePackagesDraft] = useState(() =>
    resolvePackagePatternDraft(config.includePackages, "", false)
  );
  const [excludePackagesDraft, setExcludePackagesDraft] = useState(() =>
    resolvePackagePatternDraft(config.excludePackages, "", false)
  );
  const [isEditingIncludePackages, setIsEditingIncludePackages] = useState(false);
  const [isEditingExcludePackages, setIsEditingExcludePackages] = useState(false);
  const selectedRepos = resolveWidgetGitHubRepoSelections(config.selectedRepos);
  const projectLinkedRepos = collectProjectLinkedRepoSelections(projects, projectIntegrations);

  useEffect(() => {
    setIncludePackagesDraft((current) =>
      resolvePackagePatternDraft(config.includePackages, current, isEditingIncludePackages)
    );
  }, [config.includePackages, isEditingIncludePackages]);

  useEffect(() => {
    setExcludePackagesDraft((current) =>
      resolvePackagePatternDraft(config.excludePackages, current, isEditingExcludePackages)
    );
  }, [config.excludePackages, isEditingExcludePackages]);

  function toggleService(serviceId: string, enabled: boolean) {
    const current = (config.disabledServices as string[]) ?? [];
    const next = enabled ? current.filter((id) => id !== serviceId) : [...current, serviceId];
    onConfigChange("disabledServices", next);
  }

  function updatePollingInterval(sourceId: PollingSourceId, intervalMs: number) {
    const source = getPollingSourceDefinition(sourceId);
    if (!source) return;
    const nextPolling = { ...(preferences.polling ?? {}) };
    if (intervalMs === source.defaultIntervalMs) {
      delete nextPolling[sourceId];
    } else {
      nextPolling[sourceId] = intervalMs;
    }
    updatePreferences({ polling: nextPolling });
  }

  function finishPackageDraft(
    key: "includePackages" | "excludePackages",
    value: string,
    setDraft: (value: string) => void,
    setEditing: (value: boolean) => void
  ) {
    const { draft, patterns } = finalizePackagePatternDraft(value);
    onConfigChange(key, patterns);
    setDraft(draft);
    setEditing(false);
  }

  return {
    activeProjectSlug,
    preferences,
    projects,
    connectableServices,
    hasMultipleServices: connectableServices.length > 1,
    disabledServices,
    visualEditorConfig,
    hasVisualEditor,
    hasListSections,
    displayDescription,
    pollingSourceIds,
    includePackagesDraft,
    setIncludePackagesDraft,
    excludePackagesDraft,
    setExcludePackagesDraft,
    isEditingIncludePackages,
    setIsEditingIncludePackages,
    isEditingExcludePackages,
    setIsEditingExcludePackages,
    selectedRepos,
    projectLinkedRepos,
    toggleService,
    updatePollingInterval,
    finishPackageDraft,
  };
}

const THUMBNAIL_SCALE = 0.22;
const THUMBNAIL_W = 140;
const THUMBNAIL_H = 90;
const HOVER_SCALE = 0.55;
const HOVER_W = 360;
const HOVER_H = 230;

function VariantWidgetRenderer({
  descriptor,
  variantConfig,
  projectSlug,
  scale,
}: {
  descriptor: WidgetDescriptor;
  variantConfig: Record<string, unknown>;
  projectSlug: string | null;
  scale: number;
}) {
  return (
    <div
      className="pointer-events-none origin-top-left overflow-hidden"
      style={{
        width: `${100 / scale}%`,
        height: `${100 / scale}%`,
        transform: `scale(${scale})`,
      }}
    >
      <ErrorBoundary title="">
        {createElement(descriptor.component, {
          widgetId: descriptor.id,
          projectSlug,
          config: variantConfig,
        })}
      </ErrorBoundary>
    </div>
  );
}

function VariantThumbnail({
  descriptor,
  variantConfig,
  projectSlug,
}: {
  descriptor: WidgetDescriptor;
  variantConfig: Record<string, unknown>;
  projectSlug: string | null;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties | null>(null);

  const showPopup = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const left = rect.left + rect.width / 2 - HOVER_W / 2;
    const clampedLeft = Math.max(8, Math.min(left, window.innerWidth - HOVER_W - 8));
    const fitsAbove = rect.top - HOVER_H - 8 > 0;
    setPopupStyle({
      position: "fixed",
      top: fitsAbove ? rect.top - HOVER_H - 8 : rect.bottom + 8,
      left: clampedLeft,
      width: HOVER_W,
      height: HOVER_H,
    });
  }, []);

  return (
    <Button
      ref={ref}
      type="button"
      variant="ghost"
      uppercase={false}
      className="relative h-auto overflow-hidden rounded bg-background p-0 hover:bg-background"
      style={{ width: THUMBNAIL_W, height: THUMBNAIL_H }}
      aria-label="Preview widget configuration"
      onMouseEnter={showPopup}
      onFocus={showPopup}
      onMouseLeave={() => setPopupStyle(null)}
      onBlur={() => setPopupStyle(null)}
    >
      <VariantWidgetRenderer
        descriptor={descriptor}
        variantConfig={variantConfig}
        projectSlug={projectSlug}
        scale={THUMBNAIL_SCALE}
      />
      {popupStyle &&
        createPortal(
          <div
            className="fade-in-0 zoom-in-95 pointer-events-none z-[9999] animate-in overflow-hidden rounded-lg border border-border bg-background shadow-xl duration-150"
            style={popupStyle}
          >
            <VariantWidgetRenderer
              descriptor={descriptor}
              variantConfig={variantConfig}
              projectSlug={projectSlug}
              scale={HOVER_SCALE}
            />
          </div>,
          document.body
        )}
    </Button>
  );
}

function VariantPicker({
  descriptor,
  config,
  onConfigChange,
  onConfigReplace,
}: {
  descriptor: WidgetDescriptor;
  config: Record<string, unknown>;
  onConfigChange: (key: string, value: unknown) => void;
  onConfigReplace: (config: Record<string, unknown>) => void;
}) {
  const { activeProjectSlug } = useDashboard();
  const variants = getAvailableVariants(descriptor, config);
  const activeId = getActiveVariantId(descriptor, config);

  const handleDuplicate = () => {
    const activeConfig = resolveVariantConfig(descriptor, config) as Record<string, unknown>;
    const activeVariant = variants.find((v) => v.id === activeId);
    const newVariant = createCustomVariant(
      `${activeVariant?.name ?? "Custom"} (copy)`,
      activeConfig
    );
    const existing = (config.customVariants ?? []) as CustomVariant[];
    onConfigReplace({
      ...config,
      activeVariant: newVariant.id,
      customVariants: [...existing, newVariant],
    });
  };

  const handleDelete = (variantId: string) => {
    const existing = (config.customVariants ?? []) as CustomVariant[];
    const updated = existing.filter((v) => v.id !== variantId);
    const nextActive = activeId === variantId ? DEFAULT_VARIANT_ID : activeId;
    onConfigReplace({
      ...config,
      activeVariant: nextActive,
      customVariants: updated.length > 0 ? updated : undefined,
    });
  };

  return (
    <div className="rounded-item border border-border bg-surface-raised p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-muted-foreground text-w-sm">Layout</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {variants.map((variant) => {
          const isActive = activeId === variant.id;
          const variantConfig = getVariantConfig(descriptor, config, variant.id) as Record<
            string,
            unknown
          > | null;
          return (
            <Button
              key={variant.id}
              type="button"
              onClick={() => onConfigChange("activeVariant", variant.id)}
              variant="outline"
              uppercase={false}
              className={cn(
                "group relative h-auto flex-col items-center gap-1.5 p-1.5",
                isActive ? "border-accent bg-accent/5" : "hover:border-foreground/20"
              )}
            >
              {variantConfig && (
                <VariantThumbnail
                  descriptor={descriptor}
                  variantConfig={variantConfig}
                  projectSlug={activeProjectSlug}
                />
              )}
              <span
                className={cn("font-mono text-w-sm", isActive ? "text-foreground" : "text-dim")}
              >
                {variant.name}
              </span>
              {!variant.isBuiltIn && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(variant.id);
                  }}
                  className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full border border-border bg-surface p-0 text-dim opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                  aria-label={`Delete ${variant.name}`}
                >
                  <X className="h-2.5 w-2.5" />
                </Button>
              )}
            </Button>
          );
        })}
        <Button
          type="button"
          onClick={handleDuplicate}
          variant="outline"
          uppercase={false}
          className="h-auto flex-col items-center justify-center gap-1.5 border-dashed p-1.5 hover:border-foreground/20 hover:bg-surface-raised"
          style={{ width: THUMBNAIL_W + 12, minHeight: THUMBNAIL_H + 30 }}
        >
          <div
            className="flex items-center justify-center rounded bg-surface"
            style={{ width: THUMBNAIL_W, height: THUMBNAIL_H }}
          >
            <Plus className="h-5 w-5 text-dim" />
          </div>
          <span className="font-mono text-dim text-w-sm">Custom</span>
        </Button>
      </div>
    </div>
  );
}

export function WidgetConfigPanel({
  descriptor,
  config,
  onConfigChange,
  onConfigReplace,
  connectedKeys,
  onNavigateToIntegrations,
}: {
  descriptor: WidgetDescriptor;
  config: Record<string, unknown>;
  onConfigChange: (key: string, value: unknown) => void;
  onConfigReplace: (config: Record<string, unknown>) => void;
  connectedKeys: string[];
  onNavigateToIntegrations?: () => void;
}) {
  const state = useWidgetConfigPanelState(descriptor, config, onConfigChange);
  const {
    connectableServices,
    hasMultipleServices,
    disabledServices,
    visualEditorConfig,
    hasVisualEditor,
    hasListSections,
    displayDescription,
    pollingSourceIds,
    includePackagesDraft,
    setIncludePackagesDraft,
    excludePackagesDraft,
    setExcludePackagesDraft,
    setIsEditingIncludePackages,
    setIsEditingExcludePackages,
    selectedRepos,
    projectLinkedRepos,
    toggleService,
    updatePollingInterval,
    finishPackageDraft,
    preferences,
  } = state;

  return (
    <div
      className={cn(
        "h-full min-h-0",
        hasVisualEditor && "lg:grid lg:grid-cols-[340px_minmax(0,1fr)]"
      )}
    >
      <div
        className={cn(
          "min-h-0 space-y-5 p-5",
          hasVisualEditor
            ? "scrollbar-thin overflow-y-auto border-border border-b lg:border-r lg:border-b-0"
            : "scrollbar-thin overflow-y-auto"
        )}
      >
        <div>
          <p className="mb-2 text-muted-foreground text-xs">{displayDescription}</p>
          <Button
            asChild
            variant="ghost-link"
            size="sm"
            uppercase={false}
            className="font-normal text-accent hover:text-accent/80"
          >
            <a href={`/docs/widgets/${descriptor.id}`} target="_blank" rel="noopener noreferrer">
              <BookOpen className="icon-xs mr-1.5" />
              View documentation
            </a>
          </Button>
        </div>

        <div>
          <div className="mb-3 font-mono text-muted-foreground text-w-sm uppercase tracking-wider">
            Appearance
          </div>
          <div className="space-y-2">
            <VariantPicker
              descriptor={descriptor}
              config={config}
              onConfigChange={onConfigChange}
              onConfigReplace={onConfigReplace}
            />
            <div className="flex items-center justify-between rounded-item border border-border bg-surface-raised px-3 py-2">
              <span className="font-mono text-muted-foreground text-w-sm">Font size</span>
              <div className="flex items-center gap-0.5 rounded-item border border-border bg-surface p-0.5">
                {FONT_SCALE_OPTIONS.map((opt) => {
                  const currentScale = config.fontScale as FontScale | undefined;
                  const isActive =
                    opt.value === "global" ? !currentScale : currentScale === opt.value;
                  return (
                    <Button
                      key={opt.value}
                      type="button"
                      variant="ghost"
                      onClick={() =>
                        onConfigChange("fontScale", opt.value === "global" ? undefined : opt.value)
                      }
                      className={cn(
                        "h-auto rounded-item px-2 py-1 font-mono font-normal text-w-sm uppercase tracking-wider transition-colors",
                        isActive
                          ? "bg-secondary text-foreground"
                          : "text-dim hover:bg-muted hover:text-foreground-secondary"
                      )}
                    >
                      {opt.label}
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="mb-3 font-mono text-muted-foreground text-w-sm uppercase tracking-wider">
            Data
          </div>
          <div className="space-y-3 rounded-item border border-border bg-surface-raised p-3">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-mono text-foreground-secondary text-w-sm">
                    Custom time range
                  </div>
                  <div className="mt-0.5 font-mono text-dim text-w-sm">
                    Use a fixed time range instead of the dashboard default
                  </div>
                </div>
                <Switch
                  checked={config.ignoreTimeRange === true}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      onConfigReplace({
                        ...config,
                        ignoreTimeRange: true,
                        customTimeRange:
                          (config.customTimeRange as TimeRange | undefined) ??
                          DEFAULT_WIDGET_CUSTOM_TIME_RANGE,
                      });
                    } else {
                      onConfigReplace({
                        ...config,
                        ignoreTimeRange: undefined,
                        customTimeRange: undefined,
                      });
                    }
                  }}
                  aria-label="Custom time range"
                />
              </div>
              <CustomTimeRangeControl
                visible={config.ignoreTimeRange === true}
                currentRange={
                  (config.customTimeRange as TimeRange | undefined) ??
                  DEFAULT_WIDGET_CUSTOM_TIME_RANGE
                }
                onRangeChange={(value) => onConfigChange("customTimeRange", value)}
              />
            </div>
            {descriptor.id === "rss-reader__feed" && (
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-mono text-foreground-secondary text-w-sm">
                    Show read items
                  </div>
                  <div className="mt-0.5 font-mono text-dim text-w-sm">
                    Include read articles in the feed
                  </div>
                </div>
                <Switch
                  checked={config.showReadItems === true}
                  onCheckedChange={(checked) =>
                    onConfigChange("showReadItems", checked || undefined)
                  }
                  aria-label="Show read items"
                />
              </div>
            )}
            <MaxItemsControl
              visible={hasListSections}
              currentMaxItems={config.maxItems as number | undefined}
              cap={
                visualEditorConfig
                  ? getDefaultMaxItems(visualEditorConfig as WidgetTemplateConfig)
                  : undefined
              }
              onConfigChange={onConfigChange}
            />
          </div>
        </div>

        <PollingIntervalsSection
          descriptor={descriptor}
          pollingSourceIds={pollingSourceIds}
          preferences={preferences}
          updatePollingInterval={updatePollingInterval}
        />

        {descriptor.id === "github-stars" && (
          <StarsRepositoriesSection
            isGitHubConnected={connectedKeys.includes("github")}
            selectedRepos={selectedRepos}
            excludedRepos={projectLinkedRepos}
            onChange={(repos) => onConfigChange("selectedRepos", repos)}
          />
        )}

        {descriptor.id === "npm-downloads" ? (
          <NpmPackageFiltersSection
            excludePackagesDraft={excludePackagesDraft}
            finishPackageDraft={finishPackageDraft}
            includePackagesDraft={includePackagesDraft}
            onConfigChange={onConfigChange}
            setExcludePackagesDraft={setExcludePackagesDraft}
            setIncludePackagesDraft={setIncludePackagesDraft}
            setIsEditingExcludePackages={setIsEditingExcludePackages}
            setIsEditingIncludePackages={setIsEditingIncludePackages}
          />
        ) : null}

        <ServiceIntegrationsSection
          connectableServices={connectableServices}
          connectedKeys={connectedKeys}
          descriptor={descriptor}
          disabledServices={disabledServices}
          hasMultipleServices={hasMultipleServices}
          onNavigateToIntegrations={onNavigateToIntegrations}
          toggleService={toggleService}
        />
      </div>

      {hasVisualEditor ? (
        <VisualEditorPane
          config={config}
          descriptor={descriptor}
          includePackagesDraft={includePackagesDraft}
          excludePackagesDraft={excludePackagesDraft}
          onConfigReplace={onConfigReplace}
        />
      ) : null}
    </div>
  );
}
