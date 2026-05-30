"use client";

import { DEFAULT_THEME_FAMILY_ID, DEFAULT_THEME_MODE } from "@radarboard/themes";
import {
  AUTO_LOCALE,
  AUTO_TIMEZONE,
  type DisplayCurrency,
  type TimeRange,
} from "@radarboard/types/dashboard";
import type {
  AppearanceConfig,
  DashboardPreferencesConfig,
  LayoutDefinition,
  ProjectLayoutConfig,
  WidgetLayoutConfig,
  WidgetModalSize,
} from "@radarboard/types/database";
import type { DashboardPollingPreferences } from "@radarboard/types/polling";
import { resolveEffectiveLocale } from "@radarboard/utils/format-date-time";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  DEFAULT_DASHBOARD_LAYOUT,
  resolveDashboardLayoutDefinition,
  resolveDashboardProjectView,
} from "./dashboard-layout";
import type {
  DashboardContextValue,
  DashboardProviderProps,
  DashboardStoryFixture,
} from "./use-dashboard.types";

export type { DashboardStoryFixture };

const EMPTY_PROJECT_ORDER: string[] = [];

import {
  computeOrderedProjects,
  normalizeProjectLayoutsForDefinitions,
  resolveEffectiveTimeZone,
  summarizeColumnRowSizes,
} from "./use-dashboard.utils";
import { useDashboardPageActions } from "./use-dashboard-page-actions";

export const DashboardContext = createContext<DashboardContextValue | null>(null);

