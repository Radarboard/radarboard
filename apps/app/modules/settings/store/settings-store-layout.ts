/**
 * Settings store — layout normalization, migration, and defaults.
 *
 * Pure functions with no React or Store dependencies.
 * Extracted from settings-store.ts for testability and clarity.
 */

import {
  createDefaultDashboardPage,
  createDefaultDashboardWidgetLayout,
  normalizeDashboardWidgetLayout,
  resolveDashboardLayoutDefinition,
} from "@radarboard/hooks/dashboard-layout";
import { DEFAULT_THEME_FAMILY_ID, DEFAULT_THEME_MODE } from "@radarboard/themes";
import { ALL_PROJECTS_SLUG, AUTO_LOCALE } from "@radarboard/types/dashboard";
import type {
  DashboardPageConfig,
  LayoutDefinition,
  ProjectLayoutConfig,
  WidgetLayoutConfig,
  WidgetModalPrefs,
} from "@radarboard/types/database";
import { sanitizePollingPreferences } from "@radarboard/types/polling";
import { LAYOUT_RECIPES } from "@radarboard/widget-engine/layout-recipe-gallery";
import { BASIC_3X3 } from "@radarboard/widget-engine/layouts";
import { WIDGET_ID_RENAMES } from "@radarboard/widget-engine/widget-id-renames";
import { PROJECTS } from "@/config/projects";

// ---------------------------------------------------------------------------
// Types (shared with other settings-store modules)
// ---------------------------------------------------------------------------

export type SlotMap = Record<string, string | null>;
export type ProjectIntegrationsMap = Record<string, Record<string, Record<string, unknown>>>;

const RECIPE_LAYOUTS_BY_ID = new Map(
  LAYOUT_RECIPES.map((recipe) => [recipe.layout.id, recipe.layout] as const)
);

function collectReferencedLayoutIds(
  projectLayouts: Record<string, ProjectLayoutConfig> | undefined
): Set<string> {
  const referencedIds = new Set<string>();

  for (const config of Object.values(projectLayouts ?? {})) {
    if (config.layoutId) referencedIds.add(config.layoutId);
    for (const page of config.pages ?? []) {
      if (page.layoutId) referencedIds.add(page.layoutId);
    }
  }

  return referencedIds;
}

function isCanonicalRecipeLayout(layout: LayoutDefinition): boolean {
  const canonical = RECIPE_LAYOUTS_BY_ID.get(layout.id);
  return canonical != null && JSON.stringify(canonical) === JSON.stringify(layout);
}

function normalizeSavedLayouts(
  layouts: LayoutDefinition[] = [],
  projectLayouts: Record<string, ProjectLayoutConfig> | undefined
): LayoutDefinition[] {
  const referencedIds = collectReferencedLayoutIds(projectLayouts);
  const deduped = new Map<string, LayoutDefinition>();

  deduped.set(BASIC_3X3.id, layouts.find((layout) => layout.id === BASIC_3X3.id) ?? BASIC_3X3);

  for (const layout of layouts) {
    if (layout.id === BASIC_3X3.id) {
      deduped.set(layout.id, layout);
      continue;
    }

    const isBuiltInRecipe = RECIPE_LAYOUTS_BY_ID.has(layout.id);
    if (isBuiltInRecipe && !referencedIds.has(layout.id) && isCanonicalRecipeLayout(layout)) {
      continue;
    }

    deduped.set(layout.id, layout);
  }

  for (const layoutId of referencedIds) {
    if (deduped.has(layoutId)) continue;

    const canonical = RECIPE_LAYOUTS_BY_ID.get(layoutId);
    if (canonical) {
      deduped.set(layoutId, canonical);
    }
  }

  return Array.from(deduped.values());
}

// ---------------------------------------------------------------------------
// Default creators
// ---------------------------------------------------------------------------

function createDefaultAssignments(layout: LayoutDefinition = BASIC_3X3): SlotMap {
  return { ...createDefaultDashboardWidgetLayout(layout) };
}

