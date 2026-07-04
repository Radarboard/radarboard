"use client";

import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  type Modifier,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { ChatDrawer } from "@radarboard/assistant-ui/chat-drawer";
import { useChatDrawer } from "@radarboard/assistant-ui/use-chat-drawer";
import {
  createDefaultDashboardPage,
  DEFAULT_DASHBOARD_PAGE_SLUG,
  resolveDashboardProjectView,
} from "@radarboard/hooks/dashboard-layout";
import { prefetchProjectData } from "@radarboard/hooks/prefetch-project-data";
import { useDashboard } from "@radarboard/hooks/use-dashboard";
import { API_ROUTES } from "@radarboard/types/api-routes";
import { ALL_PROJECTS_SLUG } from "@radarboard/types/dashboard";
import type { DashboardPageConfig, LayoutCell, LayoutDefinition } from "@radarboard/types/database";
import { VIEW_STATE_QUERY_KEYS } from "@radarboard/types/view-state";
import { ConfirmationDialog, DialogDescription } from "@radarboard/ui/app-dialog";
import type { LayoutBlueprintDescriptor } from "@radarboard/widget-engine/blueprints";
import { applyBlueprint } from "@radarboard/widget-engine/blueprints/apply";
import {
  applyColumnBoundaryDelta,
  generateCellId,
  generateStackedGridAreas,
  getCellRect,
  getGridAreaName,
  getHorizontalResizeHandles,
  getSortedCells,
  type HorizontalResizeHandleDescriptor,
  type LayoutCellRect,
  resolveColSizes,
  resolveColumnRowSizes,
  sizesToGridTemplate,
  summarizeColumnRowSizes,
} from "@radarboard/widget-engine/layouts";
import { PageTabs } from "@radarboard/widget-engine/page-tabs";
import { ProjectTabs } from "@radarboard/widget-engine/project-tabs";
import { ResizeHandle, SegmentResizeHandle } from "@radarboard/widget-engine/resize-handle";
import { TopBar } from "@radarboard/widget-engine/top-bar";
import { WidgetSlot } from "@radarboard/widget-engine/widget-slot";
import { WIDGET_REGISTRY } from "@radarboard/widget-engine/widgets/registry";
import { useRouter } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import type React from "react";
import type { CSSProperties, RefObject } from "react";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { Providers } from "@/app/providers";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { SetupWizard } from "@/components/dashboard/setup-wizard";
import { StepIntegrations } from "@/components/onboarding/step-integrations";
import { StepLayout } from "@/components/onboarding/step-layout";
import { ProjectSwitchSkeletonOverlay } from "@/components/projects/project-switch-skeleton-overlay";
import { LayoutPresetPicker } from "@/components/settings/settings-layouts/preset-picker";
import { SettingsModal } from "@/components/settings/settings-modal";
import type {
  AdvancedSettingsSection,
  SettingsSection,
} from "@/components/settings/settings-sections";
import {
  DEFAULT_ADVANCED_SETTINGS_SECTION,
  DEFAULT_SETTINGS_SECTION,
  isAdvancedSettingsSection,
  isSettingsSection,
  readStoredAdvancedSettingsSection,
  readStoredSettingsSection,
  writeStoredAdvancedSettingsSection,
  writeStoredProjectSettingsTab,
  writeStoredSettingsSection,
} from "@/components/settings/settings-storage";
import { WidgetConfigFromUrl } from "@/components/widgets/widget-detail-dialog";
import { useFormattedAppShortcutLabel } from "@/hooks/app/use-app-shortcuts";
import { useSyncDisabledPluginIdsCache } from "@/hooks/plugins/use-disabled-plugins";
import { useDemoModeActions } from "@/lib/demo-data";
import { getFeatureUiComponent } from "@/lib/extensions/runtime/ui/feature-ui";
import { isFeatureEnabled } from "@/lib/features";
import { swapWidgetSlots } from "@/lib/layout-utils";
import { getDashboardPath } from "@/lib/project-routes";
import { addShortcutRuntimeListener } from "@/lib/shortcuts/runtime";
import { NotificationCenter } from "@/modules/provider-shell/notification-center";
import { PluginSidebar } from "@/modules/provider-shell/plugin-dock";
import { PluginLauncher } from "@/modules/provider-shell/plugin-launcher";
import { PluginOverlay } from "@/modules/provider-shell/plugin-overlay";
import { refreshWidgetLayoutFromServer } from "@/modules/settings/store/settings-store";
import { BottomTicker } from "../../chrome/bottom-ticker";
import { KPIStrip } from "../../chrome/kpi-strip";
import {
  resolveConnectServiceTarget,
  resolveProjectSettingsOpenState,
  resolveSettingsChildParamPreservation,
  type SettingsSectionChangeOptions,
} from "./settings-params";

/**
 * Modifier that snaps the DragOverlay to the cursor position.
 * Without this, the overlay drifts when widgets are inside a scrollable container
 * because the default transform doesn't account for the scroll offset.
 */
const snapOverlayToCursor: Modifier = ({ activatorEvent, transform, activeNodeRect }) => {
  if (!activatorEvent || !activeNodeRect) return transform;
  const event = activatorEvent as PointerEvent;
  return {
    ...transform,
    x: event.clientX - activeNodeRect.left + transform.x - activeNodeRect.width / 2,
    y: event.clientY - activeNodeRect.top + transform.y - activeNodeRect.height / 2,
  };
};

interface OnboardingWizardBaseProps {
  mode: "first-run" | "returning" | "preview";
  open: boolean;
  onComplete: () => void;
  onPluginsConfigured?: (disabledPluginIds: string[]) => void;
}

type OnboardingWizardInjectedSteps = {
  [StepName in "StepIntegrations" | "StepLayout"]: StepName extends "StepIntegrations"
    ? typeof StepIntegrations
    : typeof StepLayout;
};

type OnboardingWizardProps = OnboardingWizardBaseProps & OnboardingWizardInjectedSteps;

const OnboardingWizard = getFeatureUiComponent<OnboardingWizardProps>("onboarding", "wizard");

interface DatabaseConfigResponse {
  hasConfig?: boolean;
  onboardingCompleted?: boolean;
}

