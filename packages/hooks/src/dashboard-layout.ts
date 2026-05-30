import { ALL_PROJECTS_SLUG } from "@radarboard/types/dashboard";
import type {
  DashboardPageConfig,
  LayoutCell,
  LayoutDefinition,
  ProjectLayoutConfig,
} from "@radarboard/types/database";

export type DashboardGridSlot =
  | "slot1"
  | "slot2"
  | "slot3"
  | "slot4"
  | "slot5"
  | "slot6"
  | "slot7"
  | "slot8"
  | "slot9";

/** Single-cell layout used for fresh installs before onboarding configures the grid. */
export const DEFAULT_DASHBOARD_LAYOUT: LayoutDefinition = {
  id: "single-cell",
  name: "Single Cell",
  cells: [{ id: "cell-1", rowStart: 0, colStart: 0, rowSpan: 1, colSpan: 1 }],
  colSizes: [100],
  rowSizes: [100],
};

export const BASIC_3X3_DASHBOARD_LAYOUT: LayoutDefinition = {
  id: "basic-3x3",
  name: "Basic 3×3",
  cells: [
    { id: "cell-1", rowStart: 0, colStart: 0, rowSpan: 1, colSpan: 1 },
    { id: "cell-2", rowStart: 0, colStart: 1, rowSpan: 1, colSpan: 1 },
    { id: "cell-3", rowStart: 0, colStart: 2, rowSpan: 1, colSpan: 1 },
    { id: "cell-4", rowStart: 1, colStart: 0, rowSpan: 1, colSpan: 1 },
    { id: "cell-5", rowStart: 1, colStart: 1, rowSpan: 1, colSpan: 1 },
    { id: "cell-6", rowStart: 1, colStart: 2, rowSpan: 1, colSpan: 1 },
    { id: "cell-7", rowStart: 2, colStart: 0, rowSpan: 1, colSpan: 1 },
    { id: "cell-8", rowStart: 2, colStart: 1, rowSpan: 1, colSpan: 1 },
    { id: "cell-9", rowStart: 2, colStart: 2, rowSpan: 1, colSpan: 1 },
  ],
  colSizes: [33.33, 33.33, 33.34],
  rowSizes: [33.33, 33.33, 33.34],
};

const DEFAULT_WIDGET_LAYOUT: Partial<Record<DashboardGridSlot, string | null>> = {
  slot1: null,
};

export const DEFAULT_DASHBOARD_PAGE_NAME = "Overview";
export const DEFAULT_DASHBOARD_PAGE_SLUG = "overview";

export interface ResolveDashboardProjectViewOptions {
  layouts?: LayoutDefinition[];
  projectLayouts?: Record<string, ProjectLayoutConfig>;
  projectSlug: string | null;
  pageSlug?: string | null;
}

export interface ResolvedDashboardProjectView {
  configOwnerSlug: string;
  projectConfig: ProjectLayoutConfig;
  pages: DashboardPageConfig[];
  activePageSlug: string;
  activePage: DashboardPageConfig;
  layoutId: string;
  layout: LayoutDefinition;
  widgetLayout: Record<string, string | null>;
}

export interface DashboardLayoutAssignedWidget {
  cellId: string;
  widgetId: string;
}

export interface DashboardLayoutChangePreview {
  assignedWidgets: DashboardLayoutAssignedWidget[];
  preservedCellIds: string[];
  droppedCellIds: string[];
  nextAssignments: Record<string, string | null>;
  keepCapacity: number;
}

function getSortedCells(cells: LayoutCell[]): LayoutCell[] {
  return [...cells].sort((a, b) => {
    if (a.rowStart !== b.rowStart) return a.rowStart - b.rowStart;
    if (a.colStart !== b.colStart) return a.colStart - b.colStart;
    if (a.rowSpan !== b.rowSpan) return a.rowSpan - b.rowSpan;
    if (a.colSpan !== b.colSpan) return a.colSpan - b.colSpan;
    return a.id.localeCompare(b.id);
  });
}

