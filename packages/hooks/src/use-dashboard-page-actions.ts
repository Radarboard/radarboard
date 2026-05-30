import { ALL_PROJECTS_SLUG } from "@radarboard/types/dashboard";
import type {
  DashboardPageConfig,
  ProjectLayoutConfig,
  WidgetLayoutConfig,
} from "@radarboard/types/database";
import { useCallback } from "react";
import {
  createDefaultDashboardPage,
  createDefaultDashboardWidgetLayout,
  normalizeDashboardWidgetLayout,
  resolveDashboardLayoutDefinition,
  resolveDashboardProjectView,
} from "./dashboard-layout";

type UseDashboardPageActionsArgs = {
  onWidgetLayoutConfigChange?: (config: WidgetLayoutConfig) => void;
  widgetLayoutConfig?: WidgetLayoutConfig;
};

export function useDashboardPageActions({
  onWidgetLayoutConfigChange,
  widgetLayoutConfig,
}: UseDashboardPageActionsArgs) {
  const getOwnerProjectSlug = useCallback(
    (slug: string): string | null => (slug === ALL_PROJECTS_SLUG ? null : slug),
    []
  );

  const getResolvedPages = useCallback(
    (slug: string): DashboardPageConfig[] =>
      resolveDashboardProjectView({
        layouts: widgetLayoutConfig?.layouts,
        projectLayouts: widgetLayoutConfig?.projectLayouts,
        projectSlug: getOwnerProjectSlug(slug),
      }).pages,
    [getOwnerProjectSlug, widgetLayoutConfig?.layouts, widgetLayoutConfig?.projectLayouts]
  );

  const toPageScopedProjectLayout = useCallback(
    (
      existing: ProjectLayoutConfig | undefined,
      pages: DashboardPageConfig[]
    ): ProjectLayoutConfig => ({
      ...existing,
      layoutId: undefined,
      layout: undefined,
      widgetLayouts: undefined,
      pages,
    }),
    []
  );

  const updateProjectPages = useCallback(
    (slug: string, pages: DashboardPageConfig[]) => {
      const existing = widgetLayoutConfig?.projectLayouts?.[slug];
      onWidgetLayoutConfigChange?.({
        configs: widgetLayoutConfig?.configs ?? {},
        modalPrefs: widgetLayoutConfig?.modalPrefs ?? {},
        layouts: widgetLayoutConfig?.layouts,
        projectLayouts: {
          ...(widgetLayoutConfig?.projectLayouts ?? {}),
          [slug]: toPageScopedProjectLayout(existing, pages),
        },
        preferences: widgetLayoutConfig?.preferences,
        appearance: widgetLayoutConfig?.appearance,
      });
    },
    [onWidgetLayoutConfigChange, toPageScopedProjectLayout, widgetLayoutConfig]
  );

  const addProjectPage = useCallback(
    (slug: string, page: DashboardPageConfig) => {
      updateProjectPages(slug, [
        ...getResolvedPages(slug),
        createDefaultDashboardPage(page, widgetLayoutConfig?.layouts),
      ]);
    },
    [getResolvedPages, updateProjectPages, widgetLayoutConfig?.layouts]
  );

  const updateProjectPage = useCallback(
    (slug: string, pageSlug: string, page: DashboardPageConfig) => {
      updateProjectPages(
        slug,
        getResolvedPages(slug).map((candidate) => (candidate.slug === pageSlug ? page : candidate))
      );
    },
    [getResolvedPages, updateProjectPages]
  );

  const removeProjectPage = useCallback(
    (slug: string, pageSlug: string) => {
      const nextPages = getResolvedPages(slug).filter((candidate) => candidate.slug !== pageSlug);
      if (nextPages.length === 0) return;
      updateProjectPages(slug, nextPages);
    },
    [getResolvedPages, updateProjectPages]
  );

  const reorderProjectPages = useCallback(
    (slug: string, pages: DashboardPageConfig[]) => {
      updateProjectPages(slug, pages);
    },
    [updateProjectPages]
  );

  const updateProjectPageLayout = useCallback(
    (slug: string, pageSlug: string, layoutId: string) => {
      const resolvedLayout = resolveDashboardLayoutDefinition(
        widgetLayoutConfig?.layouts,
        layoutId
      );
      const nextPages = getResolvedPages(slug).map((page) => {
        if (page.slug !== pageSlug) return page;

        return {
          ...page,
          layoutId: resolvedLayout.id,
          widgetLayouts: {
            ...(page.widgetLayouts ?? {}),
            [resolvedLayout.id]:
              page.widgetLayouts?.[resolvedLayout.id] ??
              createDefaultDashboardWidgetLayout(resolvedLayout),
          },
        };
      });

      updateProjectPages(slug, nextPages);
    },
    [getResolvedPages, updateProjectPages, widgetLayoutConfig?.layouts]
  );

  const updateProjectPageWidgetLayout = useCallback(
    (slug: string, pageSlug: string, layoutId: string, layout: Record<string, string | null>) => {
      const resolvedLayout = resolveDashboardLayoutDefinition(
        widgetLayoutConfig?.layouts,
        layoutId
      );
      const nextPages = getResolvedPages(slug).map((page) => {
        if (page.slug !== pageSlug) return page;

        return {
          ...page,
          layoutId: page.layoutId ?? resolvedLayout.id,
          widgetLayouts: {
            ...(page.widgetLayouts ?? {}),
            [resolvedLayout.id]: normalizeDashboardWidgetLayout(resolvedLayout, layout),
          },
        };
      });

      updateProjectPages(slug, nextPages);
    },
    [getResolvedPages, updateProjectPages, widgetLayoutConfig?.layouts]
  );

  const updateProjectWidgetLayout = useCallback(
    (slug: string, layoutId: string, layout: Record<string, string | null>) => {
      const targetPageSlug = resolveDashboardProjectView({
        layouts: widgetLayoutConfig?.layouts,
        projectLayouts: widgetLayoutConfig?.projectLayouts,
        projectSlug: getOwnerProjectSlug(slug),
      }).activePageSlug;

      updateProjectPageWidgetLayout(slug, targetPageSlug, layoutId, layout);
    },
    [
      getOwnerProjectSlug,
      updateProjectPageWidgetLayout,
      widgetLayoutConfig?.layouts,
      widgetLayoutConfig?.projectLayouts,
    ]
  );

  return {
    addProjectPage,
    removeProjectPage,
    reorderProjectPages,
    updateProjectPage,
    updateProjectPageLayout,
    updateProjectPageWidgetLayout,
    updateProjectPages,
    updateProjectWidgetLayout,
  };
}
