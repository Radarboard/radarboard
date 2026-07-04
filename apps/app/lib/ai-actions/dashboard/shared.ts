/**
 * Shared, PURE helpers for the assistant's dashboard write-tools.
 *
 * All layout navigation/mutation lives here as pure functions over a
 * `WidgetLayoutConfig`, so the executors stay thin (load → transform → persist)
 * and the logic is unit-testable without touching the settings repository.
 */
import {
  createDefaultDashboardPage,
  createEmptyDashboardWidgetLayout,
  DEFAULT_DASHBOARD_PAGE_SLUG,
  getDashboardConfigOwnerSlug,
  resolveDashboardLayoutDefinition,
} from "@radarboard/hooks/dashboard-layout";
import type {
  DashboardPageConfig,
  LayoutCell,
  LayoutDefinition,
  WidgetLayoutConfig,
} from "@radarboard/types/database";

/** A resolved place to read/write widget assignments on a dashboard page. */
export interface DashboardTarget {
  ownerSlug: string;
  /** Index of the page in the owner's `pages`, or -1 when the page must be appended. */
  pageIndex: number;
  page: DashboardPageConfig;
  layout: LayoutDefinition;
  /** A mutable COPY of cellId → widgetId|null for the page's active layout. */
  assignments: Record<string, string | null>;
}

/** Cells ordered top-to-bottom, left-to-right (stable placement order). */
export function sortCells(cells: LayoutCell[]): LayoutCell[] {
  return [...cells].sort((a, b) => a.rowStart - b.rowStart || a.colStart - b.colStart);
}

/**
 * Resolve the target page + active layout + a copy of its assignments.
 * Bootstraps a default page/layout when the owner has none, so the tools work
 * even on a fresh dashboard.
 */
export function resolvePageTarget(
  config: WidgetLayoutConfig,
  projectSlug: string | null,
  pageSlug?: string
): DashboardTarget {
  const ownerSlug = getDashboardConfigOwnerSlug(projectSlug);
  const layouts = config.layouts ?? [];
  const pages = config.projectLayouts?.[ownerSlug]?.pages ?? [];
  const requestedSlug = pageSlug?.trim();
  const slug = requestedSlug || DEFAULT_DASHBOARD_PAGE_SLUG;

  let pageIndex = pages.findIndex((p) => p.slug === slug);
  // With no explicit page requested, fall back to the first page if "overview" is absent.
  if (pageIndex < 0 && !requestedSlug && pages.length > 0) pageIndex = 0;

  const page =
    pageIndex >= 0
      ? (pages[pageIndex] as DashboardPageConfig)
      : createDefaultDashboardPage({ slug }, layouts.length ? layouts : undefined);

  const layout = resolveDashboardLayoutDefinition(layouts, page.layoutId);
  const assignments = {
    ...(page.widgetLayouts?.[layout.id] ?? createEmptyDashboardWidgetLayout(layout)),
  };
  // Guarantee every cell is a key so "first empty cell" scans are correct.
  for (const cell of layout.cells) {
    if (!(cell.id in assignments)) assignments[cell.id] = null;
  }

  return { ownerSlug, pageIndex, page, layout, assignments };
}

/** Produce a new WidgetLayoutConfig with `assignments` written to the target page. */
export function applyAssignments(
  config: WidgetLayoutConfig,
  target: DashboardTarget,
  assignments: Record<string, string | null>
): WidgetLayoutConfig {
  const { ownerSlug, pageIndex, page, layout } = target;

  const layouts = config.layouts ?? [];
  const nextLayouts = layouts.some((l) => l.id === layout.id) ? layouts : [...layouts, layout];

  const projectLayouts = config.projectLayouts ?? {};
  const projectConfig = projectLayouts[ownerSlug] ?? { pages: [] };
  const pages = projectConfig.pages ?? [];

  const nextPage: DashboardPageConfig = {
    ...page,
    layoutId: layout.id,
    widgetLayouts: { ...(page.widgetLayouts ?? {}), [layout.id]: assignments },
  };

  const nextPages =
    pageIndex >= 0 ? pages.map((p, i) => (i === pageIndex ? nextPage : p)) : [...pages, nextPage];

  return {
    ...config,
    layouts: nextLayouts,
    projectLayouts: {
      ...projectLayouts,
      [ownerSlug]: { ...projectConfig, pages: nextPages },
    },
  };
}

/** The empty starting config used when nothing is persisted yet. */
export function emptyWidgetLayoutConfig(): WidgetLayoutConfig {
  return { configs: {} };
}

export { DEFAULT_DASHBOARD_PAGE_SLUG };