function getCellOverlapArea(a: LayoutCell, b: LayoutCell): number {
  const rowOverlap =
    Math.min(a.rowStart + a.rowSpan, b.rowStart + b.rowSpan) - Math.max(a.rowStart, b.rowStart);
  const colOverlap =
    Math.min(a.colStart + a.colSpan, b.colStart + b.colSpan) - Math.max(a.colStart, b.colStart);

  if (rowOverlap <= 0 || colOverlap <= 0) return 0;
  return rowOverlap * colOverlap;
}

function isLegacySlotKey(key: string): key is DashboardGridSlot {
  return /^slot[1-9]$/.test(key);
}

function getSlotName(index: number): DashboardGridSlot | null {
  const slot = `slot${index + 1}`;
  return isLegacySlotKey(slot) ? slot : null;
}

export function resolveDashboardLayoutDefinition(
  layouts: LayoutDefinition[] | undefined,
  layoutId: string | undefined
): LayoutDefinition {
  if (!layoutId) return DEFAULT_DASHBOARD_LAYOUT;
  return layouts?.find((candidate) => candidate.id === layoutId) ?? DEFAULT_DASHBOARD_LAYOUT;
}

export function createEmptyDashboardWidgetLayout(
  layout: LayoutDefinition
): Record<string, string | null> {
  return Object.fromEntries(getSortedCells(layout.cells).map((cell) => [cell.id, null]));
}

export function createDefaultDashboardWidgetLayout(
  layout: LayoutDefinition
): Record<string, string | null> {
  return Object.fromEntries(
    getSortedCells(layout.cells).map((cell, index) => {
      const slotName = getSlotName(index);
      return [cell.id, (slotName ? DEFAULT_WIDGET_LAYOUT[slotName] : null) ?? null];
    })
  );
}

function mapLegacySlotAssignments(
  layout: LayoutDefinition,
  legacyLayout: Record<string, string | null>
): Record<string, string | null> {
  const sortedCells = getSortedCells(layout.cells);
  const mapped: Record<string, string | null> = {};

  for (const [key, widgetId] of Object.entries(legacyLayout)) {
    if (!isLegacySlotKey(key)) continue;
    const slotIndex = Number(key.slice(4)) - 1;
    const cellId = sortedCells[slotIndex]?.id;
    if (cellId) mapped[cellId] = widgetId;
  }

  return mapped;
}

export function normalizeDashboardWidgetLayout(
  layout: LayoutDefinition,
  widgetLayout?: Record<string, string | null>
): Record<string, string | null> {
  if (!widgetLayout) {
    return createDefaultDashboardWidgetLayout(layout);
  }

  const cellIds = new Set(layout.cells.map((cell) => cell.id));
  const hasModernKeys = Object.keys(widgetLayout).some((key) => cellIds.has(key));
  const base = hasModernKeys
    ? createEmptyDashboardWidgetLayout(layout)
    : createDefaultDashboardWidgetLayout(layout);

  const next = {
    ...base,
    ...mapLegacySlotAssignments(layout, widgetLayout),
  };

  for (const [key, widgetId] of Object.entries(widgetLayout)) {
    if (!cellIds.has(key)) continue;
    next[key] = widgetId;
  }

  return next;
}

export function reconcileDashboardWidgetLayout(
  previousLayout: LayoutDefinition,
  nextLayout: LayoutDefinition,
  widgetLayout?: Record<string, string | null>
): Record<string, string | null> {
  return previewDashboardLayoutChange(previousLayout, nextLayout, widgetLayout).nextAssignments;
}