function createDefaultPageConfig(
  overrides: Partial<DashboardPageConfig> = {},
  layouts: LayoutDefinition[] = [BASIC_3X3]
): DashboardPageConfig {
  const resolvedLayout = resolveDashboardLayoutDefinition(layouts, overrides.layoutId);
  return createDefaultDashboardPage(
    {
      ...overrides,
      widgetLayouts: overrides.widgetLayouts ?? {
        [resolvedLayout.id]: createDefaultAssignments(resolvedLayout),
      },
    },
    layouts
  );
}

export function createDefaultWidgetLayoutConfig(): WidgetLayoutConfig {
  return {
    configs: {},
    modalPrefs: {},
    layouts: [BASIC_3X3],
    projectLayouts: {
      [ALL_PROJECTS_SLUG]: {
        pages: [createDefaultPageConfig()],
      },
    },
    preferences: {
      timezone: "auto",
      locale: AUTO_LOCALE,
      polling: {},
      shortcuts: {},
    },
    appearance: {
      fontScale: "md",
      themeFamilyId: DEFAULT_THEME_FAMILY_ID,
      themeMode: DEFAULT_THEME_MODE,
    },
  };
}

// ---------------------------------------------------------------------------
// Legacy migration helpers
// ---------------------------------------------------------------------------

const LEGACY_SLOT_MAP: Record<string, string> = {
  revenue: "slot1",
  shipping: "slot2",
  ideas: "slot3",
  analytics: "slot4",
  seo: "slot5",
  detail: "slot6",
  observability: "slot6",
};

function migrateLayout(layout: Record<string, string | null>): Record<string, string | null> {
  const keys = Object.keys(layout);
  const hasLegacyKeys = keys.some((k) => k in LEGACY_SLOT_MAP);
  if (!hasLegacyKeys) return layout;

  const migrated: Record<string, string | null> = {};
  for (const [oldKey, widgetId] of Object.entries(layout)) {
    const newKey = LEGACY_SLOT_MAP[oldKey];
    if (newKey) {
      migrated[newKey] = widgetId;
    }
  }
  return migrated;
}

function migrateWidgetIds(layout: Record<string, string | null>): Record<string, string | null> {
  let changed = false;
  const migrated: Record<string, string | null> = {};
  for (const [slot, widgetId] of Object.entries(layout)) {
    const newId = widgetId ? WIDGET_ID_RENAMES[widgetId] : undefined;
    if (newId) {
      migrated[slot] = newId;
      changed = true;
    } else {
      migrated[slot] = widgetId;
    }
  }
  return changed ? migrated : layout;
}

function migrateConfigKeys<T extends Record<string, unknown>>(configs: T): T {
  let changed = false;
  const migrated: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(configs)) {
    const newKey = WIDGET_ID_RENAMES[key];
    if (newKey) {
      migrated[newKey] = value;
      changed = true;
    } else {
      migrated[key] = value;
    }
  }
  return changed ? (migrated as T) : configs;
}

