import {
  ALL_PROJECTS_SLUG,
  AUTO_TIMEZONE,
  type DashboardTimezonePreference,
} from "@radarboard/types/dashboard";
import type {
  DashboardPageConfig,
  LayoutDefinition,
  ProjectLayoutConfig,
} from "@radarboard/types/database";
import type { Project } from "@radarboard/types/project";
import {
  reconcileDashboardWidgetLayout,
  resolveDashboardLayoutDefinition,
  resolveDashboardProjectView,
} from "./dashboard-layout";

const DEFAULT_TIMEZONE = "UTC";

function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function detectBrowserTimeZone(): string {
  const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return detected && isValidTimeZone(detected) ? detected : DEFAULT_TIMEZONE;
}

export function summarizeColumnRowSizes(columnRowSizes: number[][]): number[] {
  if (columnRowSizes.length === 0) return [];

  const rowCount = Math.max(...columnRowSizes.map((sizes) => sizes.length), 0);
  if (rowCount <= 0) return [];

  const summary = Array.from({ length: rowCount }, (_, rowIndex) => {
    const total = columnRowSizes.reduce((sum, sizes) => sum + (sizes[rowIndex] ?? 0), 0);
    return Number((total / columnRowSizes.length).toFixed(2));
  });

  const totalExceptLast = summary.slice(0, -1).reduce((sum, value) => sum + value, 0);
  summary[summary.length - 1] = Number((100 - totalExceptLast).toFixed(2));
  return summary;
}

export function resolveEffectiveTimeZone(
  preference: DashboardTimezonePreference | null | undefined
): string {
  if (!preference || preference === AUTO_TIMEZONE) {
    return detectBrowserTimeZone();
  }
  return isValidTimeZone(preference) ? preference : DEFAULT_TIMEZONE;
}

export function normalizeProjectLayoutsForDefinitions(
  layouts: LayoutDefinition[],
  projectLayouts: Record<string, ProjectLayoutConfig> | undefined,
  previousLayouts: LayoutDefinition[] | undefined = layouts
): Record<string, ProjectLayoutConfig> {
  return Object.fromEntries(
    Object.entries(projectLayouts ?? {}).map(([ownerSlug, config]) => {
      const pages = resolveDashboardProjectView({
        layouts: previousLayouts,
        projectLayouts: { [ownerSlug]: config },
        projectSlug: ownerSlug === ALL_PROJECTS_SLUG ? null : ownerSlug,
      }).pages;

      const nextPages = pages.map((page) => {
        const previousActiveLayout = resolveDashboardLayoutDefinition(
          previousLayouts,
          page.layoutId
        );
        const nextActiveLayout = resolveDashboardLayoutDefinition(layouts, page.layoutId);
        const widgetLayouts: Record<string, Record<string, string | null>> = Object.fromEntries(
          Object.entries(page.widgetLayouts ?? {}).map(([layoutId, assignments]) => {
            const previousLayout = resolveDashboardLayoutDefinition(previousLayouts, layoutId);
            const nextLayout = resolveDashboardLayoutDefinition(layouts, layoutId);

            return [
              nextLayout.id,
              reconcileDashboardWidgetLayout(previousLayout, nextLayout, assignments),
            ];
          })
        );

        widgetLayouts[nextActiveLayout.id] = reconcileDashboardWidgetLayout(
          previousActiveLayout,
          nextActiveLayout,
          page.widgetLayouts?.[previousActiveLayout.id]
        );

        return {
          ...page,
          layoutId: nextActiveLayout.id,
          widgetLayouts,
        } satisfies DashboardPageConfig;
      });

      return [
        ownerSlug,
        {
          ...config,
          layoutId: undefined,
          layout: undefined,
          widgetLayouts: undefined,
          pages: nextPages,
        } satisfies ProjectLayoutConfig,
      ];
    })
  );
}

export function computeOrderedProjects(projects: Project[], projectOrder: string[]): Project[] {
  if (projectOrder.length === 0) return projects;

  const projectMap = new Map(projects.map((project) => [project.slug, project]));
  const ordered: Project[] = [];

  for (const slug of projectOrder) {
    const project = projectMap.get(slug);
    if (project) {
      ordered.push(project);
      projectMap.delete(slug);
    }
  }

  return [...ordered, ...projectMap.values()];
}