export function previewDashboardLayoutChange(
  previousLayout: LayoutDefinition,
  nextLayout: LayoutDefinition,
  widgetLayout?: Record<string, string | null>,
  allowedPreviousCellIds?: Set<string>
): DashboardLayoutChangePreview {
  const previousAssignments = normalizeDashboardWidgetLayout(previousLayout, widgetLayout);
  const nextAssignments = createEmptyDashboardWidgetLayout(nextLayout);
  const consumedPreviousCellIds = new Set<string>();
  const previousCells = getSortedCells(previousLayout.cells);
  const nextCells = getSortedCells(nextLayout.cells);
  const assignedWidgets = previousCells
    .map((cell) => ({
      cellId: cell.id,
      widgetId: previousAssignments[cell.id],
    }))
    .filter(
      (entry): entry is DashboardLayoutAssignedWidget =>
        typeof entry.widgetId === "string" &&
        (allowedPreviousCellIds == null || allowedPreviousCellIds.has(entry.cellId))
    );
  const allowedCellIds = new Set(assignedWidgets.map((entry) => entry.cellId));

  for (const nextCell of nextCells) {
    if (!allowedCellIds.has(nextCell.id)) continue;

    const widgetId = previousAssignments[nextCell.id] ?? null;
    if (widgetId === null) continue;
    nextAssignments[nextCell.id] = widgetId;
    consumedPreviousCellIds.add(nextCell.id);
  }

  for (const nextCell of nextCells) {
    if (nextAssignments[nextCell.id] !== null) continue;

    const candidate = previousCells
      .map((previousCell) => ({
        previousCell,
        widgetId: previousAssignments[previousCell.id] ?? null,
        overlapArea: getCellOverlapArea(previousCell, nextCell),
      }))
      .filter(
        (entry) =>
          entry.widgetId !== null &&
          entry.overlapArea > 0 &&
          allowedCellIds.has(entry.previousCell.id) &&
          !consumedPreviousCellIds.has(entry.previousCell.id)
      )
      .sort((a, b) => {
        if (a.overlapArea !== b.overlapArea) {
          return b.overlapArea - a.overlapArea;
        }
        if (a.previousCell.rowStart !== b.previousCell.rowStart) {
          return a.previousCell.rowStart - b.previousCell.rowStart;
        }
        if (a.previousCell.colStart !== b.previousCell.colStart) {
          return a.previousCell.colStart - b.previousCell.colStart;
        }
        return a.previousCell.id.localeCompare(b.previousCell.id);
      })[0];

    if (!candidate?.widgetId) continue;
    nextAssignments[nextCell.id] = candidate.widgetId;
    consumedPreviousCellIds.add(candidate.previousCell.id);
  }

  // When the user explicitly picked widgets to keep, preserve them even if their
  // old cells no longer overlap the new layout. Fill any remaining open cells
  // in row-major order with the still-unassigned selected widgets.
  for (const nextCell of nextCells) {
    if (nextAssignments[nextCell.id] !== null) continue;

    const fallback = assignedWidgets.find((entry) => !consumedPreviousCellIds.has(entry.cellId));
    if (!fallback) break;

    nextAssignments[nextCell.id] = fallback.widgetId;
    consumedPreviousCellIds.add(fallback.cellId);
  }

  const preservedCellIds = assignedWidgets
    .map((entry) => entry.cellId)
    .filter((cellId) => consumedPreviousCellIds.has(cellId));
  const droppedCellIds = assignedWidgets
    .map((entry) => entry.cellId)
    .filter((cellId) => !consumedPreviousCellIds.has(cellId));

  return {
    assignedWidgets,
    preservedCellIds,
    droppedCellIds,
    nextAssignments,
    keepCapacity: nextCells.length,
  };
}

function normalizePageWidgetLayouts(
  layouts: LayoutDefinition[],
  widgetLayouts?: Record<string, Record<string, string | null>>
): Record<string, Record<string, string | null>> {
  if (!widgetLayouts || Object.keys(widgetLayouts).length === 0) {
    return {
      [BASIC_3X3_DASHBOARD_LAYOUT.id]: createDefaultDashboardWidgetLayout(
        BASIC_3X3_DASHBOARD_LAYOUT
      ),
    };
  }

  return Object.fromEntries(
    Object.entries(widgetLayouts).map(([layoutId, layoutAssignments]) => {
      const resolvedLayout = resolveDashboardLayoutDefinition(layouts, layoutId);
      return [resolvedLayout.id, normalizeDashboardWidgetLayout(resolvedLayout, layoutAssignments)];
    })
  );
}

