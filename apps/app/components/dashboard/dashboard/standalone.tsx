"use client";

import { useCredentials } from "@radarboard/hooks/use-credentials";
import { useDashboard } from "@radarboard/hooks/use-dashboard";
import { PluginSidebar } from "@radarboard/plugin-sdk/runtime/plugin-dock";
import { TooltipProvider } from "@radarboard/ui/tooltip";
import {
  getGridAreaName,
  getSortedCells,
  resolveColSizes,
  resolveRowSizes,
  sizesToGridTemplate,
} from "@radarboard/widget-engine/layouts";
import { PageTabs } from "@radarboard/widget-engine/page-tabs";
import { ProjectTabs } from "@radarboard/widget-engine/project-tabs";
import { TopBar } from "@radarboard/widget-engine/top-bar";
import { WidgetSlot } from "@radarboard/widget-engine/widget-slot";
import { WIDGET_REGISTRY } from "@radarboard/widget-engine/widgets/registry";
import { useEffect, useMemo, useState } from "react";
import { BottomTicker } from "../../chrome/bottom-ticker";
import { KPIStrip } from "../../chrome/kpi-strip";
import { WidgetDetailDialog } from "../../widgets/widget-detail-dialog";

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

function buildStackedGridStyle(
  areaNames: string[],
  columns: number,
  rowSize: string,
  showTicker: boolean
) {
  const rows: string[] = [];

  for (let index = 0; index < areaNames.length; index += columns) {
    const row = areaNames.slice(index, index + columns);
    while (row.length < columns) row.push(".");
    rows.push(`"${row.join(" ")}"`);
  }

  if (showTicker) {
    rows.push(`"${Array.from({ length: columns }, () => "ticker").join(" ")}"`);
  }

  return {
    gridTemplateColumns: Array.from({ length: columns }, () => "minmax(0, 1fr)").join(" "),
    gridTemplateRows: `${Array.from({ length: rows.length - (showTicker ? 1 : 0) }, () => rowSize).join(" ")}${showTicker ? " auto" : ""}`,
    gridTemplateAreas: rows.join(" "),
  };
}

function buildGridStyle(
  areaNames: string[],
  colSizes: number[],
  rowSizes: number[],
  viewportWidth: number | null,
  showTicker: boolean
) {
  if (viewportWidth !== null && viewportWidth <= 600) {
    return buildStackedGridStyle(areaNames, 1, "minmax(250px, auto)", showTicker);
  }

  if (viewportWidth !== null && viewportWidth <= 900) {
    return buildStackedGridStyle(areaNames, 2, "minmax(220px, 1fr)", showTicker);
  }

  const tickerArea = `"${Array.from({ length: colSizes.length }, () => "ticker").join(" ")}"`;
  const areas: string[] = [];

  const maxRow = areaNames.length === 0 ? 0 : Math.ceil(areaNames.length / colSizes.length);
  for (let rowIndex = 0; rowIndex < maxRow; rowIndex += 1) {
    const row = areaNames.slice(rowIndex * colSizes.length, (rowIndex + 1) * colSizes.length);
    while (row.length < colSizes.length) row.push(".");
    areas.push(`"${row.join(" ")}"`);
  }

  return {
    gridTemplateColumns: sizesToGridTemplate(colSizes),
    gridTemplateRows: `${sizesToGridTemplate(rowSizes)}${showTicker ? " auto" : ""}`,
    gridTemplateAreas: showTicker ? `${areas.join(" ")} ${tickerArea}` : areas.join(" "),
  };
}

interface DashboardStandaloneProps {
  showDock?: boolean;
  showTopBar?: boolean;
  showProjectTabs?: boolean;
  showPageTabs?: boolean;
  showKpiStrip?: boolean;
  showTicker?: boolean;
}

