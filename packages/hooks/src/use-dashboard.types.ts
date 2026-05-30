import type {
  DashboardLocalePreference,
  DashboardTimezonePreference,
  DisplayCurrency,
  TimeRange,
} from "@radarboard/types/dashboard";
import type {
  AppearanceConfig,
  DashboardPageConfig,
  DashboardPreferencesConfig,
  LayoutDefinition,
  ProjectLayoutConfig,
  WidgetLayoutConfig,
  WidgetModalPrefs,
  WidgetModalSize,
} from "@radarboard/types/database";
import type { DashboardPollingPreferences } from "@radarboard/types/polling";
import type { Project } from "@radarboard/types/project";
import type { ReactNode } from "react";

/** Shape used by the Storybook `DashboardProvider` mock; ignored by the production provider. */
export type DashboardStoryFixture = {
  layoutRecipeId: string;
  projectMode: "single" | "multiple" | "all-projects";
  activeProjectSlug: string | null;
  pageMode: "single" | "multiple";
  tickerEnabled: boolean;
};

export interface DashboardContextValue {
  timeRange: TimeRange;
  timezonePreference: DashboardTimezonePreference;
  localePreference: DashboardLocalePreference;
  effectiveTimezone: string;
  effectiveLocale: string;
  currency: DisplayCurrency;
  activeProjectSlug: string | null;
  activePageSlug: string;
  activePage: DashboardPageConfig;
  pages: DashboardPageConfig[];
  pendingProjectSlug: string | null;
  isProjectSwitching: boolean;
  projects: Project[];
  orderedProjects: Project[];
  projectOrder: string[];
  expandedWidgetId: string | null;
  widgetLayout: Record<string, string | null>;
  widgetConfigs: Record<string, Record<string, unknown>>;
  modalPrefs: WidgetModalPrefs;
  layouts: LayoutDefinition[];
  projectLayouts: Record<string, ProjectLayoutConfig>;
  activeLayout: LayoutDefinition;
  activeLayoutId: string;
  appearance: AppearanceConfig;
  preferences: DashboardPreferencesConfig;
  currencies: DisplayCurrency[];
  pollingPreferences: DashboardPollingPreferences;
  isEditMode: boolean;
  toggleEditMode: () => void;
  updateLayoutSizes: (layoutId: string, colSizes: number[], columnRowSizes: number[][]) => void;
  updateLayouts: (layouts: LayoutDefinition[]) => void;
  updateProjectLayout: (slug: string, config: ProjectLayoutConfig) => void;
  updateProjectPages: (slug: string, pages: DashboardPageConfig[]) => void;
  addProjectPage: (slug: string, page: DashboardPageConfig) => void;
  updateProjectPage: (slug: string, pageSlug: string, page: DashboardPageConfig) => void;
  removeProjectPage: (slug: string, pageSlug: string) => void;
  reorderProjectPages: (slug: string, pages: DashboardPageConfig[]) => void;
  updateProjectPageLayout: (slug: string, pageSlug: string, layoutId: string) => void;
  updateProjectPageWidgetLayout: (
    slug: string,
    pageSlug: string,
    layoutId: string,
    layout: Record<string, string | null>
  ) => void;
  updateProjectWidgetLayout: (
    slug: string,
    layoutId: string,
    layout: Record<string, string | null>
  ) => void;
  updateProjectOrder: (newOrder: string[]) => void;
  setTimeRange: (range: TimeRange) => void;
  setCurrency: (currency: DisplayCurrency) => void;
  setActiveProject: (slug: string | null) => void;
  setActivePage: (slug: string) => void;
  expandWidget: (id: string) => void;
  collapseWidget: () => void;
  updateWidgetLayout: (layout: Record<string, string | null>) => void;
  updateWidgetConfig: (widgetId: string, config: Record<string, unknown>) => void;
  getWidgetModalSize: (
    widgetId: string,
    modalId: string,
    defaultSize: WidgetModalSize
  ) => WidgetModalSize;
  updateWidgetModalSize: (widgetId: string, modalId: string, size: WidgetModalSize) => void;
  updatePreferences: (preferences: DashboardPreferencesConfig) => void;
  updateAppearance: (appearance: AppearanceConfig) => void;
  replaceWidgetLayoutConfig: (config: WidgetLayoutConfig) => void;
}

export interface DashboardProviderProps {
  children: ReactNode;
  /**
   * Storybook-only fixture data. The production provider ignores this; the Storybook app aliases
   * `@radarboard/hooks/use-dashboard` to a mock that reads it.
   */
  fixture?: Partial<DashboardStoryFixture>;
  projects: Project[];
  timeRange?: TimeRange;
  onTimeRangeChange?: (range: TimeRange) => void;
  activeProjectSlug?: string | null;
  activePageSlug?: string | null;
  pendingProjectSlug?: string | null;
  isProjectSwitching?: boolean;
  onActiveProjectChange?: (slug: string | null) => void;
  onActivePageChange?: (slug: string) => void;
  projectOrder?: string[];
  onProjectOrderChange?: (newOrder: string[]) => void;
  widgetLayoutConfig?: WidgetLayoutConfig;
  onWidgetLayoutConfigChange?: (config: WidgetLayoutConfig) => void;
  expandedWidgetId?: string | null;
  onExpandedWidgetIdChange?: (id: string | null) => void;
}