export function getDashboardConfigOwnerSlug(projectSlug: string | null): string {
  return projectSlug ?? ALL_PROJECTS_SLUG;
}

export function createDefaultDashboardPage(
  overrides: Partial<DashboardPageConfig> = {},
  layouts: LayoutDefinition[] = [BASIC_3X3_DASHBOARD_LAYOUT]
): DashboardPageConfig {
  const resolvedLayout = resolveDashboardLayoutDefinition(layouts, overrides.layoutId);
  const widgetLayouts = normalizePageWidgetLayouts(layouts, overrides.widgetLayouts);

  if (!(resolvedLayout.id in widgetLayouts)) {
    widgetLayouts[resolvedLayout.id] = createDefaultDashboardWidgetLayout(resolvedLayout);
  }

  return {
    name: overrides.name?.trim() || DEFAULT_DASHBOARD_PAGE_NAME,
    slug: overrides.slug?.trim() || DEFAULT_DASHBOARD_PAGE_SLUG,
    layoutId: resolvedLayout.id,
    widgetLayouts,
  };
}

function buildLegacyDashboardPage(
  layouts: LayoutDefinition[],
  projectConfig: ProjectLayoutConfig
): DashboardPageConfig {
  const resolvedLayout = resolveDashboardLayoutDefinition(layouts, projectConfig.layoutId);
  const legacyWidgetLayouts = normalizePageWidgetLayouts(layouts, projectConfig.widgetLayouts);

  if (!(resolvedLayout.id in legacyWidgetLayouts)) {
    legacyWidgetLayouts[resolvedLayout.id] = normalizeDashboardWidgetLayout(
      resolvedLayout,
      projectConfig.layout
    );
  }

  return createDefaultDashboardPage(
    {
      layoutId: resolvedLayout.id,
      widgetLayouts: legacyWidgetLayouts,
    },
    layouts
  );
}

function resolveDashboardPages(
  layouts: LayoutDefinition[],
  projectConfig: ProjectLayoutConfig
): DashboardPageConfig[] {
  if (!projectConfig.pages || projectConfig.pages.length === 0) {
    return [buildLegacyDashboardPage(layouts, projectConfig)];
  }

  return projectConfig.pages.map((page) => {
    const resolvedLayout = resolveDashboardLayoutDefinition(layouts, page.layoutId);
    const widgetLayouts = normalizePageWidgetLayouts(layouts, page.widgetLayouts);

    if (!(resolvedLayout.id in widgetLayouts)) {
      widgetLayouts[resolvedLayout.id] = createDefaultDashboardWidgetLayout(resolvedLayout);
    }

    return createDefaultDashboardPage(
      {
        ...page,
        layoutId: resolvedLayout.id,
        widgetLayouts,
      },
      layouts
    );
  });
}

export function resolveDashboardProjectView({
  layouts = [],
  projectLayouts = {},
  projectSlug,
  pageSlug,
}: ResolveDashboardProjectViewOptions): ResolvedDashboardProjectView {
  const configOwnerSlug = getDashboardConfigOwnerSlug(projectSlug);
  const projectConfig = projectLayouts[configOwnerSlug] ?? {};
  const pages = resolveDashboardPages(layouts, projectConfig);
  const fallbackPage = pages[0] ?? createDefaultDashboardPage({}, layouts);
  const activePage = pages.find((page) => page.slug === pageSlug) ?? fallbackPage;
  const layout = resolveDashboardLayoutDefinition(layouts, activePage.layoutId);
  const layoutId = layout.id;
  const activeLayoutAssignments = activePage.widgetLayouts?.[layoutId];

  return {
    configOwnerSlug,
    projectConfig,
    pages,
    activePageSlug: activePage.slug,
    activePage,
    layoutId,
    layout,
    widgetLayout: normalizeDashboardWidgetLayout(layout, activeLayoutAssignments),
  };
}