function useDashboardProviderState({
  externalActivePageSlug,
  externalActiveProjectSlug,
  externalExpandedWidgetId,
  externalTimeRange,
  onActivePageChange,
  onActiveProjectChange,
  onExpandedWidgetIdChange,
  onTimeRangeChange,
}: {
  externalActivePageSlug: DashboardProviderProps["activePageSlug"];
  externalActiveProjectSlug: DashboardProviderProps["activeProjectSlug"];
  externalExpandedWidgetId: DashboardProviderProps["expandedWidgetId"];
  externalTimeRange: DashboardProviderProps["timeRange"];
  onActivePageChange: DashboardProviderProps["onActivePageChange"];
  onActiveProjectChange: DashboardProviderProps["onActiveProjectChange"];
  onExpandedWidgetIdChange: DashboardProviderProps["onExpandedWidgetIdChange"];
  onTimeRangeChange: DashboardProviderProps["onTimeRangeChange"];
}) {
  const [internalTimeRange, setInternalTimeRange] = useState<TimeRange>("today");
  const [currency, setCurrency] = useState<DisplayCurrency>("USD");
  const [internalActiveProjectSlug, setInternalActiveProjectSlug] = useState<string | null>(null);
  const [internalActivePageSlug, setInternalActivePageSlug] = useState<string | null>(null);
  const [internalExpandedWidgetId, setInternalExpandedWidgetId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  const isActiveProjectControlled = externalActiveProjectSlug !== undefined;
  const isActivePageControlled = externalActivePageSlug !== undefined;
  const isTimeRangeControlled = externalTimeRange !== undefined;

  const timeRange = externalTimeRange ?? internalTimeRange;
  const activeProjectSlug = isActiveProjectControlled
    ? externalActiveProjectSlug
    : internalActiveProjectSlug;
  const requestedActivePageSlug = isActivePageControlled
    ? externalActivePageSlug
    : internalActivePageSlug;
  const expandedWidgetId =
    externalExpandedWidgetId !== undefined ? externalExpandedWidgetId : internalExpandedWidgetId;

  const setTimeRange = useCallback(
    (range: TimeRange) => {
      onTimeRangeChange?.(range);
      if (!isTimeRangeControlled) {
        setInternalTimeRange(range);
      }
    },
    [isTimeRangeControlled, onTimeRangeChange]
  );

  const setActiveProject = useCallback(
    (slug: string | null) => {
      onActiveProjectChange?.(slug);
      if (!isActiveProjectControlled) {
        setInternalActiveProjectSlug(slug);
      }
    },
    [isActiveProjectControlled, onActiveProjectChange]
  );

  const setActivePage = useCallback(
    (slug: string) => {
      onActivePageChange?.(slug);
      if (!isActivePageControlled) {
        setInternalActivePageSlug(slug);
      }
    },
    [isActivePageControlled, onActivePageChange]
  );

  const expandWidget = useCallback(
    (id: string) => {
      if (onExpandedWidgetIdChange) {
        onExpandedWidgetIdChange(id);
      } else {
        setInternalExpandedWidgetId(id);
      }
    },
    [onExpandedWidgetIdChange]
  );

  const collapseWidget = useCallback(() => {
    if (onExpandedWidgetIdChange) {
      onExpandedWidgetIdChange(null);
    } else {
      setInternalExpandedWidgetId(null);
    }
  }, [onExpandedWidgetIdChange]);

  const toggleEditMode = useCallback(() => {
    setIsEditMode((prev) => !prev);
  }, []);

  return {
    activeProjectSlug,
    collapseWidget,
    currency,
    expandWidget,
    expandedWidgetId,
    isEditMode,
    requestedActivePageSlug,
    setActivePage,
    setActiveProject,
    setCurrency,
    setTimeRange,
    timeRange,
    toggleEditMode,
  };
}

function useDashboardResolvedConfig({
  activeProjectSlug,
  externalProjectOrder,
  projects,
  requestedActivePageSlug,
  widgetLayoutConfig,
}: {
  activeProjectSlug: string | null;
  externalProjectOrder: string[];
  projects: DashboardProviderProps["projects"];
  requestedActivePageSlug: string | null;
  widgetLayoutConfig: DashboardProviderProps["widgetLayoutConfig"];
}) {
  const orderedProjects = useMemo(
    () => computeOrderedProjects(projects, externalProjectOrder),
    [projects, externalProjectOrder]
  );
  const widgetConfigs = useMemo(
    () => widgetLayoutConfig?.configs ?? {},
    [widgetLayoutConfig?.configs]
  );
  const modalPrefs = useMemo(
    () => widgetLayoutConfig?.modalPrefs ?? {},
    [widgetLayoutConfig?.modalPrefs]
  );
  const layouts = useMemo<LayoutDefinition[]>(
    () => widgetLayoutConfig?.layouts ?? [],
    [widgetLayoutConfig?.layouts]
  );
  const projectLayouts = useMemo<Record<string, ProjectLayoutConfig>>(
    () => widgetLayoutConfig?.projectLayouts ?? {},
    [widgetLayoutConfig?.projectLayouts]
  );
  const activeProjectView = useMemo(
    () =>
      resolveDashboardProjectView({
        layouts: widgetLayoutConfig?.layouts,
        projectLayouts: widgetLayoutConfig?.projectLayouts,
        projectSlug: activeProjectSlug,
        pageSlug: requestedActivePageSlug,
      }),
    [
      widgetLayoutConfig?.layouts,
      widgetLayoutConfig?.projectLayouts,
      activeProjectSlug,
      requestedActivePageSlug,
    ]
  );
  const appearance = useMemo<AppearanceConfig>(
    () =>
      widgetLayoutConfig?.appearance ?? {
        fontScale: "md",
        themeFamilyId: DEFAULT_THEME_FAMILY_ID,
        themeMode: DEFAULT_THEME_MODE,
      },
    [widgetLayoutConfig?.appearance]
  );
  const preferences = useMemo<DashboardPreferencesConfig>(
    () =>
      widgetLayoutConfig?.preferences ?? {
        timezone: AUTO_TIMEZONE,
        locale: AUTO_LOCALE,
        polling: {},
      },
    [widgetLayoutConfig?.preferences]
  );

  return {
    activeProjectView,
    appearance,
    layouts,
    modalPrefs,
    orderedProjects,
    preferences,
    projectLayouts,
    widgetConfigs,
  };
}

function useDashboardMutationCallbacks({
  activeConfigOwnerSlug,
  activeLayoutId,
  activePageSlug,
  modalPrefs,
  onProjectOrderChange,
  onWidgetLayoutConfigChange,
  updateProjectPageWidgetLayout,
  widgetLayoutConfig,
}: {
  activeConfigOwnerSlug: string;
  activeLayoutId: string;
  activePageSlug: string;
  modalPrefs: Record<string, Record<string, WidgetModalSize>>;
  onProjectOrderChange: DashboardProviderProps["onProjectOrderChange"];
  onWidgetLayoutConfigChange: DashboardProviderProps["onWidgetLayoutConfigChange"];
  updateProjectPageWidgetLayout: DashboardContextValue["updateProjectPageWidgetLayout"];
  widgetLayoutConfig: DashboardProviderProps["widgetLayoutConfig"];
}) {
  const updateProjectOrder = useCallback(
    (newOrder: string[]) => {
      onProjectOrderChange?.(newOrder);
    },
    [onProjectOrderChange]
  );

  const updateLayouts = useCallback(
    (newLayouts: LayoutDefinition[]) => {
      onWidgetLayoutConfigChange?.({
        configs: widgetLayoutConfig?.configs ?? {},
        modalPrefs: widgetLayoutConfig?.modalPrefs ?? {},
        layouts: newLayouts,
        projectLayouts: normalizeProjectLayoutsForDefinitions(
          newLayouts,
          widgetLayoutConfig?.projectLayouts,
          widgetLayoutConfig?.layouts
        ),
        preferences: widgetLayoutConfig?.preferences,
        appearance: widgetLayoutConfig?.appearance,
      });
    },
    [onWidgetLayoutConfigChange, widgetLayoutConfig]
  );

  const updateProjectLayout = useCallback(
    (slug: string, config: ProjectLayoutConfig) => {
      onWidgetLayoutConfigChange?.({
        configs: widgetLayoutConfig?.configs ?? {},
        modalPrefs: widgetLayoutConfig?.modalPrefs ?? {},
        layouts: widgetLayoutConfig?.layouts,
        projectLayouts: { ...(widgetLayoutConfig?.projectLayouts ?? {}), [slug]: config },
        preferences: widgetLayoutConfig?.preferences,
        appearance: widgetLayoutConfig?.appearance,
      });
    },
    [onWidgetLayoutConfigChange, widgetLayoutConfig]
  );

  const updateLayoutSizes = useCallback(
    (layoutId: string, colSizes: number[], columnRowSizes: number[][]) => {
      const currentLayouts = widgetLayoutConfig?.layouts ?? [DEFAULT_DASHBOARD_LAYOUT];
      const resolvedLayout = resolveDashboardLayoutDefinition(currentLayouts, layoutId);
      const hasLayout = currentLayouts.some((layout) => layout.id === resolvedLayout.id);
      const baseLayouts = hasLayout ? currentLayouts : [...currentLayouts, resolvedLayout];
      const updatedLayouts = baseLayouts.map((layout) =>
        layout.id === resolvedLayout.id
          ? {
              ...layout,
              colSizes,
              rowSizes: summarizeColumnRowSizes(columnRowSizes),
              columnRowSizes,
            }
          : layout
      );
      onWidgetLayoutConfigChange?.({
        configs: widgetLayoutConfig?.configs ?? {},
        modalPrefs: widgetLayoutConfig?.modalPrefs ?? {},
        layouts: updatedLayouts,
        projectLayouts: normalizeProjectLayoutsForDefinitions(
          updatedLayouts,
          widgetLayoutConfig?.projectLayouts,
          currentLayouts
        ),
        preferences: widgetLayoutConfig?.preferences,
        appearance: widgetLayoutConfig?.appearance,
      });
    },
    [onWidgetLayoutConfigChange, widgetLayoutConfig]
  );

  const updateWidgetLayout = useCallback(
    (layout: Record<string, string | null>) => {
      updateProjectPageWidgetLayout(activeConfigOwnerSlug, activePageSlug, activeLayoutId, layout);
    },
    [activeConfigOwnerSlug, activeLayoutId, activePageSlug, updateProjectPageWidgetLayout]
  );

  const updateWidgetConfig = useCallback(
    (widgetId: string, config: Record<string, unknown>) => {
      onWidgetLayoutConfigChange?.({
        configs: { ...(widgetLayoutConfig?.configs ?? {}), [widgetId]: config },
        modalPrefs: widgetLayoutConfig?.modalPrefs ?? {},
        layouts: widgetLayoutConfig?.layouts,
        projectLayouts: widgetLayoutConfig?.projectLayouts,
        preferences: widgetLayoutConfig?.preferences,
        appearance: widgetLayoutConfig?.appearance,
      });
    },
    [onWidgetLayoutConfigChange, widgetLayoutConfig]
  );

  const getWidgetModalSize = useCallback(
    (widgetId: string, modalId: string, defaultSize: WidgetModalSize): WidgetModalSize =>
      modalPrefs[widgetId]?.[modalId] ?? defaultSize,
    [modalPrefs]
  );

  const updateWidgetModalSize = useCallback(
    (widgetId: string, modalId: string, size: WidgetModalSize) => {
      const currentWidgetPrefs = widgetLayoutConfig?.modalPrefs?.[widgetId] ?? {};
      if (currentWidgetPrefs[modalId] === size) return;

      onWidgetLayoutConfigChange?.({
        configs: widgetLayoutConfig?.configs ?? {},
        modalPrefs: {
          ...(widgetLayoutConfig?.modalPrefs ?? {}),
          [widgetId]: {
            ...currentWidgetPrefs,
            [modalId]: size,
          },
        },
        layouts: widgetLayoutConfig?.layouts,
        projectLayouts: widgetLayoutConfig?.projectLayouts,
        preferences: widgetLayoutConfig?.preferences,
        appearance: widgetLayoutConfig?.appearance,
      });
    },
    [onWidgetLayoutConfigChange, widgetLayoutConfig]
  );

  const updatePreferences = useCallback(
    (newPreferences: DashboardPreferencesConfig) => {
      onWidgetLayoutConfigChange?.({
        configs: widgetLayoutConfig?.configs ?? {},
        modalPrefs: widgetLayoutConfig?.modalPrefs ?? {},
        layouts: widgetLayoutConfig?.layouts,
        projectLayouts: widgetLayoutConfig?.projectLayouts,
        preferences: {
          ...(widgetLayoutConfig?.preferences ?? {}),
          ...newPreferences,
        },
        appearance: widgetLayoutConfig?.appearance,
      });
    },
    [onWidgetLayoutConfigChange, widgetLayoutConfig]
  );

  const updateAppearance = useCallback(
    (newAppearance: AppearanceConfig) => {
      onWidgetLayoutConfigChange?.({
        configs: widgetLayoutConfig?.configs ?? {},
        modalPrefs: widgetLayoutConfig?.modalPrefs ?? {},
        layouts: widgetLayoutConfig?.layouts,
        projectLayouts: widgetLayoutConfig?.projectLayouts,
        preferences: widgetLayoutConfig?.preferences,
        appearance: newAppearance,
      });
    },
    [onWidgetLayoutConfigChange, widgetLayoutConfig]
  );

  const replaceWidgetLayoutConfig = useCallback(
    (config: WidgetLayoutConfig) => {
      onWidgetLayoutConfigChange?.(config);
    },
    [onWidgetLayoutConfigChange]
  );

  return {
    getWidgetModalSize,
    replaceWidgetLayoutConfig,
    updateAppearance,
    updateLayoutSizes,
    updateLayouts,
    updatePreferences,
    updateProjectLayout,
    updateProjectOrder,
    updateWidgetConfig,
    updateWidgetLayout,
    updateWidgetModalSize,
  };
}

function useDashboardContextValue(params: {
  activeLayout: LayoutDefinition;
  activeLayoutId: string;
  activePage: DashboardContextValue["activePage"];
  activePageSlug: string;
  activeProjectSlug: string | null;
  addProjectPage: DashboardContextValue["addProjectPage"];
  appearance: AppearanceConfig;
  collapseWidget: DashboardContextValue["collapseWidget"];
  currencies: DisplayCurrency[];
  currency: DisplayCurrency;
  effectiveLocale: string;
  effectiveTimezone: string;
  expandWidget: DashboardContextValue["expandWidget"];
  expandedWidgetId: string | null;
  externalProjectOrder: string[];
  getWidgetModalSize: DashboardContextValue["getWidgetModalSize"];
  isEditMode: boolean;
  isProjectSwitching: boolean;
  layouts: LayoutDefinition[];
  localePreference: string;
  modalPrefs: Record<string, Record<string, WidgetModalSize>>;
  orderedProjects: DashboardProviderProps["projects"];
  pages: DashboardContextValue["pages"];
  pendingProjectSlug: string | null;
  pollingPreferences: DashboardPollingPreferences;
  preferences: DashboardPreferencesConfig;
  projectLayouts: Record<string, ProjectLayoutConfig>;
  projects: DashboardProviderProps["projects"];
  removeProjectPage: DashboardContextValue["removeProjectPage"];
  reorderProjectPages: DashboardContextValue["reorderProjectPages"];
  replaceWidgetLayoutConfig: DashboardContextValue["replaceWidgetLayoutConfig"];
  setActivePage: DashboardContextValue["setActivePage"];
  setActiveProject: DashboardContextValue["setActiveProject"];
  setCurrency: React.Dispatch<React.SetStateAction<DisplayCurrency>>;
  setTimeRange: DashboardContextValue["setTimeRange"];
  timeRange: TimeRange;
  timezonePreference: string;
  toggleEditMode: DashboardContextValue["toggleEditMode"];
  updateAppearance: DashboardContextValue["updateAppearance"];
  updateLayoutSizes: DashboardContextValue["updateLayoutSizes"];
  updateLayouts: DashboardContextValue["updateLayouts"];
  updatePreferences: DashboardContextValue["updatePreferences"];
  updateProjectLayout: DashboardContextValue["updateProjectLayout"];
  updateProjectOrder: DashboardContextValue["updateProjectOrder"];
  updateProjectPage: DashboardContextValue["updateProjectPage"];
  updateProjectPageLayout: DashboardContextValue["updateProjectPageLayout"];
  updateProjectPageWidgetLayout: DashboardContextValue["updateProjectPageWidgetLayout"];
  updateProjectPages: DashboardContextValue["updateProjectPages"];
  updateProjectWidgetLayout: DashboardContextValue["updateProjectWidgetLayout"];
  updateWidgetConfig: DashboardContextValue["updateWidgetConfig"];
  updateWidgetLayout: DashboardContextValue["updateWidgetLayout"];
  updateWidgetModalSize: DashboardContextValue["updateWidgetModalSize"];
  widgetConfigs: Record<string, Record<string, unknown>>;
  widgetLayout: Record<string, string | null>;
}) {
  const {
    activeLayout,
    activeLayoutId,
    activePage,
    activePageSlug,
    activeProjectSlug,
    addProjectPage,
    appearance,
    collapseWidget,
    currencies,
    currency,
    effectiveLocale,
    effectiveTimezone,
    expandWidget,
    expandedWidgetId,
    externalProjectOrder,
    getWidgetModalSize,
    isEditMode,
    isProjectSwitching,
    layouts,
    localePreference,
    modalPrefs,
    orderedProjects,
    pages,
    pendingProjectSlug,
    pollingPreferences,
    preferences,
    projectLayouts,
    projects,
    removeProjectPage,
    reorderProjectPages,
    replaceWidgetLayoutConfig,
    setActivePage,
    setActiveProject,
    setCurrency,
    setTimeRange,
    timeRange,
    timezonePreference,
    toggleEditMode,
    updateAppearance,
    updateLayoutSizes,
    updateLayouts,
    updatePreferences,
    updateProjectLayout,
    updateProjectOrder,
    updateProjectPage,
    updateProjectPageLayout,
    updateProjectPageWidgetLayout,
    updateProjectPages,
    updateProjectWidgetLayout,
    updateWidgetConfig,
    updateWidgetLayout,
    updateWidgetModalSize,
    widgetConfigs,
    widgetLayout,
  } = params;

  return useMemo<DashboardContextValue>(
    () => ({
      timeRange,
      timezonePreference,
      localePreference,
      effectiveTimezone,
      effectiveLocale,
      currency,
      activeProjectSlug,
      activePageSlug,
      activePage,
      pages,
      pendingProjectSlug,
      isProjectSwitching,
      projects,
      orderedProjects,
      projectOrder: externalProjectOrder ?? EMPTY_PROJECT_ORDER,
      expandedWidgetId,
      widgetLayout,
      widgetConfigs,
      modalPrefs,
      layouts,
      projectLayouts,
      activeLayout,
      activeLayoutId,
      appearance,
      preferences,
      currencies,
      pollingPreferences,
      isEditMode,
      toggleEditMode,
      updateLayoutSizes,
      updateLayouts,
      updateProjectLayout,
      updateProjectPages,
      addProjectPage,
      updateProjectPage,
      removeProjectPage,
      reorderProjectPages,
      updateProjectPageLayout,
      updateProjectPageWidgetLayout,
      updateProjectWidgetLayout,
      updateProjectOrder,
      setTimeRange,
      setCurrency,
      setActiveProject,
      setActivePage,
      expandWidget,
      collapseWidget,
      updateWidgetLayout,
      updateWidgetConfig,
      getWidgetModalSize,
      updateWidgetModalSize,
      updatePreferences,
      updateAppearance,
      replaceWidgetLayoutConfig,
    }),
    [
      timeRange,
      timezonePreference,
      localePreference,
      effectiveTimezone,
      effectiveLocale,
      currency,
      activeProjectSlug,
      activePageSlug,
      activePage,
      pages,
      pendingProjectSlug,
      isProjectSwitching,
      projects,
      orderedProjects,
      externalProjectOrder,
      expandedWidgetId,
      widgetLayout,
      widgetConfigs,
      modalPrefs,
      layouts,
      projectLayouts,
      activeLayout,
      activeLayoutId,
      appearance,
      preferences,
      currencies,
      pollingPreferences,
      isEditMode,
      toggleEditMode,
      updateLayoutSizes,
      updateLayouts,
      updateProjectLayout,
      updateProjectPages,
      addProjectPage,
      updateProjectPage,
      removeProjectPage,
      reorderProjectPages,
      updateProjectPageLayout,
      updateProjectPageWidgetLayout,
      updateProjectWidgetLayout,
      updateProjectOrder,
      setTimeRange,
      setCurrency,
      setActiveProject,
      setActivePage,
      expandWidget,
      collapseWidget,
      updateWidgetLayout,
      updateWidgetConfig,
      getWidgetModalSize,
      updateWidgetModalSize,
      updatePreferences,
      updateAppearance,
      replaceWidgetLayoutConfig,
    ]
  );
}

export function DashboardProvider({
  children,
  projects,
  timeRange: externalTimeRange,
  onTimeRangeChange,
  activeProjectSlug: externalActiveProjectSlug,
  activePageSlug: externalActivePageSlug,
  pendingProjectSlug: externalPendingProjectSlug,
  isProjectSwitching: externalIsProjectSwitching,
  onActiveProjectChange,
  onActivePageChange,
  projectOrder: externalProjectOrder = EMPTY_PROJECT_ORDER,
  onProjectOrderChange,
  widgetLayoutConfig,
  onWidgetLayoutConfigChange,
  expandedWidgetId: externalExpandedWidgetId,
  onExpandedWidgetIdChange,
}: DashboardProviderProps) {
  const {
    activeProjectSlug,
    collapseWidget,
    currency,
    expandWidget,
    expandedWidgetId,
    isEditMode,
    requestedActivePageSlug,
    setActivePage,
    setActiveProject,
    setCurrency,
    setTimeRange,
    timeRange,
    toggleEditMode,
  } = useDashboardProviderState({
    externalActivePageSlug,
    externalActiveProjectSlug,
    externalExpandedWidgetId,
    externalTimeRange,
    onActivePageChange,
    onActiveProjectChange,
    onExpandedWidgetIdChange,
    onTimeRangeChange,
  });
  const pendingProjectSlug = externalPendingProjectSlug ?? null;
  const isProjectSwitching = externalIsProjectSwitching ?? false;

  const {
    activeProjectView,
    appearance,
    layouts,
    modalPrefs,
    orderedProjects,
    preferences,
    projectLayouts,
    widgetConfigs,
  } = useDashboardResolvedConfig({
    activeProjectSlug,
    externalProjectOrder,
    projects,
    requestedActivePageSlug,
    widgetLayoutConfig,
  });

  const activeConfigOwnerSlug = activeProjectView.configOwnerSlug;
  const timezonePreference = preferences.timezone ?? AUTO_TIMEZONE;
  const localePreference = preferences.locale ?? AUTO_LOCALE;
  const pollingPreferences: DashboardPollingPreferences = preferences.polling ?? {};
  const currencies = useMemo<DisplayCurrency[]>(
    () => preferences.currencies ?? ["USD"],
    [preferences.currencies]
  );
  const effectiveTimezone = useMemo(
    () => resolveEffectiveTimeZone(timezonePreference),
    [timezonePreference]
  );
  const effectiveLocale = useMemo(
    () => resolveEffectiveLocale(localePreference),
    [localePreference]
  );
  const {
    addProjectPage,
    removeProjectPage,
    reorderProjectPages,
    updateProjectPage,
    updateProjectPageLayout,
    updateProjectPageWidgetLayout,
    updateProjectPages,
    updateProjectWidgetLayout,
  } = useDashboardPageActions({
    onWidgetLayoutConfigChange,
    widgetLayoutConfig,
  });

  // --- Active layout resolution ---

  const pages = activeProjectView.pages;
  const activePage = activeProjectView.activePage;
  const activePageSlug = activeProjectView.activePageSlug;
  const activeLayoutId = activeProjectView.layoutId;
  const widgetLayout = activeProjectView.widgetLayout;
  const activeLayout = activeProjectView.layout;

  const {
    getWidgetModalSize,
    replaceWidgetLayoutConfig,
    updateAppearance,
    updateLayoutSizes,
    updateLayouts,
    updatePreferences,
    updateProjectLayout,
    updateProjectOrder,
    updateWidgetConfig,
    updateWidgetLayout,
    updateWidgetModalSize,
  } = useDashboardMutationCallbacks({
    activeConfigOwnerSlug,
    activeLayoutId,
    activePageSlug,
    modalPrefs,
    onProjectOrderChange,
    onWidgetLayoutConfigChange,
    updateProjectPageWidgetLayout,
    widgetLayoutConfig,
  });

  const value = useDashboardContextValue({
    activeLayout,
    activeLayoutId,
    activePage,
    activePageSlug,
    activeProjectSlug,
    addProjectPage,
    appearance,
    collapseWidget,
    currencies,
    currency,
    effectiveLocale,
    effectiveTimezone,
    expandWidget,
    expandedWidgetId,
    externalProjectOrder,
    getWidgetModalSize,
    isEditMode,
    isProjectSwitching,
    layouts,
    localePreference,
    modalPrefs,
    orderedProjects,
    pages,
    pendingProjectSlug,
    pollingPreferences,
    preferences,
    projectLayouts,
    projects,
    removeProjectPage,
    reorderProjectPages,
    replaceWidgetLayoutConfig,
    setActivePage,
    setActiveProject,
    setCurrency,
    setTimeRange,
    timeRange,
    timezonePreference,
    toggleEditMode,
    updateAppearance,
    updateLayoutSizes,
    updateLayouts,
    updatePreferences,
    updateProjectLayout,
    updateProjectOrder,
    updateProjectPage,
    updateProjectPageLayout,
    updateProjectPageWidgetLayout,
    updateProjectPages,
    updateProjectWidgetLayout,
    updateWidgetConfig,
    updateWidgetLayout,
    updateWidgetModalSize,
    widgetConfigs,
    widgetLayout,
  });

  return <DashboardContext value={value}>{children}</DashboardContext>;
}

export function useDashboard(): DashboardContextValue {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error("useDashboard must be used within a DashboardProvider");
  }
  return context;
}