function migrateModalPrefKeys(modalPrefs: WidgetModalPrefs): WidgetModalPrefs {
  let changed = false;
  const migrated: WidgetModalPrefs = {};

  for (const [widgetId, modalMap] of Object.entries(modalPrefs)) {
    const nextWidgetId = WIDGET_ID_RENAMES[widgetId] ?? widgetId;
    if (nextWidgetId !== widgetId) changed = true;

    migrated[nextWidgetId] = {
      ...(migrated[nextWidgetId] ?? {}),
      ...modalMap,
    };
  }

  return changed ? migrated : modalPrefs;
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

function normalizeAssignments(
  resolvedLayout: LayoutDefinition,
  layout?: Record<string, string | null>
): SlotMap {
  return normalizeDashboardWidgetLayout(
    resolvedLayout,
    layout ? migrateWidgetIds(migrateLayout(layout)) : undefined
  );
}

function normalizeProjectWidgetLayouts(
  layouts: LayoutDefinition[],
  widgetLayouts?: Record<string, Record<string, string | null>>
): Record<string, SlotMap> | undefined {
  if (!widgetLayouts) return undefined;
  return Object.fromEntries(
    Object.entries(widgetLayouts).map(([layoutId, layout]) => {
      const resolvedLayout = resolveDashboardLayoutDefinition(layouts, layoutId);
      return [resolvedLayout.id, normalizeAssignments(resolvedLayout, layout)];
    })
  );
}

function toPageSlug(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "overview";
}

function dedupePageSlug(slug: string, usedSlugs: Set<string>): string {
  if (!usedSlugs.has(slug)) {
    usedSlugs.add(slug);
    return slug;
  }

  let index = 2;
  while (usedSlugs.has(`${slug}-${index}`)) {
    index += 1;
  }

  const deduped = `${slug}-${index}`;
  usedSlugs.add(deduped);
  return deduped;
}

function normalizeDashboardPages(
  layouts: LayoutDefinition[],
  pages: DashboardPageConfig[] | undefined,
  fallbackPage: DashboardPageConfig
): DashboardPageConfig[] {
  const sourcePages = pages && pages.length > 0 ? pages : [fallbackPage];
  const usedSlugs = new Set<string>();

  return sourcePages.map((page, index) => {
    const resolvedLayout = resolveDashboardLayoutDefinition(
      layouts,
      page.layoutId ?? fallbackPage.layoutId
    );
    const widgetLayouts = normalizeProjectWidgetLayouts(layouts, page.widgetLayouts) ?? {
      [resolvedLayout.id]:
        fallbackPage.widgetLayouts?.[resolvedLayout.id] ??
        fallbackPage.widgetLayouts?.[fallbackPage.layoutId ?? BASIC_3X3.id] ??
        createDefaultAssignments(resolvedLayout),
    };

    if (!(resolvedLayout.id in widgetLayouts)) {
      widgetLayouts[resolvedLayout.id] = createDefaultAssignments(resolvedLayout);
    }

    const name = page.name?.trim() || (index === 0 ? fallbackPage.name : `Page ${index + 1}`);
    const slug = dedupePageSlug(toPageSlug(page.slug || name), usedSlugs);

    return createDefaultPageConfig(
      {
        ...page,
        name,
        slug,
        layoutId: resolvedLayout.id,
        widgetLayouts,
      },
      layouts
    );
  });
}

function getKnownProjectSlugs(projectIntegrations: ProjectIntegrationsMap): string[] {
  const userProjectIds = projectIntegrations["@@projects"]?._?.ids;
  const customProjectSlugs = Array.isArray(userProjectIds)
    ? userProjectIds.filter((id): id is string => typeof id === "string")
    : [];
  return Array.from(
    new Set([ALL_PROJECTS_SLUG, ...PROJECTS.map((project) => project.slug), ...customProjectSlugs])
  );
}

function hasRenamedWidgetIds(config: WidgetLayoutConfig): boolean {
  const configStr = JSON.stringify(config);
  return Object.keys(WIDGET_ID_RENAMES).some((oldId) => configStr.includes(`"${oldId}"`));
}

export function needsWidgetLayoutMigration(config: WidgetLayoutConfig | null): boolean {
  if (!config) return false;
  if (config.layout) return true;
  if (hasRenamedWidgetIds(config)) return true;
  const projectLayouts = config.projectLayouts ?? {};
  if (!(ALL_PROJECTS_SLUG in projectLayouts)) return true;
  return Object.values(projectLayouts).some(
    (projectConfig) =>
      projectConfig.layout != null ||
      projectConfig.layoutId != null ||
      projectConfig.widgetLayouts != null ||
      projectConfig.pages == null ||
      projectConfig.pages.length === 0 ||
      projectConfig.pages.some(
        (page) =>
          !page.name ||
          !page.slug ||
          page.layoutId == null ||
          page.widgetLayouts == null ||
          Object.keys(page.widgetLayouts).length === 0 ||
          Object.values(page.widgetLayouts).some((layout) =>
            Object.keys(layout).some((key) => key in LEGACY_SLOT_MAP || /^slot\d+$/.test(key))
          )
      )
  );
}

function normalizeOwnerDashboardConfig(
  layouts: LayoutDefinition[],
  ownerSlug: string,
  projectConfig: ProjectLayoutConfig | undefined,
  legacyGlobalAssignments: SlotMap
): ProjectLayoutConfig {
  const resolvedLayout = resolveDashboardLayoutDefinition(layouts, projectConfig?.layoutId);
  const normalizedWidgetLayouts = normalizeProjectWidgetLayouts(
    layouts,
    projectConfig?.widgetLayouts
  );

  const fallbackPage =
    normalizedWidgetLayouts != null
      ? createDefaultPageConfig(
          {
            layoutId: resolvedLayout.id,
            widgetLayouts: normalizedWidgetLayouts,
          },
          layouts
        )
      : createDefaultPageConfig(
          {
            layoutId: resolvedLayout.id,
            widgetLayouts: {
              [resolvedLayout.id]:
                ownerSlug === ALL_PROJECTS_SLUG
                  ? normalizeAssignments(
                      resolvedLayout,
                      projectConfig?.layout ?? legacyGlobalAssignments
                    )
                  : normalizeAssignments(resolvedLayout, {
                      ...legacyGlobalAssignments,
                      ...(projectConfig?.layout ? migrateLayout(projectConfig.layout) : {}),
                    }),
            },
          },
          layouts
        );

  return {
    pages: normalizeDashboardPages(layouts, projectConfig?.pages, fallbackPage),
  };
}

// ---------------------------------------------------------------------------
// Main merge function
// ---------------------------------------------------------------------------

export function mergeWithDefaults(
  overrides: WidgetLayoutConfig | null,
  projectIntegrations: ProjectIntegrationsMap
): WidgetLayoutConfig {
  const defaults = createDefaultWidgetLayoutConfig();
  const defaultAppearance = defaults.appearance ?? {
    fontScale: "md" as const,
    themeFamilyId: DEFAULT_THEME_FAMILY_ID,
    themeMode: DEFAULT_THEME_MODE,
  };
  if (!overrides) {
    return defaults;
  }

  const layouts = normalizeSavedLayouts(overrides.layouts, overrides.projectLayouts);

  const legacyGlobalAssignments = normalizeAssignments(BASIC_3X3, overrides.layout);
  const legacyProjectLayouts = overrides.projectLayouts ?? {};
  const ownerSlugs = needsWidgetLayoutMigration(overrides)
    ? getKnownProjectSlugs(projectIntegrations).concat(Object.keys(legacyProjectLayouts))
    : Object.keys(legacyProjectLayouts);
  const migratedProjectLayouts = Object.fromEntries(
    Array.from(new Set(ownerSlugs)).map((slug) => [
      slug,
      normalizeOwnerDashboardConfig(
        layouts,
        slug,
        legacyProjectLayouts[slug],
        legacyGlobalAssignments
      ),
    ])
  );

  return {
    configs: migrateConfigKeys(overrides.configs ?? {}),
    modalPrefs: migrateModalPrefKeys(overrides.modalPrefs ?? {}),
    layouts,
    projectLayouts: {
      ...migratedProjectLayouts,
      [ALL_PROJECTS_SLUG]:
        migratedProjectLayouts[ALL_PROJECTS_SLUG] ??
        normalizeOwnerDashboardConfig(
          layouts,
          ALL_PROJECTS_SLUG,
          undefined,
          legacyGlobalAssignments
        ),
    },
    preferences: {
      ...overrides.preferences,
      timezone: overrides.preferences?.timezone ?? defaults.preferences?.timezone,
      locale: overrides.preferences?.locale ?? defaults.preferences?.locale,
      polling: sanitizePollingPreferences(overrides.preferences?.polling) ?? {},
      shortcuts: overrides.preferences?.shortcuts ?? defaults.preferences?.shortcuts ?? {},
    },
    appearance: {
      ...defaultAppearance,
      ...overrides.appearance,
      fontScale: overrides.appearance?.fontScale ?? defaultAppearance.fontScale,
      themeFamilyId: overrides.appearance?.themeFamilyId ?? defaultAppearance.themeFamilyId,
      themeMode: overrides.appearance?.themeMode ?? defaultAppearance.themeMode,
    },
  };
}
