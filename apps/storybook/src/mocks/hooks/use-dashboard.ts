import type { Project } from "@radarboard/types/project";
import { LAYOUT_RECIPES } from "@radarboard/widget-engine/layout-recipe-gallery";
import {
  createContext,
  createElement,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const ALL_PROJECTS_SLUG = "__all__";
const SAMPLE_WIDGET_IDS = [
  "revenue",
  "shipping",
  "downloads",
  "stars",
  "pulls",
  "seo",
  "domains",
  "builds",
  "observability",
] as const;

type LayoutDefinition = {
  id: string;
  name: string;
  cells: Array<{
    id: string;
    rowStart: number;
    colStart: number;
    rowSpan: number;
    colSpan: number;
  }>;
  colSizes?: number[];
  rowSizes?: number[];
  columnRowSizes?: number[][];
};

type DashboardPageConfig = {
  name: string;
  slug: string;
  layoutId?: string;
  widgetLayouts?: Record<string, Record<string, string | null>>;
};

type ProjectLayoutConfig = {
  pages?: DashboardPageConfig[];
};

type WidgetModalPrefs = Record<string, unknown>;
type DashboardPollingPreferences = Record<string, number>;

type AppearanceConfig = {
  fontScale: "sm" | "md" | "lg";
  ticker: {
    enabled: boolean;
    speed: "slow" | "normal" | "fast";
    sources: {
      github: boolean;
      linear: boolean;
      vercel: boolean;
      manual: boolean;
    };
  };
};

type DashboardPreferencesConfig = {
  timezone: string;
  locale: string;
  currency: string;
  density: string;
};

export type DashboardStoryFixture = {
  layoutRecipeId: string;
  projectMode: "single" | "multiple" | "all-projects";
  activeProjectSlug: string | null;
  pageMode: "single" | "multiple";
  tickerEnabled: boolean;
};

const DEFAULT_FIXTURE: DashboardStoryFixture = {
  layoutRecipeId: "basic-3x3",
  projectMode: "single",
  activeProjectSlug: "radarboard",
  pageMode: "single",
  tickerEnabled: true,
};

const DEFAULT_APPEARANCE: AppearanceConfig = {
  fontScale: "md",
  ticker: {
    enabled: true,
    speed: "normal",
    sources: {
      github: true,
      linear: true,
      vercel: true,
      manual: true,
    },
  },
};

const DEFAULT_PREFERENCES: DashboardPreferencesConfig = {
  timezone: "UTC",
  locale: "en-US",
  currency: "usd",
  density: "comfortable",
};

const DEFAULT_POLLING_PREFERENCES: DashboardPollingPreferences = {};
const DEFAULT_MODAL_PREFS: WidgetModalPrefs = {};

function buildProjects(mode: DashboardStoryFixture["projectMode"]): Project[] {
  const allProjects: Project[] = [
    {
      id: "project-radarboard",
      slug: "radarboard",
      name: "Radarboard",
      color: "var(--color-accent)",
      platforms: [
        {
          id: "platform-radarboard-web",
          name: "Radarboard Web",
          type: "web_app",
          integrations: {},
        },
      ],
    },
    {
      id: "project-launchpad",
      slug: "launchpad",
      name: "Launchpad",
      color: "var(--color-success)",
      platforms: [
        {
          id: "platform-launchpad-web",
          name: "Launchpad Web",
          type: "web_app",
          integrations: {},
        },
      ],
    },
    {
      id: "project-backlog",
      slug: "backlog",
      name: "Backlog",
      color: "var(--color-warning)",
      platforms: [
        {
          id: "platform-backlog-web",
          name: "Backlog Web",
          type: "web_app",
          integrations: {},
        },
      ],
    },
  ];

  if (mode === "single") {
    return [allProjects[0] as Project];
  }

  return allProjects;
}

function buildWidgetLayout(layout: LayoutDefinition) {
  return Object.fromEntries(
    layout.cells.map((cell, index) => [
      cell.id,
      SAMPLE_WIDGET_IDS[index % SAMPLE_WIDGET_IDS.length],
    ])
  ) as Record<string, string | null>;
}

function buildPages(
  layoutId: string,
  mode: DashboardStoryFixture["pageMode"]
): DashboardPageConfig[] {
  const pageNames =
    mode === "multiple"
      ? [
          { name: "Overview", slug: "overview" },
          { name: "Signals", slug: "signals" },
          { name: "Backlog", slug: "backlog" },
        ]
      : [{ name: "Overview", slug: "overview" }];

  return pageNames.map((page) => ({
    ...page,
    layoutId,
    widgetLayouts: {
      [layoutId]: {},
    },
  }));
}

function resolveFixture(fixture?: Partial<DashboardStoryFixture>): DashboardStoryFixture {
  return {
    ...DEFAULT_FIXTURE,
    ...fixture,
  };
}

function getInitialActiveProjectSlug(
  fixture: DashboardStoryFixture,
  projects: Project[]
): string | null {
  if (fixture.projectMode === "all-projects" || fixture.activeProjectSlug === ALL_PROJECTS_SLUG) {
    return null;
  }

  return projects.some((project) => project.slug === fixture.activeProjectSlug)
    ? fixture.activeProjectSlug
    : (projects[0]?.slug ?? null);
}

type DashboardContextValue = {
  timeRange: "today";
  timezonePreference: string;
  localePreference: string;
  effectiveTimezone: string;
  effectiveLocale: string;
  currency: "usd";
  currencies: ["USD", "CAD"];
  activeProjectSlug: string | null;
  activePageSlug: string;
  activePage: import("@radarboard/types/database").DashboardPageConfig;
  pages: DashboardPageConfig[];
  pendingProjectSlug: null;
  isProjectSwitching: false;
  projects: Project[];
  orderedProjects: Project[];
  projectOrder: string[];
  expandedWidgetId: null;
  widgetLayout: Record<string, string | null>;
  widgetConfigs: Record<string, unknown>;
  modalPrefs: WidgetModalPrefs;
  layouts: LayoutDefinition[];
  projectLayouts: Record<string, ProjectLayoutConfig>;
  activeLayout: LayoutDefinition;
  activeLayoutId: string;
  appearance: AppearanceConfig;
  preferences: DashboardPreferencesConfig;
  pollingPreferences: DashboardPollingPreferences;
  isEditMode: false;
  toggleEditMode: () => void;
  updateLayoutSizes: () => void;
  updateLayouts: () => void;
  updateProjectLayout: () => void;
  updateProjectPages: () => void;
  addProjectPage: () => void;
  updateProjectPage: () => void;
  removeProjectPage: () => void;
  reorderProjectPages: () => void;
  updateProjectPageLayout: () => void;
  updateProjectPageWidgetLayout: () => void;
  updateProjectWidgetLayout: () => void;
  updateProjectOrder: () => void;
  setTimeRange: () => void;
  setCurrency: () => void;
  setActiveProject: (slug: string | null) => void;
  setActivePage: (slug: string) => void;
  expandWidget: () => void;
  collapseWidget: () => void;
  updateWidgetLayout: (layout: Record<string, string | null>) => void;
  updateWidgetConfig: () => void;
  getWidgetModalSize: (
    widgetId: string,
    modalId: string,
    defaultSize: "sm" | "content" | "md" | "lg" | "xl"
  ) => "sm" | "content" | "md" | "lg" | "xl";
  updateWidgetModalSize: () => void;
  updatePreferences: () => void;
  updateAppearance: () => void;
};

const defaultLayout =
  (LAYOUT_RECIPES.find((recipe) => recipe.id === DEFAULT_FIXTURE.layoutRecipeId)?.layout as
    | LayoutDefinition
    | undefined) ?? (LAYOUT_RECIPES[0]?.layout as LayoutDefinition);
const defaultProjects = buildProjects(DEFAULT_FIXTURE.projectMode);
const defaultPages = buildPages(defaultLayout.id, DEFAULT_FIXTURE.pageMode);
const defaultWidgetLayout = buildWidgetLayout(defaultLayout);

const defaultDashboardValue: DashboardContextValue = {
  timeRange: "today",
  timezonePreference: "UTC",
  localePreference: "en-US",
  effectiveTimezone: "UTC",
  effectiveLocale: "en-US",
  currency: "usd",
  currencies: ["USD", "CAD"],
  activeProjectSlug: getInitialActiveProjectSlug(DEFAULT_FIXTURE, defaultProjects),
  activePageSlug: defaultPages[0]?.slug ?? "overview",
  activePage: defaultPages[0] as import("@radarboard/types/database").DashboardPageConfig,
  pages: defaultPages,
  pendingProjectSlug: null,
  isProjectSwitching: false,
  projects: defaultProjects,
  orderedProjects: defaultProjects,
  projectOrder: defaultProjects.map((project) => project.slug),
  expandedWidgetId: null,
  widgetLayout: defaultWidgetLayout,
  widgetConfigs: {},
  modalPrefs: DEFAULT_MODAL_PREFS,
  layouts: LAYOUT_RECIPES.map((recipe) => recipe.layout as LayoutDefinition),
  projectLayouts: {
    [ALL_PROJECTS_SLUG]: { pages: defaultPages },
    radarboard: { pages: defaultPages },
  },
  activeLayout: defaultLayout,
  activeLayoutId: defaultLayout.id,
  appearance: DEFAULT_APPEARANCE,
  preferences: DEFAULT_PREFERENCES,
  pollingPreferences: DEFAULT_POLLING_PREFERENCES,
  isEditMode: false,
  toggleEditMode: () => undefined,
  updateLayoutSizes: () => undefined,
  updateLayouts: () => undefined,
  updateProjectLayout: () => undefined,
  updateProjectPages: () => undefined,
  addProjectPage: () => undefined,
  updateProjectPage: () => undefined,
  removeProjectPage: () => undefined,
  reorderProjectPages: () => undefined,
  updateProjectPageLayout: () => undefined,
  updateProjectPageWidgetLayout: () => undefined,
  updateProjectWidgetLayout: () => undefined,
  updateProjectOrder: () => undefined,
  setTimeRange: () => undefined,
  setCurrency: () => undefined,
  setActiveProject: () => undefined,
  setActivePage: () => undefined,
  expandWidget: () => undefined,
  collapseWidget: () => undefined,
  updateWidgetLayout: () => undefined,
  updateWidgetConfig: () => undefined,
  getWidgetModalSize: (_widgetId, _modalId, defaultSize) => defaultSize,
  updateWidgetModalSize: () => undefined,
  updatePreferences: () => undefined,
  updateAppearance: () => undefined,
};

export const DashboardContext = createContext<DashboardContextValue>(defaultDashboardValue);

export function useDashboard() {
  return useContext(DashboardContext);
}

export function DashboardProvider({
  children,
  fixture,
}: {
  children: ReactNode;
  fixture?: Partial<DashboardStoryFixture>;
}) {
  const resolvedFixture = resolveFixture(fixture);
  const layouts = useMemo(
    () => LAYOUT_RECIPES.map((recipe) => recipe.layout as LayoutDefinition),
    []
  );
  const activeLayout = useMemo(
    () => layouts.find((layout) => layout.id === resolvedFixture.layoutRecipeId) ?? defaultLayout,
    [layouts, resolvedFixture.layoutRecipeId]
  );
  const projects = useMemo(
    () => buildProjects(resolvedFixture.projectMode),
    [resolvedFixture.projectMode]
  );
  const pages = useMemo(
    () => buildPages(activeLayout.id, resolvedFixture.pageMode),
    [activeLayout.id, resolvedFixture.pageMode]
  );
  const projectLayouts = useMemo(
    () =>
      Object.fromEntries([
        [ALL_PROJECTS_SLUG, { pages }],
        ...projects.map((project) => [project.slug, { pages }]),
      ]) as Record<string, ProjectLayoutConfig>,
    [pages, projects]
  );
  const defaultActiveProjectSlug = useMemo(
    () => getInitialActiveProjectSlug(resolvedFixture, projects),
    [projects, resolvedFixture]
  );
  const defaultWidgetLayout = useMemo(() => buildWidgetLayout(activeLayout), [activeLayout]);
  const [activeProjectSlug, setActiveProjectSlug] = useState<string | null>(
    defaultActiveProjectSlug
  );
  const [activePageSlug, setActivePageSlug] = useState<string>(pages[0]?.slug ?? "overview");
  const [widgetLayout, setWidgetLayout] =
    useState<Record<string, string | null>>(defaultWidgetLayout);
  const [currency, setCurrencyState] = useState<"usd">("usd");
  const [timeRange, setTimeRangeState] = useState<"today">("today");

  useEffect(() => {
    setActiveProjectSlug(defaultActiveProjectSlug);
  }, [defaultActiveProjectSlug]);

  useEffect(() => {
    setActivePageSlug(pages[0]?.slug ?? "overview");
  }, [pages]);

  useEffect(() => {
    setWidgetLayout(defaultWidgetLayout);
  }, [defaultWidgetLayout]);

  const activePage =
    pages.find((page) => page.slug === activePageSlug) ??
    (pages[0] as import("@radarboard/types/database").DashboardPageConfig);

  const appearance = useMemo(
    () => ({
      ...DEFAULT_APPEARANCE,
      ticker: {
        ...DEFAULT_APPEARANCE.ticker,
        enabled: resolvedFixture.tickerEnabled,
      },
    }),
    [resolvedFixture.tickerEnabled]
  );

  const value: DashboardContextValue = {
    timeRange,
    timezonePreference: "UTC",
    localePreference: "en-US",
    effectiveTimezone: "UTC",
    effectiveLocale: "en-US",
    currency,
    currencies: ["USD", "CAD"],
    activeProjectSlug,
    activePageSlug,
    activePage,
    pages,
    pendingProjectSlug: null,
    isProjectSwitching: false,
    projects,
    orderedProjects: projects,
    projectOrder: projects.map((project) => project.slug),
    expandedWidgetId: null,
    widgetLayout,
    widgetConfigs: {},
    modalPrefs: DEFAULT_MODAL_PREFS,
    layouts,
    projectLayouts,
    activeLayout,
    activeLayoutId: activeLayout.id,
    appearance,
    preferences: DEFAULT_PREFERENCES,
    pollingPreferences: DEFAULT_POLLING_PREFERENCES,
    isEditMode: false,
    toggleEditMode: () => undefined,
    updateLayoutSizes: () => undefined,
    updateLayouts: () => undefined,
    updateProjectLayout: () => undefined,
    updateProjectPages: () => undefined,
    addProjectPage: () => undefined,
    updateProjectPage: () => undefined,
    removeProjectPage: () => undefined,
    reorderProjectPages: () => undefined,
    updateProjectPageLayout: () => undefined,
    updateProjectPageWidgetLayout: () => undefined,
    updateProjectWidgetLayout: () => undefined,
    updateProjectOrder: () => undefined,
    setTimeRange: () => setTimeRangeState("today"),
    setCurrency: () => setCurrencyState("usd"),
    setActiveProject: (slug) => setActiveProjectSlug(slug),
    setActivePage: (slug) => setActivePageSlug(slug),
    expandWidget: () => undefined,
    collapseWidget: () => undefined,
    updateWidgetLayout: (layout) => setWidgetLayout(layout),
    updateWidgetConfig: () => undefined,
    getWidgetModalSize: (_widgetId, _modalId, defaultSize) => defaultSize,
    updateWidgetModalSize: () => undefined,
    updatePreferences: () => undefined,
    updateAppearance: () => undefined,
  };

  return createElement(DashboardContext.Provider, { value }, children);
}