async function fetchDatabaseConfig(url: string): Promise<DatabaseConfigResponse> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load database config: ${res.status}`);
  }
  return (await res.json()) as DatabaseConfigResponse;
}

function useViewportWidth(): number | null {
  const [viewportWidth, setViewportWidth] = useState<number | null>(null);

  useEffect(() => {
    const update = () => setViewportWidth(window.innerWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return viewportWidth;
}

interface ActiveGridCell {
  areaName: string;
  cellId: string;
  cell: LayoutCell;
}

function buildStackedGridStyle(
  areaNames: string[],
  columns: number,
  rowSize: string,
  showTicker: boolean
): CSSProperties {
  const widgetAreas = generateStackedGridAreas(areaNames, columns);
  const rowCount = Math.ceil(areaNames.length / columns);
  const tickerArea = `"${Array.from({ length: columns }, () => "ticker").join(" ")}"`;

  return {
    gridTemplateColumns: Array.from({ length: columns }, () => "minmax(0, 1fr)").join(" "),
    gridTemplateRows: `${Array.from({ length: rowCount }, () => rowSize).join(" ")}${showTicker ? " auto" : ""}`,
    gridTemplateAreas: showTicker ? `${widgetAreas} ${tickerArea}` : widgetAreas,
  };
}

function buildDashboardGridStyle(
  areaNames: string[],
  colSizes: number[],
  viewportWidth: number | null,
  showTicker: boolean
): CSSProperties {
  if (viewportWidth !== null && viewportWidth <= 600) {
    return buildStackedGridStyle(areaNames, 1, "minmax(250px, auto)", showTicker);
  }

  if (viewportWidth !== null && viewportWidth <= 900) {
    return buildStackedGridStyle(areaNames, 2, "minmax(220px, 1fr)", showTicker);
  }

  return {
    gridTemplateColumns: sizesToGridTemplate(colSizes),
  };
}

function useDashboardModalState() {
  const assistantEnabled = isFeatureEnabled("assistant");
  const [settingsSection, setSettingsSection] = useQueryState(
    VIEW_STATE_QUERY_KEYS.settings,
    parseAsString
  );
  const [advancedSectionParam, setAdvancedSectionParam] = useQueryState(
    VIEW_STATE_QUERY_KEYS.advancedSection,
    parseAsString
  );
  const [_settingsProject, setSettingsProject] = useQueryState(
    VIEW_STATE_QUERY_KEYS.project,
    parseAsString
  );
  const [_settingsAiSection, setSettingsAiSection] = useQueryState(
    VIEW_STATE_QUERY_KEYS.ai,
    parseAsString
  );
  const [detailParam, setDetailParam] = useQueryState(VIEW_STATE_QUERY_KEYS.detail, parseAsString);
  const [, setWidgetConfigId] = useQueryState(VIEW_STATE_QUERY_KEYS.widgetConfig, parseAsString);
  const [activePluginId, setActivePluginId] = useQueryState(
    VIEW_STATE_QUERY_KEYS.plugin,
    parseAsString
  );
  const [, setAppearanceSectionParam] = useQueryState(
    VIEW_STATE_QUERY_KEYS.appearanceSection,
    parseAsString
  );
  const [, setIntegrationCategoryParam] = useQueryState(
    VIEW_STATE_QUERY_KEYS.integrationCategory,
    parseAsString
  );
  const [integrationIntentParam, setIntegrationIntentParam] = useQueryState(
    VIEW_STATE_QUERY_KEYS.integrationIntent,
    parseAsString
  );
  const [integrationTabParam, setIntegrationTabParam] = useQueryState(
    VIEW_STATE_QUERY_KEYS.integrationTab,
    parseAsString
  );
  const [, setLayoutParam] = useQueryState(VIEW_STATE_QUERY_KEYS.layout, parseAsString);
  const [, setLayoutDialogParam] = useQueryState(VIEW_STATE_QUERY_KEYS.layoutDialog, parseAsString);
  const [, setNotificationsTabParam] = useQueryState(
    VIEW_STATE_QUERY_KEYS.notificationsTab,
    parseAsString
  );
  const [, setProjectDialogParam] = useQueryState(
    VIEW_STATE_QUERY_KEYS.projectDialog,
    parseAsString
  );
  const [serviceParam, setServiceParam] = useQueryState(
    VIEW_STATE_QUERY_KEYS.service,
    parseAsString
  );
  const [, setSettingsInstallerParam] = useQueryState(
    VIEW_STATE_QUERY_KEYS.settingsInstaller,
    parseAsString
  );
  const [, setSettingsPluginParam] = useQueryState(
    VIEW_STATE_QUERY_KEYS.settingsPlugin,
    parseAsString
  );
  const [, setSettingsPluginTabParam] = useQueryState(
    VIEW_STATE_QUERY_KEYS.settingsPluginTab,
    parseAsString
  );
  const [settingsRelayParam, setSettingsRelayParam] = useQueryState(
    VIEW_STATE_QUERY_KEYS.settingsRelay,
    parseAsString
  );
  const [, setShortcutScopeParam] = useQueryState(
    VIEW_STATE_QUERY_KEYS.shortcutScope,
    parseAsString
  );
  const [, setWidgetCategoryParam] = useQueryState(
    VIEW_STATE_QUERY_KEYS.widgetCategory,
    parseAsString
  );
  const [, setAiSkillEditorParam] = useQueryState(
    VIEW_STATE_QUERY_KEYS.aiSkillEditor,
    parseAsString
  );

  const legacyAdvancedSection = isAdvancedSettingsSection(settingsSection) ? settingsSection : null;
  const settingsOpen = isSettingsSection(settingsSection) || legacyAdvancedSection !== null;
  const normalizedSettingsSection =
    legacyAdvancedSection !== null
      ? "advanced"
      : settingsSection === "ai" && !assistantEnabled
        ? DEFAULT_SETTINGS_SECTION
        : settingsSection;
  const activeSection: SettingsSection =
    settingsOpen && normalizedSettingsSection && isSettingsSection(normalizedSettingsSection)
      ? normalizedSettingsSection
      : DEFAULT_SETTINGS_SECTION;
  const activeAdvancedSection: AdvancedSettingsSection = useMemo(() => {
    if (legacyAdvancedSection !== null) return legacyAdvancedSection;
    if (isAdvancedSettingsSection(advancedSectionParam)) return advancedSectionParam;
    if (typeof window !== "undefined") {
      return readStoredAdvancedSettingsSection(window.localStorage);
    }
    return DEFAULT_ADVANCED_SETTINGS_SECTION;
  }, [advancedSectionParam, legacyAdvancedSection]);
  const detailWidgetId = useMemo(() => {
    if (!detailParam) return null;
    const colonIndex = detailParam.indexOf(":");
    return colonIndex > 0 ? detailParam.slice(0, colonIndex) : null;
  }, [detailParam]);
  const detailItemId = useMemo(() => {
    if (!detailParam) return null;
    const colonIndex = detailParam.indexOf(":");
    return colonIndex > 0 ? detailParam.slice(colonIndex + 1) : null;
  }, [detailParam]);

  const clearSharedSettingsChildParams = useCallback(
    ({
      preserveIntegrationIntent = false,
      preserveIntegrationTab = false,
      preserveProject = false,
      preserveService = false,
    }: Partial<{
      preserveIntegrationIntent: boolean;
      preserveIntegrationTab: boolean;
      preserveProject: boolean;
      preserveService: boolean;
    }> = {}) => {
      setAiSkillEditorParam(null);
      setAppearanceSectionParam(null);
      if (!preserveIntegrationIntent) {
        setIntegrationCategoryParam(null);
        setIntegrationIntentParam(null);
      }
      if (!preserveIntegrationTab) {
        setIntegrationTabParam(null);
      }
      setLayoutDialogParam(null);
      setLayoutParam(null);
      setNotificationsTabParam(null);
      setProjectDialogParam(null);
      if (!preserveService) {
        setServiceParam(null);
      }
      setSettingsAiSection(null);
      setSettingsInstallerParam(null);
      setSettingsPluginParam(null);
      setSettingsPluginTabParam(null);
      if (!preserveProject) {
        setSettingsProject(null);
      }
      setSettingsRelayParam(null);
      setShortcutScopeParam(null);
      setWidgetCategoryParam(null);
      setWidgetConfigId(null);
    },
    [
      setAiSkillEditorParam,
      setAppearanceSectionParam,
      setIntegrationCategoryParam,
      setIntegrationIntentParam,
      setIntegrationTabParam,
      setLayoutDialogParam,
      setLayoutParam,
      setNotificationsTabParam,
      setProjectDialogParam,
      setServiceParam,
      setSettingsAiSection,
      setSettingsInstallerParam,
      setSettingsPluginParam,
      setSettingsPluginTabParam,
      setSettingsProject,
      setSettingsRelayParam,
      setShortcutScopeParam,
      setWidgetCategoryParam,
      setWidgetConfigId,
    ]
  );

  const clearAllSettingsChildParams = useCallback(() => {
    clearSharedSettingsChildParams();
    setAdvancedSectionParam(null);
  }, [clearSharedSettingsChildParams, setAdvancedSectionParam]);

  const handleSettingsOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        clearAllSettingsChildParams();
        setSettingsSection(null);
      }
    },
    [clearAllSettingsChildParams, setSettingsSection]
  );

  const handleSettingsSectionChange = useCallback(
    (section: SettingsSection, options?: SettingsSectionChangeOptions) => {
      if (!assistantEnabled && section === "ai") {
        clearAllSettingsChildParams();
        setSettingsSection(DEFAULT_SETTINGS_SECTION);
        return;
      }
      const resolvedPreservation = resolveSettingsChildParamPreservation(section, {
        integrationIntent: integrationIntentParam,
        integrationTab: integrationTabParam,
        service: serviceParam,
      });
      clearSharedSettingsChildParams({
        preserveIntegrationIntent:
          options?.preserveChildParams?.preserveIntegrationIntent ??
          resolvedPreservation.preserveIntegrationIntent,
        preserveIntegrationTab:
          options?.preserveChildParams?.preserveIntegrationTab ??
          resolvedPreservation.preserveIntegrationTab,
        preserveProject:
          options?.preserveChildParams?.preserveProject ?? resolvedPreservation.preserveProject,
        preserveService:
          options?.preserveChildParams?.preserveService ?? resolvedPreservation.preserveService,
      });
      setSettingsSection(section);
      if (section === "ai") {
        setSettingsAiSection("providers");
        setAdvancedSectionParam(null);
      } else if (section === "advanced") {
        setAdvancedSectionParam(activeAdvancedSection);
      } else {
        setAdvancedSectionParam(null);
      }
    },
    [
      assistantEnabled,
      activeAdvancedSection,
      clearAllSettingsChildParams,
      clearSharedSettingsChildParams,
      integrationIntentParam,
      integrationTabParam,
      serviceParam,
      setAdvancedSectionParam,
      setSettingsAiSection,
      setSettingsSection,
    ]
  );

  const handleAdvancedSettingsSectionChange = useCallback(
    (section: AdvancedSettingsSection) => {
      clearSharedSettingsChildParams();
      setSettingsSection("advanced");
      setAdvancedSectionParam(section);
    },
    [clearSharedSettingsChildParams, setAdvancedSectionParam, setSettingsSection]
  );

  const handleSettingsOpen = useCallback(
    (section?: string, options?: SettingsSectionChangeOptions) => {
      if (section && isAdvancedSettingsSection(section)) {
        handleAdvancedSettingsSectionChange(section);
        return;
      }
      if (section && isSettingsSection(section)) {
        handleSettingsSectionChange(section, options);
        return;
      }

      if (typeof window !== "undefined") {
        const storedSection = readStoredSettingsSection(window.localStorage);
        if (storedSection === "advanced") {
          handleAdvancedSettingsSectionChange(
            readStoredAdvancedSettingsSection(window.localStorage)
          );
          return;
        }
        handleSettingsSectionChange(storedSection);
        return;
      }

      handleSettingsSectionChange(DEFAULT_SETTINGS_SECTION);
    },
    [handleAdvancedSettingsSectionChange, handleSettingsSectionChange]
  );

  useEffect(() => {
    if (settingsRelayParam === null) return;
    handleAdvancedSettingsSectionChange("infrastructure");
  }, [handleAdvancedSettingsSectionChange, settingsRelayParam]);

  useEffect(() => {
    if (!settingsOpen || typeof window === "undefined") return;
    writeStoredSettingsSection(window.localStorage, activeSection);
    if (activeSection === "advanced") {
      writeStoredAdvancedSettingsSection(window.localStorage, activeAdvancedSection);
    }
  }, [activeAdvancedSection, activeSection, settingsOpen]);

  return {
    activeAdvancedSection,
    activePluginId,
    activeSection,
    detailItemId,
    detailWidgetId,
    handleAdvancedSettingsSectionChange,
    handleSettingsOpen,
    handleSettingsOpenChange,
    handleSettingsSectionChange,
    setActivePluginId,
    setDetailParam,
    setIntegrationIntentParam,
    setProjectDialogParam,
    setSettingsProject,
    setServiceParam,
    setWidgetConfigId,
    settingsOpen,
  };
}

interface DashboardGridAreaProps {
  activeProjectSlug: ReturnType<typeof useDashboard>["activeProjectSlug"];
  activeCells: ActiveGridCell[];
  activeCellRects: Record<string, LayoutCellRect>;
  appearance: ReturnType<typeof useDashboard>["appearance"];
  closeChat: () => void;
  detailItemId: string | null;
  detailWidgetId: string | null;
  gridStyle: React.CSSProperties;
  handleColResizeEnd: (sizes: number[]) => void;
  handleConfigureWidget: (widgetId: string) => void;
  handleConnectService?: (serviceId: string) => void;
  handleColumnRowResize: (handle: HorizontalResizeHandleDescriptor, deltaPct: number) => void;
  handleColumnRowResizeEnd: () => void;
  handleColumnRowResizeStart: () => void;
  horizontalHandles: HorizontalResizeHandleDescriptor[];
  isChatOpen: boolean;
  isDesktopLayout: boolean;
  isProjectSwitching: boolean;
  liveColSizes: number[];
  pendingProjectName: string;
  showResizeHandles: boolean;
  setDetailParam: (value: string | null) => void;
  setLiveColSizes: (sizes: number[]) => void;
  visualProjectView: ReturnType<typeof resolveDashboardProjectView>;
  widgetAreaRef: RefObject<HTMLDivElement | null>;
}

const DASHBOARD_CELL_GAP = "var(--dashboard-cell-gap, 6px)";
const DEMO_REVALIDATE_ROUTES = ["/api/analytics/data", "/api/integrations/"] as const;

function isDemoDataKey(key: unknown): key is string {
  if (typeof key !== "string") return false;
  return DEMO_REVALIDATE_ROUTES.some((route) => key.includes(route));
}

function getUniquePageSlug(name: string, pages: DashboardPageConfig[]): string {
  const baseSlug =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "page";
  const existingSlugs = new Set(pages.map((page) => page.slug));
  let candidate = baseSlug;
  let suffix = 2;

  while (existingSlugs.has(candidate)) {
    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

function cloneLayoutForNewPage(layout: LayoutDefinition): LayoutDefinition {
  const columnRowSizes = resolveColumnRowSizes(layout);

  return {
    ...layout,
    id: crypto.randomUUID(),
    cells: layout.cells.map((cell) => ({ ...cell, id: generateCellId() })),
    colSizes: [...resolveColSizes(layout)],
    rowSizes: [...summarizeColumnRowSizes(columnRowSizes)],
    columnRowSizes: columnRowSizes.map((sizes) => [...sizes]),
  };
}

function remapWidgetAssignments(
  sourceLayout: LayoutDefinition,
  targetLayout: LayoutDefinition,
  assignments: Record<string, string | null>
): Record<string, string | null> {
  const result: Record<string, string | null> = {};

  for (let index = 0; index < sourceLayout.cells.length; index += 1) {
    const sourceCell = sourceLayout.cells[index];
    const targetCell = targetLayout.cells[index];
    if (sourceCell && targetCell) {
      result[targetCell.id] = assignments[sourceCell.id] ?? null;
    }
  }

  return result;
}

function getDesktopCellStyle(
  cell: LayoutCell,
  rect: LayoutCellRect,
  dimensions: { rowCount: number; colCount: number }
): React.CSSProperties {
  const needsRightGap = cell.colStart + cell.colSpan < dimensions.colCount;
  const needsBottomGap = cell.rowStart + cell.rowSpan < dimensions.rowCount;

  return {
    position: "absolute",
    left: `${rect.leftPct}%`,
    top: `${rect.topPct}%`,
    width: needsRightGap ? `calc(${rect.widthPct}% - ${DASHBOARD_CELL_GAP})` : `${rect.widthPct}%`,
    height: needsBottomGap
      ? `calc(${rect.heightPct}% - ${DASHBOARD_CELL_GAP})`
      : `${rect.heightPct}%`,
  };
}

function DashboardGridArea({
  activeProjectSlug,
  activeCells,
  activeCellRects,
  appearance,
  closeChat,
  detailItemId,
  detailWidgetId,
  gridStyle,
  handleColResizeEnd,
  handleConfigureWidget,
  handleConnectService,
  handleColumnRowResize,
  handleColumnRowResizeEnd,
  handleColumnRowResizeStart,
  horizontalHandles,
  isChatOpen,
  isDesktopLayout,
  isProjectSwitching,
  liveColSizes,
  pendingProjectName,
  showResizeHandles,
  setDetailParam,
  setLiveColSizes,
  visualProjectView,
  widgetAreaRef,
}: DashboardGridAreaProps) {
  const dimensions = useMemo(
    () => ({
      rowCount: Math.max(1, ...activeCells.map((cell) => cell.cell.rowStart + cell.cell.rowSpan)),
      colCount: Math.max(1, ...activeCells.map((cell) => cell.cell.colStart + cell.cell.colSpan)),
    }),
    [activeCells]
  );

  return (
    <div className="relative min-w-0 flex-1 overflow-hidden">
      {isDesktopLayout ? (
        <div className="dashboard-grid-shell relative flex h-full min-w-0 flex-col overflow-hidden bg-[var(--grid-line)]">
          {Boolean(isProjectSwitching) && (
            <ProjectSwitchSkeletonOverlay
              layout={visualProjectView.layout}
              projectName={pendingProjectName}
              showTicker={appearance.ticker?.enabled ?? true}
            />
          )}

          <div
            ref={widgetAreaRef}
            className="scrollbar-thin relative min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden"
          >
            {activeCells.map((activeCell) => {
              const rect = activeCellRects[activeCell.cellId];
              if (!rect) return null;

              return (
                <WidgetSlotWithUrl
                  key={activeCell.cellId}
                  cellId={activeCell.cellId}
                  areaName={activeCell.areaName}
                  style={getDesktopCellStyle(activeCell.cell, rect, dimensions)}
                  detailWidgetId={detailWidgetId}
                  detailItemId={detailItemId}
                  onDetailChange={setDetailParam}
                  onConfigure={handleConfigureWidget}
                  onConnectService={handleConnectService}
                />
              );
            })}

            {Boolean(showResizeHandles) && (
              <div className="pointer-events-none absolute inset-0 z-10">
                {liveColSizes.slice(0, -1).map((_, index) => {
                  const boundaryOffset = liveColSizes
                    .slice(0, index + 1)
                    .reduce((sum, size) => sum + size, 0);

                  return (
                    <ResizeHandle
                      key={`col-${boundaryOffset}`}
                      axis="vertical"
                      index={index}
                      sizes={liveColSizes}
                      containerRef={widgetAreaRef}
                      onResize={setLiveColSizes}
                      onResizeEnd={handleColResizeEnd}
                    />
                  );
                })}
                {horizontalHandles.map((handle) => (
                  <SegmentResizeHandle
                    key={handle.id}
                    axis="horizontal"
                    containerRef={widgetAreaRef}
                    leftPct={handle.leftPct}
                    topPct={handle.topPct}
                    widthPct={handle.widthPct}
                    heightPct={0}
                    onResizeStart={handleColumnRowResizeStart}
                    onResize={(deltaPct) => handleColumnRowResize(handle, deltaPct)}
                    onResizeEnd={handleColumnRowResizeEnd}
                  />
                ))}
              </div>
            )}
          </div>

          {Boolean(appearance.ticker?.enabled ?? true) && (
            <div className="shrink-0 border-[var(--grid-line)] border-t bg-[var(--widget-bg)]">
              <BottomTicker projectSlug={activeProjectSlug} />
            </div>
          )}
        </div>
      ) : (
        <div
          className="dashboard-grid scrollbar-thin h-full min-w-0 overflow-y-auto overflow-x-hidden"
          style={gridStyle}
        >
          {Boolean(isProjectSwitching) && (
            <ProjectSwitchSkeletonOverlay
              layout={visualProjectView.layout}
              projectName={pendingProjectName}
              showTicker={appearance.ticker?.enabled ?? true}
            />
          )}

          {activeCells.map((cell) => (
            <WidgetSlotWithUrl
              key={cell.cellId}
              cellId={cell.cellId}
              areaName={cell.areaName}
              detailWidgetId={detailWidgetId}
              detailItemId={detailItemId}
              onDetailChange={setDetailParam}
              onConfigure={handleConfigureWidget}
              onConnectService={handleConnectService}
            />
          ))}

          {Boolean(appearance.ticker?.enabled ?? true) && (
            <div className="dashboard-ticker">
              <BottomTicker projectSlug={activeProjectSlug} />
            </div>
          )}
        </div>
      )}

      {Boolean(isChatOpen) && (
        <button
          type="button"
          tabIndex={-1}
          aria-label="Close AI assistant"
          className="absolute inset-0 z-20 cursor-default bg-transparent"
          onClick={closeChat}
        />
      )}
    </div>
  );
}

interface DashboardSurfaceProps extends DashboardGridAreaProps {
  activeDragWidgetName: string | null;
  activeAdvancedSection: AdvancedSettingsSection;
  activePageSlug: ReturnType<typeof useDashboard>["activePageSlug"];
  activePluginId: string | null;
  activeSection: SettingsSection;
  assistantEnabled: boolean;
  currencies: ReturnType<typeof useDashboard>["currencies"];
  currency: ReturnType<typeof useDashboard>["currency"];
  isEditMode: boolean;
  handleDragCancel: () => void;
  handleDragEnd: (event: DragEndEvent) => void;
  handleDragStart: (event: DragStartEvent) => void;
  handleKnowledgeClick: () => void;
  handleDebugClick: () => void;
  handleEditModeToggle: () => void;
  handleAddProject: () => void;
  handleAddPage: () => void;
  handleDeletePage: (slug: string) => void;
  handlePageSelect: (slug: string) => void;
  handlePluginClose: () => void;
  handlePluginLaunch: (pluginId: string) => void;
  handleProjectPrefetch: (slug: string | null) => void;
  handleProjectSelect: (slug: string | null) => void;
  handleAdvancedSettingsSectionChange: (section: AdvancedSettingsSection) => void;
  handleSettingsOpen: (section?: string) => void;
  handleSettingsOpenChange: (open: boolean) => void;
  handleSettingsSectionChange: (section: SettingsSection) => void;
  launcherOpen: boolean;
  onLauncherOpenChange: (open: boolean) => void;
  orderedProjects: ReturnType<typeof useDashboard>["orderedProjects"];
  pages: ReturnType<typeof useDashboard>["pages"];
  pendingProjectSlug: ReturnType<typeof useDashboard>["pendingProjectSlug"];
  pluginsLocked: boolean;
  sensors: ReturnType<typeof useSensors>;
  settingsOpen: boolean;
  onRerunSetup?: () => void;
  onStartFreshSetup?: () => void;
  onPreviewSetup?: () => void;
  shortcutTooltips: {
    search?: string;
    edit?: string;
    assistant?: string;
  };
  timeRange: ReturnType<typeof useDashboard>["timeRange"];
  toggleChat: () => void;
  onCurrencyChange: ReturnType<typeof useDashboard>["setCurrency"];
  onTimeRangeChange: ReturnType<typeof useDashboard>["setTimeRange"];
  visualProjectSlug: ReturnType<typeof useDashboard>["activeProjectSlug"];
}

function DashboardSurface({
  activeDragWidgetName,
  activeAdvancedSection,
  activePageSlug,
  activePluginId,
  activeProjectSlug,
  activeSection,
  assistantEnabled,
  activeCells,
  activeCellRects,
  appearance,
  closeChat,
  currencies,
  currency,
  detailItemId,
  detailWidgetId,
  gridStyle,
  handleColResizeEnd,
  handleColumnRowResize,
  handleColumnRowResizeEnd,
  handleColumnRowResizeStart,
  handleConfigureWidget,
  handleConnectService,
  handleDragCancel,
  handleDragEnd,
  handleDragStart,
  handleKnowledgeClick,
  handleDebugClick,
  handleEditModeToggle,
  handleAddProject,
  handleAddPage,
  handleDeletePage,
  handlePageSelect,
  handlePluginClose,
  handlePluginLaunch,
  handleProjectPrefetch,
  handleProjectSelect,
  handleAdvancedSettingsSectionChange,
  handleSettingsOpen,
  handleSettingsOpenChange,
  handleSettingsSectionChange,
  horizontalHandles,
  isChatOpen,
  isDesktopLayout,
  isEditMode,
  isProjectSwitching,
  launcherOpen,
  liveColSizes,
  onLauncherOpenChange,
  orderedProjects,
  pages,
  pendingProjectName,
  pendingProjectSlug,
  pluginsLocked,
  sensors,
  setDetailParam,
  setLiveColSizes,
  settingsOpen,
  onRerunSetup,
  onStartFreshSetup,
  onPreviewSetup,
  shortcutTooltips,
  showResizeHandles,
  timeRange,
  toggleChat,
  onCurrencyChange,
  onTimeRangeChange,
  visualProjectSlug,
  visualProjectView,
  widgetAreaRef,
}: DashboardSurfaceProps) {
  const { isDemoMode, connectRealData, startFresh } = useDemoModeActions();
  const [pluginMode, setPluginMode] = useQueryState("pluginMode", parseAsString);

  const handleConnectRealData = useCallback(() => {
    connectRealData()
      .finally(() => {
        handleSettingsOpen("integrations");
      })
      .catch(() => undefined);
  }, [connectRealData, handleSettingsOpen]);

  const handleStartFresh = useCallback(() => {
    startFresh()
      .finally(() => {
        if (typeof window !== "undefined") {
          window.sessionStorage.removeItem("radarboard:onboarding-completed");
          window.sessionStorage.setItem("radarboard:setup-dismissed", "true");
        }
        onStartFreshSetup?.();
      })
      .catch(() => undefined);
  }, [onStartFreshSetup, startFresh]);

  const handlePluginModeChange = useCallback(
    (mode: string) => setPluginMode(mode),
    [setPluginMode]
  );

  return (
    <>
      <SettingsModal
        open={settingsOpen}
        onOpenChange={handleSettingsOpenChange}
        activeSection={activeSection}
        activeAdvancedSection={activeAdvancedSection}
        onSectionChange={handleSettingsSectionChange}
        onAdvancedSectionChange={handleAdvancedSettingsSectionChange}
        onRerunSetup={() => {
          handleSettingsOpenChange(false);
          onRerunSetup?.();
        }}
        onPreviewSetup={() => {
          handleSettingsOpenChange(false);
          onPreviewSetup?.();
        }}
      />
      <WidgetConfigFromUrl
        onNavigateToIntegrations={() => {
          handleSettingsSectionChange("integrations");
        }}
      />
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="isolate flex h-screen w-full flex-col overflow-hidden">
          <div className="shrink-0 border-[var(--grid-line)] border-b bg-[var(--widget-bg)]">
            <TopBar
              projectTabsSlot={
                <ProjectTabs
                  projects={orderedProjects}
                  activeSlug={visualProjectSlug}
                  pendingSlug={pendingProjectSlug}
                  isPending={isProjectSwitching}
                  onSelect={handleProjectSelect}
                  onAddProject={handleAddProject}
                  onPrefetch={handleProjectPrefetch}
                  variant="header"
                />
              }
              timeRange={timeRange}
              currency={currency}
              currencies={currencies}
              showCurrencyToggle={activeProjectSlug !== null}
              onTimeRangeChange={onTimeRangeChange}
              onCurrencyChange={onCurrencyChange}
              onSearchOpen={() => onLauncherOpenChange(true)}
              searchTooltip={shortcutTooltips.search}
              isDemoMode={isDemoMode}
              onConnectRealData={handleConnectRealData}
              onStartFresh={handleStartFresh}
              isEditMode={isEditMode}
              onEditModeToggle={handleEditModeToggle}
              onEditStructure={() => handleSettingsSectionChange("layouts")}
              editTooltip={shortcutTooltips.edit}
              isChatOpen={isChatOpen}
              onChatToggle={toggleChat}
              assistantTooltip={shortcutTooltips.assistant}
              actionsSlot={<NotificationCenter />}
            />
          </div>

          {/* Demo indicator moved to TopBar badge — DemoBanner kept for future use */}

          <div className="shrink-0 border-[var(--grid-line)] border-b bg-[var(--widget-bg)]">
            <PageTabs
              pages={isProjectSwitching ? visualProjectView.pages : pages}
              activeSlug={isProjectSwitching ? visualProjectView.activePageSlug : activePageSlug}
              isEditMode={isEditMode}
              onSelect={handlePageSelect}
              onAddPage={isProjectSwitching ? undefined : handleAddPage}
              onDeletePage={isProjectSwitching ? undefined : handleDeletePage}
            />
          </div>

          <div className="dashboard-kpis shrink-0 border-[var(--grid-line)] border-b bg-[var(--widget-bg)]">
            <KPIStrip projectSlug={activeProjectSlug} />
          </div>

          <div className="flex min-h-0 flex-1 flex-row overflow-hidden">
            <div
              className={[
                "dashboard-body-shell flex min-h-0 min-w-0 flex-1 overflow-hidden",
                isChatOpen ? "dashboard-body-shell-dimmed" : "",
              ].join(" ")}
            >
              {pluginsLocked ? null : (
                <PluginSidebar
                  activePluginId={activePluginId}
                  onLaunch={handlePluginLaunch}
                  onOpenPluginSettings={() => handleSettingsOpen("plugins")}
                  onOpenDebug={handleDebugClick}
                  onOpenSettings={() => handleSettingsOpen()}
                />
              )}

              <DashboardGridArea
                activeProjectSlug={activeProjectSlug}
                activeCells={activeCells}
                activeCellRects={activeCellRects}
                appearance={appearance}
                closeChat={closeChat}
                detailItemId={detailItemId}
                detailWidgetId={detailWidgetId}
                gridStyle={gridStyle}
                handleColResizeEnd={handleColResizeEnd}
                handleColumnRowResize={handleColumnRowResize}
                handleColumnRowResizeEnd={handleColumnRowResizeEnd}
                handleColumnRowResizeStart={handleColumnRowResizeStart}
                handleConfigureWidget={handleConfigureWidget}
                handleConnectService={handleConnectService}
                horizontalHandles={horizontalHandles}
                isChatOpen={isChatOpen}
                isDesktopLayout={isDesktopLayout}
                isProjectSwitching={isProjectSwitching}
                liveColSizes={liveColSizes}
                pendingProjectName={pendingProjectName}
                showResizeHandles={showResizeHandles}
                setDetailParam={setDetailParam}
                setLiveColSizes={setLiveColSizes}
                visualProjectView={visualProjectView}
                widgetAreaRef={widgetAreaRef}
              />
            </div>

            {assistantEnabled ? <ChatDrawer /> : null}
          </div>
        </div>

        <DragOverlay dropAnimation={null} modifiers={[snapOverlayToCursor]}>
          {activeDragWidgetName ? (
            <div className="cursor-grabbing rounded-item border border-accent bg-surface-raised px-3 py-1.5 font-mono text-foreground text-w-sm uppercase tracking-widest opacity-90 shadow-lg">
              {activeDragWidgetName}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {pluginsLocked ? null : (
        <>
          <PluginLauncher
            onLaunch={handlePluginLaunch}
            onOpenSettings={handleSettingsOpen}
            onToggleChat={assistantEnabled ? toggleChat : undefined}
            onOpenKnowledge={assistantEnabled ? handleKnowledgeClick : undefined}
            onOpenDebug={handleDebugClick}
            externalOpen={launcherOpen}
            onOpenChange={onLauncherOpenChange}
          />
          <PluginOverlay
            activePluginId={activePluginId}
            onClose={handlePluginClose}
            pluginMode={
              pluginMode as import("@radarboard/plugin-sdk/types").PresentationMode | null
            }
            onPluginModeChange={handlePluginModeChange}
          />
        </>
      )}
    </>
  );
}

// --- Widget Slot with URL state ---

function WidgetSlotWithUrl({
  cellId,
  areaName,
  style,
  detailWidgetId,
  detailItemId,
  onDetailChange,
  onConfigure,
  onConnectService,
}: {
  cellId: string;
  areaName: string;
  style?: React.CSSProperties;
  detailWidgetId: string | null;
  detailItemId: string | null;
  onDetailChange: (value: string | null) => void;
  onConfigure: (widgetId: string) => void;
  onConnectService?: (serviceId: string) => void;
}) {
  const { widgetLayout, preferences } = useDashboard();
  const widgetId = widgetLayout[cellId] ?? null;
  const suggestedWidgetId = preferences.blueprintWidgetMap?.[cellId] ?? null;

  // Only pass selectedDetailId if this slot's widget matches the URL state
  const selectedDetailId = widgetId && widgetId === detailWidgetId ? detailItemId : null;

  const handleSelectedDetailIdChange = useCallback(
    (id: string | null) => {
      if (id && widgetId) {
        onDetailChange(`${widgetId}:${id}`);
      } else {
        onDetailChange(null);
      }
    },
    [widgetId, onDetailChange]
  );

  return (
    <WidgetSlot
      cellId={cellId}
      style={style ?? { gridArea: areaName }}
      selectedDetailId={selectedDetailId}
      onSelectedDetailIdChange={handleSelectedDetailIdChange}
      onConfigure={onConfigure}
      suggestedWidgetId={suggestedWidgetId}
      onConnectService={onConnectService}
    />
  );
}

function useDashboardGridState({
  activeCells,
  activeLayout,
  activePageSlug,
  activeProjectSlug,
  layouts,
  orderedProjects,
  pendingProjectSlug,
  projectLayouts,
  showTicker,
  isEditMode,
  updateLayoutSizes,
  updateWidgetLayout,
  viewportWidth,
  widgetLayout,
}: {
  activeCells: ActiveGridCell[];
  activeLayout: ReturnType<typeof useDashboard>["activeLayout"];
  activePageSlug: string | null;
  activeProjectSlug: string | null;
  layouts: ReturnType<typeof useDashboard>["layouts"];
  orderedProjects: ReturnType<typeof useDashboard>["orderedProjects"];
  pendingProjectSlug: string | null;
  projectLayouts: ReturnType<typeof useDashboard>["projectLayouts"];
  showTicker: boolean;
  isEditMode: boolean;
  updateLayoutSizes: ReturnType<typeof useDashboard>["updateLayoutSizes"];
  updateWidgetLayout: ReturnType<typeof useDashboard>["updateWidgetLayout"];
  viewportWidth: number | null;
  widgetLayout: ReturnType<typeof useDashboard>["widgetLayout"];
}) {
  const router = useRouter();

  useEffect(() => {
    router.prefetch(getDashboardPath(null));
    for (const project of orderedProjects) {
      router.prefetch(getDashboardPath(project.slug));
    }
  }, [orderedProjects, router]);

  const [activeDragCellId, setActiveDragCellId] = useState<string | null>(null);
  const [liveColSizes, setLiveColSizes] = useState<number[]>(() => resolveColSizes(activeLayout));
  const [liveColumnRowSizes, setLiveColumnRowSizes] = useState<number[][]>(() =>
    resolveColumnRowSizes(activeLayout)
  );
  const widgetAreaRef = useRef<HTMLDivElement>(null);
  const rowResizeStartRef = useRef<number[][] | null>(null);

  useEffect(() => {
    setLiveColSizes(resolveColSizes(activeLayout));
    setLiveColumnRowSizes(resolveColumnRowSizes(activeLayout));
  }, [activeLayout]);

  const handleColResizeEnd = useCallback(
    (finalColSizes: number[]) => {
      updateLayoutSizes(activeLayout.id, finalColSizes, liveColumnRowSizes);
    },
    [activeLayout.id, liveColumnRowSizes, updateLayoutSizes]
  );

  const handleColumnRowResizeStart = useCallback(() => {
    rowResizeStartRef.current = liveColumnRowSizes.map((sizes) => [...sizes]);
  }, [liveColumnRowSizes]);

  const handleColumnRowResize = useCallback(
    (handle: HorizontalResizeHandleDescriptor, deltaPct: number) => {
      const base = rowResizeStartRef.current ?? liveColumnRowSizes;
      setLiveColumnRowSizes(
        applyColumnBoundaryDelta(
          {
            ...activeLayout,
            colSizes: liveColSizes,
            rowSizes: summarizeColumnRowSizes(base),
            columnRowSizes: base,
          },
          handle.columns,
          handle.row,
          deltaPct
        )
      );
    },
    [activeLayout, liveColSizes, liveColumnRowSizes]
  );

  const handleColumnRowResizeEnd = useCallback(() => {
    rowResizeStartRef.current = null;
    updateLayoutSizes(activeLayout.id, liveColSizes, liveColumnRowSizes);
  }, [activeLayout.id, liveColSizes, liveColumnRowSizes, updateLayoutSizes]);

  const liveLayout = useMemo(
    () => ({
      ...activeLayout,
      colSizes: liveColSizes,
      rowSizes: summarizeColumnRowSizes(liveColumnRowSizes),
      columnRowSizes: liveColumnRowSizes,
    }),
    [activeLayout, liveColSizes, liveColumnRowSizes]
  );

  const activeCellRects = useMemo<Record<string, LayoutCellRect>>(
    () =>
      Object.fromEntries(
        activeCells.map((activeCell) => [
          activeCell.cellId,
          getCellRect(liveLayout, activeCell.cell),
        ])
      ),
    [activeCells, liveLayout]
  );

  const horizontalHandles = useMemo(() => getHorizontalResizeHandles(liveLayout), [liveLayout]);
  const activeAreaNames = useMemo(() => activeCells.map((cell) => cell.areaName), [activeCells]);
  const gridStyle = useMemo<CSSProperties>(
    () => buildDashboardGridStyle(activeAreaNames, liveColSizes, viewportWidth, showTicker),
    [activeAreaNames, liveColSizes, showTicker, viewportWidth]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const id = event.active.id as string;
    setActiveDragCellId(id.replace("drag-", ""));
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDragCellId(null);
      const { active, over } = event;
      if (!over) return;

      const sourceCellId = (active.id as string).replace("drag-", "");
      const targetCellId = (over.id as string).replace("cell-", "");
      const newLayout = swapWidgetSlots(widgetLayout, sourceCellId, targetCellId);
      if (newLayout !== widgetLayout) {
        updateWidgetLayout(newLayout);
      }
    },
    [updateWidgetLayout, widgetLayout]
  );

  const handleDragCancel = useCallback(() => {
    setActiveDragCellId(null);
  }, []);

  const activeDragWidgetName = useMemo(() => {
    if (!activeDragCellId) return null;
    const widgetId = widgetLayout[activeDragCellId];
    if (!widgetId) return null;
    return WIDGET_REGISTRY.get(widgetId)?.name ?? widgetId;
  }, [activeDragCellId, widgetLayout]);

  const visualProjectSlug = pendingProjectSlug ?? activeProjectSlug;
  const visualPageSlug = pendingProjectSlug ? null : activePageSlug;

  const visualProjectView = useMemo(
    () =>
      resolveDashboardProjectView({
        layouts,
        projectLayouts,
        projectSlug: visualProjectSlug,
        pageSlug: visualPageSlug,
      }),
    [layouts, projectLayouts, visualPageSlug, visualProjectSlug]
  );

  const pendingProjectName = useMemo(() => {
    if (visualProjectSlug === null) return "All Projects";
    return orderedProjects.find((project) => project.slug === visualProjectSlug)?.name ?? "Project";
  }, [orderedProjects, visualProjectSlug]);
  const isDesktopLayout = viewportWidth === null || viewportWidth > 900;

  return {
    activeCellRects,
    activeDragWidgetName,
    gridStyle,
    handleColResizeEnd,
    handleColumnRowResize,
    handleColumnRowResizeEnd,
    handleColumnRowResizeStart,
    handleDragCancel,
    handleDragEnd,
    handleDragStart,
    horizontalHandles,
    isDesktopLayout,
    liveColSizes,
    pendingProjectName,
    sensors,
    setLiveColSizes,
    showResizeHandles: isEditMode && isDesktopLayout,
    visualProjectSlug,
    visualProjectView,
    widgetAreaRef,
  };
}

function useDashboardContentActions({
  collapseWidget,
  effectiveTimezone,
  handleSettingsOpen,
  activeProjectSlug,
  isProjectSwitching,
  router,
  setActivePage,
  setActiveProject,
  setDetailParam,
  setIntegrationIntentParam,
  setSettingsProject,
  setServiceParam,
  setWidgetConfigId,
  timeRange,
}: {
  collapseWidget: ReturnType<typeof useDashboard>["collapseWidget"];
  effectiveTimezone: string;
  handleSettingsOpen: (section?: SettingsSection, options?: SettingsSectionChangeOptions) => void;
  activeProjectSlug: string | null;
  isProjectSwitching: boolean;
  router: ReturnType<typeof useRouter>;
  setActivePage: ReturnType<typeof useDashboard>["setActivePage"];
  setActiveProject: ReturnType<typeof useDashboard>["setActiveProject"];
  setDetailParam: (value: string | null) => void;
  setIntegrationIntentParam: (value: string | null) => void;
  setSettingsProject: (value: string | null) => void;
  setServiceParam: (value: string | null) => void;
  setWidgetConfigId: (value: string | null) => void;
  timeRange: ReturnType<typeof useDashboard>["timeRange"];
}) {
  const handleConfigureWidget = useCallback(
    (widgetId: string) => setWidgetConfigId(widgetId),
    [setWidgetConfigId]
  );

  const handleConnectService = useCallback(
    (serviceId: string) => {
      const { integrationIntent, isProjectSettingsIntent } = resolveConnectServiceTarget(serviceId);
      if (isProjectSettingsIntent) {
        const projectSettingsState = resolveProjectSettingsOpenState(serviceId, activeProjectSlug);
        if (projectSettingsState === null) return;

        setServiceParam(null);
        setIntegrationIntentParam(projectSettingsState.integrationIntent);
        if (typeof window !== "undefined") {
          writeStoredProjectSettingsTab(window.localStorage, "platforms");
        }
        setSettingsProject(projectSettingsState.projectSlug);
        handleSettingsOpen("projects", {
          preserveChildParams: {
            preserveIntegrationIntent: true,
            preserveProject: true,
          },
        });
        return;
      }
      const hasServiceId = integrationIntent === null && serviceId.length > 0;
      const hasIntegrationIntent = integrationIntent !== null && integrationIntent.length > 0;
      if (hasServiceId) {
        setServiceParam(serviceId);
        setIntegrationIntentParam(null);
      } else if (hasIntegrationIntent) {
        setServiceParam(null);
        setIntegrationIntentParam(integrationIntent);
      }
      handleSettingsOpen("integrations", {
        preserveChildParams: {
          preserveIntegrationIntent: hasIntegrationIntent,
          preserveIntegrationTab: hasServiceId,
          preserveService: hasServiceId,
        },
      });
    },
    [
      activeProjectSlug,
      handleSettingsOpen,
      setIntegrationIntentParam,
      setServiceParam,
      setSettingsProject,
    ]
  );

  const handleProjectPrefetch = useCallback(
    (slug: string | null) => {
      router.prefetch(getDashboardPath(slug));
      prefetchProjectData(slug, timeRange, effectiveTimezone);
    },
    [effectiveTimezone, router.prefetch, timeRange]
  );

  const clearDashboardSelectionState = useCallback(() => {
    setDetailParam(null);
    setWidgetConfigId(null);
    collapseWidget();
  }, [collapseWidget, setDetailParam, setWidgetConfigId]);

  const handleProjectSelect = useCallback(
    (slug: string | null) => {
      clearDashboardSelectionState();
      setActiveProject(slug);
    },
    [clearDashboardSelectionState, setActiveProject]
  );

  const handlePageSelect = useCallback(
    (slug: string) => {
      if (isProjectSwitching) return;
      clearDashboardSelectionState();
      setActivePage(slug);
    },
    [clearDashboardSelectionState, isProjectSwitching, setActivePage]
  );

  return {
    handleConfigureWidget,
    handleConnectService,
    handlePageSelect,
    handleProjectPrefetch,
    handleProjectSelect,
  };
}

function useDashboardContentUi({
  assistantEnabled,
  handlePluginLaunch,
  handleSettingsOpen,
  isChatOpen,
  isDemoMode,
  isEditMode,
  pluginsLocked,
  searchShortcutLabel,
  editShortcutLabel,
  assistantShortcutLabel,
  setActivePluginId,
  toggleChat,
  toggleEditMode,
}: {
  assistantEnabled: boolean;
  handlePluginLaunch: (pluginId: string) => void;
  handleSettingsOpen: (section?: SettingsSection, options?: SettingsSectionChangeOptions) => void;
  isChatOpen: boolean;
  isDemoMode: boolean;
  isEditMode: boolean;
  pluginsLocked: boolean;
  searchShortcutLabel: string | null;
  editShortcutLabel: string | null;
  assistantShortcutLabel: string | null;
  setActivePluginId: (value: string | null | ((prev: string | null) => string | null)) => void;
  toggleChat: () => void;
  toggleEditMode: () => void;
}) {
  const { launcherOpen, setLauncherOpen } = useLauncherState();

  useEffect(() => {
    if (!pluginsLocked) return;
    setLauncherOpen(false);
    setActivePluginId(null);
  }, [pluginsLocked, setActivePluginId, setLauncherOpen]);

  useEffect(() => {
    return addShortcutRuntimeListener((event) => {
      if (event.kind === "plugin") {
        if (pluginsLocked) return;
        handlePluginLaunch(event.pluginId);
        return;
      }

      if (event.actionId === "search") {
        setLauncherOpen(true);
        return;
      }
      if (event.actionId === "assistant") {
        if (!assistantEnabled) return;
        toggleChat();
        return;
      }
      if (event.actionId === "notifications") {
        window.dispatchEvent(
          new CustomEvent("radarboard:toggle-notifications", {
            detail: { source: "shortcut" },
          })
        );
        return;
      }
      if (event.actionId === "edit-layout") {
        if (isDemoMode) return;
        toggleEditMode();
        return;
      }
      if (event.actionId === "open-settings") {
        handleSettingsOpen();
      }
    });
  }, [
    assistantEnabled,
    handlePluginLaunch,
    handleSettingsOpen,
    isDemoMode,
    pluginsLocked,
    setLauncherOpen,
    toggleChat,
    toggleEditMode,
  ]);

  const shortcutTooltips = buildDashboardShortcutTooltips({
    assistantShortcutLabel,
    editShortcutLabel,
    isChatOpen,
    isEditMode,
    searchShortcutLabel,
  });

  return { launcherOpen, setLauncherOpen, shortcutTooltips };
}

function buildDashboardShortcutTooltips(params: {
  assistantShortcutLabel: string | null;
  editShortcutLabel: string | null;
  isChatOpen: boolean;
  isEditMode: boolean;
  searchShortcutLabel: string | null;
}) {
  const { assistantShortcutLabel, editShortcutLabel, isChatOpen, isEditMode, searchShortcutLabel } =
    params;

  return {
    search: searchShortcutLabel ? `Search ${searchShortcutLabel}` : "Search",
    edit: editShortcutLabel
      ? `${isEditMode ? "Exit edit mode" : "Edit layout"} ${editShortcutLabel}`
      : isEditMode
        ? "Exit edit mode"
        : "Edit layout",
    assistant: assistantShortcutLabel
      ? `${isChatOpen ? "Close AI assistant" : "Open AI assistant"} ${assistantShortcutLabel}`
      : isChatOpen
        ? "Close AI assistant"
        : "Open AI assistant",
  };
}

function useLauncherState() {
  const [launcherParam, setLauncherParam] = useQueryState(
    VIEW_STATE_QUERY_KEYS.launcher,
    parseAsString
  );
  const launcherOpen = launcherParam === "open";
  const setLauncherOpen = useCallback(
    (open: boolean) => {
      setLauncherParam(open ? "open" : null);
    },
    [setLauncherParam]
  );

  return { launcherOpen, setLauncherOpen };
}

// --- Main Dashboard ---

function DashboardContent({
  onRerunSetup,
  onStartFreshSetup,
  onPreviewSetup,
  pluginsLocked = false,
}: {
  onRerunSetup?: () => void;
  onStartFreshSetup?: () => void;
  onPreviewSetup?: () => void;
  pluginsLocked?: boolean;
}) {
  const {
    timeRange,
    currencies,
    currency,
    activeProjectSlug,
    activePageSlug,
    pendingProjectSlug,
    isProjectSwitching,
    orderedProjects,
    layouts,
    pages,
    projectLayouts,
    setTimeRange,
    setCurrency,
    setActiveProject,
    setActivePage,
    addProjectPage,
    removeProjectPage,
    activeLayout,
    appearance,
    isEditMode,
    toggleEditMode,
    updateLayoutSizes,
    updateLayouts,
    widgetLayout,
    updateWidgetLayout,
    collapseWidget,
    effectiveTimezone,
    preferences,
  } = useDashboard();
  const isDemoMode = preferences.demoMode === true;
  const { mutate } = useSWRConfig();

  const revalidateDemoData = useCallback(() => {
    mutate(isDemoDataKey).catch(() => undefined);
  }, [mutate]);

  useEffect(() => {
    if (!isDemoMode) return;
    window.addEventListener("radarboard:demo-data-ready", revalidateDemoData);
    return () => {
      window.removeEventListener("radarboard:demo-data-ready", revalidateDemoData);
    };
  }, [isDemoMode, revalidateDemoData]);

  // The assistant can mutate the dashboard server-side (add/move/remove/configure
  // widgets); refresh the layout in place so those changes appear live.
  useEffect(() => {
    const onDashboardChanged = () => {
      refreshWidgetLayoutFromServer().catch(() => undefined);
    };
    window.addEventListener("radarboard:dashboard-changed", onDashboardChanged);
    return () => window.removeEventListener("radarboard:dashboard-changed", onDashboardChanged);
  }, []);

  // Onboarding auto-trigger is handled by DashboardWithSearchParams via
  // the hasConfig check + setupDismissed flag. No secondary trigger needed
  // here — it caused race conditions where onboarding would reappear on
  // reload before preferences finished loading from the database.

  // Apply global font scale preference to <html> so .widget-card CSS vars inherit it
  useEffect(() => {
    const scale = appearance.fontScale;
    if (scale !== "md") {
      document.documentElement.dataset.fontScale = scale;
    } else {
      delete document.documentElement.dataset.fontScale;
    }
    return () => {
      delete document.documentElement.dataset.fontScale;
    };
  }, [appearance.fontScale]);

  const viewportWidth = useViewportWidth();
  const showTicker = appearance.ticker?.enabled ?? true;
  const router = useRouter();
  const activeCells = useMemo<ActiveGridCell[]>(
    () =>
      getSortedCells(activeLayout.cells).map((cell) => ({
        cellId: cell.id,
        areaName: getGridAreaName(cell.id),
        cell,
      })),
    [activeLayout.cells]
  );
  const {
    activeAdvancedSection,
    activePluginId,
    activeSection,
    detailItemId,
    detailWidgetId,
    handleAdvancedSettingsSectionChange,
    handleSettingsOpen,
    handleSettingsOpenChange,
    handleSettingsSectionChange,
    setActivePluginId,
    setDetailParam,
    setIntegrationIntentParam,
    setProjectDialogParam,
    setSettingsProject,
    setServiceParam,
    setWidgetConfigId,
    settingsOpen,
  } = useDashboardModalState();
  const assistantEnabled = isFeatureEnabled("assistant");
  const chatDrawer = useChatDrawer();
  const isChatOpen = assistantEnabled ? chatDrawer.isOpen : false;
  const toggleChat = assistantEnabled ? chatDrawer.toggle : () => undefined;
  const closeChat = assistantEnabled ? chatDrawer.close : () => undefined;
  const searchShortcutLabel = useFormattedAppShortcutLabel("search");
  const editShortcutLabel = useFormattedAppShortcutLabel("edit-layout");
  const assistantShortcutLabel = useFormattedAppShortcutLabel("assistant");
  const [pagePresetPickerOpen, setPagePresetPickerOpen] = useState(false);
  const [pendingDeletePageSlug, setPendingDeletePageSlug] = useState<string | null>(null);
  const handlePluginLaunch = useCallback(
    (pluginId: string) => {
      setActivePluginId((prev) => (prev === pluginId ? null : pluginId));
    },
    [setActivePluginId]
  );

  const handlePluginClose = useCallback(() => {
    setActivePluginId(null);
  }, [setActivePluginId]);

  const handleAddProject = useCallback(() => {
    handleSettingsOpen("projects");
    setProjectDialogParam("new");
  }, [handleSettingsOpen, setProjectDialogParam]);

  const handleAddPage = useCallback(() => {
    setPagePresetPickerOpen(true);
  }, []);

  const handleCreatePageFromLayout = useCallback(
    (baseLayout: LayoutDefinition) => {
      const name = `Page ${pages.length + 1}`;
      const slug = getUniquePageSlug(name, pages);
      const newLayout = cloneLayoutForNewPage(baseLayout);
      const updatedLayouts = [...layouts, newLayout];

      updateLayouts(updatedLayouts);
      addProjectPage(
        activeProjectSlug ?? ALL_PROJECTS_SLUG,
        createDefaultDashboardPage(
          {
            layoutId: newLayout.id,
            name,
            slug,
          },
          updatedLayouts
        )
      );
      setActivePage(slug);
      setPagePresetPickerOpen(false);
    },
    [activeProjectSlug, addProjectPage, layouts, pages, setActivePage, updateLayouts]
  );

  const handleCreatePageFromBlueprint = useCallback(
    (blueprint: LayoutBlueprintDescriptor) => {
      const result = applyBlueprint(blueprint, []);
      const name = `Page ${pages.length + 1}`;
      const slug = getUniquePageSlug(name, pages);
      const newLayout = cloneLayoutForNewPage({
        ...result.layout,
        name: blueprint.name,
      });
      const widgetAssignments = remapWidgetAssignments(
        result.layout,
        newLayout,
        result.widgetAssignments
      );
      const updatedLayouts = [...layouts, newLayout];

      updateLayouts(updatedLayouts);
      addProjectPage(
        activeProjectSlug ?? ALL_PROJECTS_SLUG,
        createDefaultDashboardPage(
          {
            layoutId: newLayout.id,
            name,
            slug,
            widgetLayouts: {
              [newLayout.id]: widgetAssignments,
            },
          },
          updatedLayouts
        )
      );
      setActivePage(slug);
      setPagePresetPickerOpen(false);
    },
    [activeProjectSlug, addProjectPage, layouts, pages, setActivePage, updateLayouts]
  );

  const handleDeletePageRequest = useCallback(
    (pageSlug: string) => {
      if (pages.length <= 1) return;
      if (pageSlug === DEFAULT_DASHBOARD_PAGE_SLUG) return;

      setPendingDeletePageSlug(pageSlug);
    },
    [pages.length]
  );

  const handleConfirmDeletePage = useCallback(() => {
    if (!pendingDeletePageSlug) return;
    if (pendingDeletePageSlug === DEFAULT_DASHBOARD_PAGE_SLUG) return;
    if (pages.length <= 1) return;

    const pageIndex = pages.findIndex((page) => page.slug === pendingDeletePageSlug);
    if (pageIndex < 0) return;

    const fallbackPage =
      pages[pageIndex + 1] ??
      pages[pageIndex - 1] ??
      pages.find((page) => page.slug !== pendingDeletePageSlug) ??
      null;

    removeProjectPage(activeProjectSlug ?? ALL_PROJECTS_SLUG, pendingDeletePageSlug);
    if (activePageSlug === pendingDeletePageSlug && fallbackPage) {
      setActivePage(fallbackPage.slug);
    }
  }, [
    activePageSlug,
    activeProjectSlug,
    pages,
    pendingDeletePageSlug,
    removeProjectPage,
    setActivePage,
  ]);

  const pendingDeletePage = useMemo(
    () => pages.find((page) => page.slug === pendingDeletePageSlug) ?? null,
    [pages, pendingDeletePageSlug]
  );

  const {
    handleConfigureWidget,
    handleConnectService,
    handlePageSelect,
    handleProjectPrefetch,
    handleProjectSelect,
  } = useDashboardContentActions({
    collapseWidget,
    effectiveTimezone,
    handleSettingsOpen,
    activeProjectSlug,
    isProjectSwitching,
    router,
    setActivePage,
    setActiveProject,
    setDetailParam,
    setIntegrationIntentParam,
    setSettingsProject,
    setServiceParam,
    setWidgetConfigId,
    timeRange,
  });
  const {
    activeCellRects,
    activeDragWidgetName,
    gridStyle,
    handleColResizeEnd,
    handleColumnRowResize,
    handleColumnRowResizeEnd,
    handleColumnRowResizeStart,
    handleDragCancel,
    handleDragEnd,
    handleDragStart,
    horizontalHandles,
    isDesktopLayout,
    liveColSizes,
    pendingProjectName,
    sensors,
    setLiveColSizes,
    showResizeHandles,
    visualProjectSlug,
    visualProjectView,
    widgetAreaRef,
  } = useDashboardGridState({
    activeCells,
    activeLayout,
    activePageSlug,
    activeProjectSlug: isProjectSwitching ? pendingProjectSlug : activeProjectSlug,
    layouts,
    orderedProjects,
    pendingProjectSlug: isProjectSwitching ? pendingProjectSlug : null,
    projectLayouts,
    showTicker,
    isEditMode,
    updateLayoutSizes,
    updateWidgetLayout,
    viewportWidth,
    widgetLayout,
  });
  const { launcherOpen, setLauncherOpen, shortcutTooltips } = useDashboardContentUi({
    assistantEnabled,
    handlePluginLaunch,
    handleSettingsOpen,
    isChatOpen,
    isDemoMode,
    isEditMode,
    pluginsLocked,
    searchShortcutLabel,
    assistantShortcutLabel,
    editShortcutLabel,
    setActivePluginId,
    toggleChat,
    toggleEditMode,
  });

  return (
    <>
      <DashboardSurface
        activeDragWidgetName={activeDragWidgetName}
        activeAdvancedSection={activeAdvancedSection}
        activePageSlug={activePageSlug}
        activePluginId={activePluginId}
        activeProjectSlug={activeProjectSlug}
        activeSection={activeSection}
        assistantEnabled={assistantEnabled}
        activeCells={activeCells}
        activeCellRects={activeCellRects}
        appearance={appearance}
        closeChat={closeChat}
        currencies={currencies}
        currency={currency}
        isEditMode={isEditMode}
        detailItemId={detailItemId}
        detailWidgetId={detailWidgetId}
        gridStyle={gridStyle}
        handleColResizeEnd={handleColResizeEnd}
        handleColumnRowResize={handleColumnRowResize}
        handleColumnRowResizeEnd={handleColumnRowResizeEnd}
        handleColumnRowResizeStart={handleColumnRowResizeStart}
        handleConfigureWidget={handleConfigureWidget}
        handleConnectService={handleConnectService}
        handleDebugClick={() => router.push("/debug")}
        handleKnowledgeClick={() => router.push("/knowledge")}
        handleAddProject={handleAddProject}
        handleAddPage={handleAddPage}
        handleDeletePage={handleDeletePageRequest}
        handleDragCancel={handleDragCancel}
        handleDragEnd={handleDragEnd}
        handleDragStart={handleDragStart}
        handleEditModeToggle={toggleEditMode}
        handlePageSelect={handlePageSelect}
        handlePluginClose={handlePluginClose}
        handlePluginLaunch={handlePluginLaunch}
        handleProjectPrefetch={handleProjectPrefetch}
        handleProjectSelect={handleProjectSelect}
        handleAdvancedSettingsSectionChange={handleAdvancedSettingsSectionChange}
        handleSettingsOpen={handleSettingsOpen}
        handleSettingsOpenChange={handleSettingsOpenChange}
        handleSettingsSectionChange={handleSettingsSectionChange}
        horizontalHandles={horizontalHandles}
        isChatOpen={isChatOpen}
        isDesktopLayout={isDesktopLayout}
        isProjectSwitching={isProjectSwitching}
        launcherOpen={launcherOpen}
        liveColSizes={liveColSizes}
        onCurrencyChange={setCurrency}
        onLauncherOpenChange={setLauncherOpen}
        onTimeRangeChange={setTimeRange}
        orderedProjects={orderedProjects}
        pages={pages}
        pendingProjectName={pendingProjectName}
        pendingProjectSlug={pendingProjectSlug}
        pluginsLocked={pluginsLocked}
        sensors={sensors}
        setDetailParam={setDetailParam}
        setLiveColSizes={setLiveColSizes}
        settingsOpen={settingsOpen}
        onRerunSetup={onRerunSetup}
        onStartFreshSetup={onStartFreshSetup}
        onPreviewSetup={onPreviewSetup}
        shortcutTooltips={shortcutTooltips}
        showResizeHandles={showResizeHandles}
        timeRange={timeRange}
        toggleChat={toggleChat}
        visualProjectSlug={visualProjectSlug}
        visualProjectView={visualProjectView}
        widgetAreaRef={widgetAreaRef}
      />
      <LayoutPresetPicker
        open={pagePresetPickerOpen}
        onOpenChange={setPagePresetPickerOpen}
        onSelect={handleCreatePageFromLayout}
        onSelectBlueprint={handleCreatePageFromBlueprint}
        personas={preferences.userProfile ? [preferences.userProfile] : []}
      />
      <ConfirmationDialog
        open={pendingDeletePage !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeletePageSlug(null);
        }}
        title="Delete Page"
        confirmLabel="Delete page"
        onConfirm={handleConfirmDeletePage}
        successToast={pendingDeletePage ? `Deleted ${pendingDeletePage.name}` : "Page deleted"}
        errorToast="Failed to delete page"
      >
        <DialogDescription>
          {pendingDeletePage ? (
            <>
              Delete <span className="text-foreground">{pendingDeletePage.name}</span>? This removes
              the page and its widget placements from this dashboard.
            </>
          ) : null}
        </DialogDescription>
      </ConfirmationDialog>
    </>
  );
}

interface DashboardProps {
  setupBehavior?: "auto" | "skip";
}

function DashboardOnboardingShell({
  activeOnboardingMode,
  handleOnboardingComplete,
  handlePreviewSetup,
  handleRerunSetup,
  handleStartFreshSetup,
  handleSetupComplete,
  showOnboarding,
  showSetup,
}: {
  activeOnboardingMode: "first-run" | "returning" | "preview";
  handleOnboardingComplete: () => void;
  handlePreviewSetup: () => void;
  handleRerunSetup: () => void;
  handleStartFreshSetup: () => void;
  handleSetupComplete: () => void;
  showOnboarding: boolean;
  showSetup: boolean;
}) {
  const syncDisabledPluginIdsCache = useSyncDisabledPluginIdsCache();

  return (
    <>
      <SetupWizard open={showSetup} onComplete={handleSetupComplete} />
      {showOnboarding && !showSetup && OnboardingWizard && (
        <OnboardingWizard
          mode={activeOnboardingMode}
          open={showOnboarding && !showSetup}
          onComplete={handleOnboardingComplete}
          onPluginsConfigured={(disabledPluginIds) => {
            syncDisabledPluginIdsCache(disabledPluginIds).catch(() => undefined);
          }}
          StepIntegrations={StepIntegrations}
          StepLayout={StepLayout}
        />
      )}
      <DashboardContent
        onRerunSetup={handleRerunSetup}
        onStartFreshSetup={handleStartFreshSetup}
        onPreviewSetup={handlePreviewSetup}
        pluginsLocked={showOnboarding}
      />
    </>
  );
}

function DashboardWithSearchParams({ setupBehavior = "auto" }: DashboardProps) {
  const router = useRouter();
  const skipSetup = setupBehavior === "skip";
  const [setupDismissed, setSetupDismissed] = useState(() => {
    if (skipSetup) return true;
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem("radarboard:setup-dismissed") === "true";
  });
  const [onboardingMode, setOnboardingMode] = useState<
    "first-run" | "returning" | "preview" | null
  >(() => {
    if (skipSetup) return null;
    const param =
      typeof window === "undefined"
        ? null
        : new URLSearchParams(window.location.search).get("onboarding");
    if (param === "preview") return "preview";
    return null;
  });
  const { data, error, isLoading } = useSWR<DatabaseConfigResponse>(
    API_ROUTES.databaseConfig,
    fetchDatabaseConfig,
    {
      revalidateOnFocus: false,
      shouldRetryOnError: true,
      errorRetryCount: 3,
      errorRetryInterval: 1500,
    }
  );

  // Auto-trigger onboarding when database is already configured (e.g. SQLite
  // desktop) but the user hasn't completed onboarding yet.
  useEffect(() => {
    if (skipSetup) return;
    if (data?.hasConfig !== true) return;
    if (data.onboardingCompleted) return;
    // Don't re-trigger if already completed this session or mode is already set
    if (
      typeof window !== "undefined" &&
      sessionStorage.getItem("radarboard:onboarding-completed") === "true"
    )
      return;
    setOnboardingMode((prev) => prev ?? "first-run");
  }, [data, skipSetup]);

  const handleSetupComplete = useCallback(() => {
    setSetupDismissed(true);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("radarboard:setup-dismissed", "true");
    }
    setOnboardingMode("first-run");
  }, []);

  const handleOnboardingComplete = useCallback(() => {
    setOnboardingMode(null);
    if (typeof window !== "undefined") {
      // Persist so onboarding doesn't reappear on reload before preferences load
      sessionStorage.setItem("radarboard:setup-dismissed", "true");
      sessionStorage.setItem("radarboard:onboarding-completed", "true");
    }
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has("onboarding")) return;
    url.searchParams.delete("onboarding");
    router.replace(url.pathname + url.search, { scroll: false });
  }, [router]);

  const handleRerunSetup = useCallback(() => {
    setOnboardingMode("returning");
  }, []);

  const handleStartFreshSetup = useCallback(() => {
    setSetupDismissed(true);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("radarboard:setup-dismissed", "true");
      sessionStorage.removeItem("radarboard:onboarding-completed");
    }
    setOnboardingMode("first-run");
  }, []);

  const handlePreviewSetup = useCallback(() => {
    setOnboardingMode("preview");
  }, []);

  if (!skipSetup && isLoading && data === undefined && !error) return <DashboardSkeleton />;

  const showSetup = !skipSetup && !setupDismissed && data?.hasConfig === false;
  const showOnboarding = showSetup || onboardingMode !== null;
  const activeOnboardingMode = showSetup ? "first-run" : (onboardingMode ?? "returning");

  return (
    <Providers>
      <DashboardOnboardingShell
        activeOnboardingMode={activeOnboardingMode}
        handleOnboardingComplete={handleOnboardingComplete}
        handlePreviewSetup={handlePreviewSetup}
        handleRerunSetup={handleRerunSetup}
        handleStartFreshSetup={handleStartFreshSetup}
        handleSetupComplete={handleSetupComplete}
        showOnboarding={showOnboarding}
        showSetup={showSetup}
      />
    </Providers>
  );
}

export function Dashboard({ setupBehavior = "auto" }: DashboardProps) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardWithSearchParams setupBehavior={setupBehavior} />
    </Suspense>
  );
}