export function DashboardStandalone({
  showDock = true,
  showTopBar = true,
  showProjectTabs = true,
  showPageTabs = true,
  showKpiStrip = true,
  showTicker = true,
}: DashboardStandaloneProps) {
  const {
    activeLayout,
    activePageSlug,
    activeProjectSlug,
    appearance,
    currencies,
    currency,
    orderedProjects,
    pages,
    projects,
    updateWidgetConfig,
    widgetConfigs,
    setActivePage,
    setActiveProject,
    setCurrency,
    setTimeRange,
    timeRange,
  } = useDashboard();
  const { connectedKeys } = useCredentials();
  const [activePluginId, setActivePluginId] = useState<string | null>(null);
  const [configWidgetId, setConfigWidgetId] = useState<string | null>(null);

  const viewportWidth = useViewportWidth();
  const tickerEnabled = showTicker && (appearance.ticker?.enabled ?? true);
  const activeCells = useMemo(
    () =>
      getSortedCells(activeLayout.cells).map((cell) => ({
        cellId: cell.id,
        areaName: getGridAreaName(cell.id),
      })),
    [activeLayout.cells]
  );

  const gridStyle = useMemo(
    () =>
      buildGridStyle(
        activeCells.map((cell) => cell.areaName),
        resolveColSizes(activeLayout),
        resolveRowSizes(activeLayout),
        viewportWidth,
        tickerEnabled
      ),
    [activeCells, activeLayout, tickerEnabled, viewportWidth]
  );
  const configDescriptor = configWidgetId ? WIDGET_REGISTRY.get(configWidgetId) : null;
  const resolvedConfig =
    configDescriptor != null
      ? ({
          ...configDescriptor.defaultConfig,
          ...(widgetConfigs[configDescriptor.id] ?? {}),
        } as Record<string, unknown>)
      : null;
  const configTitle =
    configDescriptor && resolvedConfig
      ? (configDescriptor.getDisplayName?.({
          projectSlug: activeProjectSlug,
          projects,
          config: resolvedConfig,
        }) ?? configDescriptor.name)
      : null;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-screen w-full flex-col overflow-hidden">
        {showTopBar ? (
          <div className="shrink-0 border-[var(--grid-line)] border-b bg-[var(--widget-bg)]">
            <TopBar
              projectTabsSlot={
                showProjectTabs ? (
                  <ProjectTabs
                    projects={orderedProjects}
                    activeSlug={activeProjectSlug}
                    onSelect={setActiveProject}
                    variant="header"
                  />
                ) : undefined
              }
              timeRange={timeRange}
              currency={currency}
              currencies={currencies}
              showCurrencyToggle={activeProjectSlug !== null}
              onTimeRangeChange={setTimeRange}
              onCurrencyChange={setCurrency}
            />
          </div>
        ) : null}

        {!showTopBar && showProjectTabs ? (
          <div className="shrink-0 border-[var(--grid-line)] border-b bg-[var(--widget-bg)]">
            <ProjectTabs
              projects={orderedProjects}
              activeSlug={activeProjectSlug}
              onSelect={setActiveProject}
            />
          </div>
        ) : null}

        {showPageTabs ? (
          <div className="shrink-0 border-[var(--grid-line)] border-b bg-[var(--widget-bg)]">
            <PageTabs
              pages={pages}
              activeSlug={activePageSlug ?? pages[0]?.slug ?? "overview"}
              onSelect={setActivePage}
            />
          </div>
        ) : null}

        {showKpiStrip ? (
          <div className="dashboard-kpis shrink-0 border-[var(--grid-line)] border-b bg-[var(--widget-bg)]">
            <KPIStrip projectSlug={activeProjectSlug} />
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1 overflow-hidden">
          {showDock ? (
            <PluginSidebar
              activePluginId={activePluginId}
              onLaunch={(pluginId) =>
                setActivePluginId((current) => (current === pluginId ? null : pluginId))
              }
              onOpenPluginSettings={() => undefined}
              onOpenDebug={() => undefined}
              onOpenSettings={() => undefined}
            />
          ) : null}

          <div
            className="dashboard-grid scrollbar-thin h-full min-w-0 flex-1 overflow-y-auto overflow-x-hidden"
            style={gridStyle}
          >
            {activeCells.map((cell) => (
              <WidgetSlot
                key={cell.cellId}
                cellId={cell.cellId}
                style={{ gridArea: cell.areaName }}
                onConfigure={setConfigWidgetId}
              />
            ))}

            {tickerEnabled ? (
              <div className="dashboard-ticker" style={{ gridArea: "ticker" }}>
                <BottomTicker projectSlug={activeProjectSlug} />
              </div>
            ) : null}
          </div>
        </div>

        {configDescriptor && resolvedConfig ? (
          <WidgetDetailDialog
            descriptor={configDescriptor}
            open={configWidgetId !== null}
            onOpenChange={(open) => {
              if (!open) setConfigWidgetId(null);
            }}
            title={configTitle ?? undefined}
            config={resolvedConfig}
            onConfigReplace={(nextConfig) => {
              updateWidgetConfig(configDescriptor.id, nextConfig);
            }}
            onConfigChange={(key, value) => {
              const current = widgetConfigs[configDescriptor.id] ?? {};
              updateWidgetConfig(configDescriptor.id, { ...current, [key]: value });
            }}
            connectedKeys={connectedKeys}
          />
        ) : null}
      </div>
    </TooltipProvider>
  );
}
