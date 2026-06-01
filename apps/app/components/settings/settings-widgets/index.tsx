"use client";

import { useCredentials } from "@radarboard/hooks/use-credentials";
import { useDashboard } from "@radarboard/hooks/use-dashboard";
import { VIEW_STATE_QUERY_KEYS } from "@radarboard/types/view-state";
import { Badge } from "@radarboard/ui/badge";
import { Button } from "@radarboard/ui/button";
import { EmptyState } from "@radarboard/ui/empty-state";
import { cn } from "@radarboard/utils/cn";
import type { WidgetDescriptor } from "@radarboard/widget-engine/widgets/registry";
import { WIDGET_REGISTRY } from "@radarboard/widget-engine/widgets/registry";
import { Blocks } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { useMemo, useState } from "react";
import { getAuthList } from "../../widgets/widget-config-panel";
import { WidgetDetailDialog } from "../../widgets/widget-detail-dialog";
import { CommunityExtensionDiscovery } from "../community-discovery";
import { InstallExtensionDialog } from "../extension-installer";
import { SettingsCatalogCard } from "../settings-catalog-card";
import { SettingsCategoryTabs } from "../settings-category-tabs";
import { filterCategorySections, normalizeCategoryId } from "../settings-category-utils";
import {
  SettingsCardSection,
  SettingsGrid,
  SettingsPageLayout,
  SettingsPageToolbar,
} from "../settings-page-layout";
import {
  getPreferredCellId,
  getVisibleCellIds,
  getWidgetToVisibleCellIdMap,
  placeWidgetInVisibleCells,
} from "../settings-widgets-utils";

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

interface WidgetCategory {
  id: string;
  label: string;
  widgetIds: string[];
}

const CATEGORY_LABELS: Record<string, string> = {
  revenue: "Revenue & Monetization",
  analytics: "Analytics & SEO",
  development: "Development",
  product: "Product & Delivery",
  infrastructure: "Deployment & Infrastructure",
  plugins: "Plugins",
  other: "Other",
};

function getWidgetCategories(allWidgets: WidgetDescriptor[]): WidgetCategory[] {
  const categories = new Map<string, string[]>();

  for (const widget of allWidgets) {
    const categoryId = widget.id.includes("__")
      ? "plugins"
      : widget.catalogCategory?.trim() || "other";
    const widgetIds = categories.get(categoryId) ?? [];
    widgetIds.push(widget.id);
    categories.set(categoryId, widgetIds);
  }

  const orderedCategoryIds = Object.keys(CATEGORY_LABELS);
  const dynamicCategoryIds = Array.from(categories.keys()).filter(
    (categoryId) => !orderedCategoryIds.includes(categoryId)
  );

  return [...orderedCategoryIds, ...dynamicCategoryIds]
    .filter((categoryId) => (categories.get(categoryId)?.length ?? 0) > 0)
    .map((categoryId) => ({
      id: categoryId,
      label: CATEGORY_LABELS[categoryId] ?? categoryId,
      widgetIds: categories.get(categoryId) ?? [],
    }));
}

/** Dot + label showing how many of a widget's services are connected. */
function ConnectionBadge({
  connectedServices,
  totalServices,
}: {
  connectedServices: number;
  totalServices: number;
}) {
  if (totalServices === 0) return null;

  const getDotClass = () => {
    if (connectedServices === totalServices && connectedServices > 0) return "bg-success";
    if (connectedServices > 0) return "bg-warning";
    return "bg-dim";
  };
  const dotClass = getDotClass();

  const label =
    connectedServices > 0 ? `${connectedServices}/${totalServices} connected` : "Not connected";

  return (
    <div className="flex items-center gap-1.5">
      <span className={cn("inline-block h-2 w-2 shrink-0 rounded-full", dotClass)} />
      <span className="font-mono text-muted-foreground text-w-sm">{label}</span>
    </div>
  );
}

function WidgetCatalogCard({
  descriptor,
  isEnabled,
  connectedServices,
  totalServices,
  onToggle,
  onConfigure,
}: {
  descriptor: WidgetDescriptor;
  isEnabled: boolean;
  connectedServices: number;
  totalServices: number;
  onToggle: () => void;
  onConfigure: () => void;
}) {
  return (
    <SettingsCatalogCard
      enabled={isEnabled}
      title={descriptor.name}
      description={descriptor.description}
      status={
        <ConnectionBadge connectedServices={connectedServices} totalServices={totalServices} />
      }
      onOpen={onConfigure}
      openAriaLabel={`Configure ${descriptor.name}`}
      checked={isEnabled}
      onCheckedChange={onToggle}
      switchAriaLabel={isEnabled ? `Disable ${descriptor.name}` : `Enable ${descriptor.name}`}
      icon={
        <span
          className={cn(
            "icon-sm inline-flex items-center justify-center rounded-item border border-border",
            isEnabled ? "bg-secondary text-foreground-secondary" : "bg-muted text-muted-foreground"
          )}
          aria-hidden="true"
        >
          <Blocks className="h-2.5 w-2.5" />
        </span>
      }
      badges={
        <Badge variant="secondary">
          {isEnabled ? "enabled in layout" : "available for this layout"}
        </Badge>
      }
    />
  );
}

function WidgetCatalogGrid({
  widgets,
  widgetToCellId,
  countServices,
  onConfigure,
  onToggle,
}: {
  widgets: WidgetDescriptor[];
  widgetToCellId: Map<string, string>;
  countServices: (descriptor: WidgetDescriptor) => { connected: number; total: number };
  onConfigure: (widgetId: string) => void;
  onToggle: (widgetId: string) => void;
}) {
  if (widgets.length === 0) return null;

  return (
    <SettingsGrid columns={4}>
      {widgets.map((descriptor) => {
        const { connected, total } = countServices(descriptor);
        return (
          <WidgetCatalogCard
            key={descriptor.id}
            descriptor={descriptor}
            isEnabled={widgetToCellId.has(descriptor.id)}
            connectedServices={connected}
            totalServices={total}
            onToggle={() => onToggle(descriptor.id)}
            onConfigure={() => onConfigure(descriptor.id)}
          />
        );
      })}
    </SettingsGrid>
  );
}

// ---------------------------------------------------------------------------
// Main SettingsWidgets component
// ---------------------------------------------------------------------------

export function SettingsWidgets({
  onNavigateToIntegrations,
}: {
  onNavigateToIntegrations?: () => void;
}) {
  const {
    activeProjectSlug,
    activePage,
    activeLayout,
    projects,
    widgetLayout,
    widgetConfigs,
    updateWidgetLayout,
    updateWidgetConfig,
    preferences,
  } = useDashboard();
  const { connectedKeys } = useCredentials();
  const [configWidgetId, setConfigWidgetId] = useQueryState(
    VIEW_STATE_QUERY_KEYS.widgetConfig,
    parseAsString
  );
  const [categoryParam, setCategoryParam] = useQueryState(
    VIEW_STATE_QUERY_KEYS.widgetCategory,
    parseAsString
  );
  const [settingsInstallerParam, setSettingsInstallerParam] = useQueryState(
    VIEW_STATE_QUERY_KEYS.settingsInstaller,
    parseAsString
  );
  const [installerGithubUrl, setInstallerGithubUrl] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const installerOpen = settingsInstallerParam === "widgets";

  const visibleCellIds = useMemo(() => getVisibleCellIds(activeLayout), [activeLayout]);

  const widgetToCellId = useMemo(
    () =>
      getWidgetToVisibleCellIdMap(widgetLayout as Record<string, string | null>, visibleCellIds),
    [visibleCellIds, widgetLayout]
  );

  const allRegisteredWidgets = useMemo(() => Array.from(WIDGET_REGISTRY.values()), []);

  const intendedIntegrations = useMemo(
    () => new Set(preferences.intendedIntegrations ?? []),
    [preferences.intendedIntegrations]
  );

  // Show widgets whose required integration is connected OR intended (selected in onboarding)
  const allWidgets = useMemo(() => {
    if (connectedKeys.length === 0 && intendedIntegrations.size === 0) {
      return allRegisteredWidgets.filter((w) => w.requiredIntegrations.length === 0);
    }
    return allRegisteredWidgets.filter(
      (w) =>
        w.requiredIntegrations.length === 0 ||
        w.requiredIntegrations.some(
          (key) => connectedKeys.includes(key) || intendedIntegrations.has(key)
        )
    );
  }, [allRegisteredWidgets, connectedKeys, intendedIntegrations]);

  const hasNoIntegrations = connectedKeys.length === 0 && intendedIntegrations.size === 0;
  const configDescriptor = configWidgetId ? WIDGET_REGISTRY.get(configWidgetId) : null;
  const resolvedConfig = configDescriptor
    ? (widgetConfigs[configDescriptor.id] ?? configDescriptor.defaultConfig)
    : null;
  const displayTitle =
    configDescriptor && resolvedConfig
      ? (configDescriptor.getDisplayName?.({
          projectSlug: activeProjectSlug,
          projects,
          config: resolvedConfig,
        }) ?? configDescriptor.name)
      : null;

  const categories = useMemo(() => getWidgetCategories(allWidgets), [allWidgets]);
  const activeCategoryId = useMemo(
    () => normalizeCategoryId(categoryParam, categories),
    [categories, categoryParam]
  );
  const visibleCategorySections = useMemo(() => {
    const trimmedQuery = searchQuery.trim().toLowerCase();
    const matchingIds =
      trimmedQuery.length === 0
        ? null
        : new Set(
            allWidgets
              .filter(
                (widget) =>
                  widget.name.toLowerCase().includes(trimmedQuery) ||
                  widget.description.toLowerCase().includes(trimmedQuery) ||
                  widget.id.toLowerCase().includes(trimmedQuery)
              )
              .map((widget) => widget.id)
          );

    return filterCategorySections({
      categories: categories.map((category) => ({
        id: category.id,
        label: category.label,
        itemIds: category.widgetIds,
      })),
      activeCategoryId,
      matchingIds,
    });
  }, [activeCategoryId, allWidgets, categories, searchQuery]);

  function countServices(descriptor: WidgetDescriptor) {
    const authList = getAuthList(descriptor);
    const connectable = authList.filter((a) => a.type === "api_key" || a.type === "oauth");
    const total = connectable.length;
    const connected = connectable.filter((a) => {
      const credKey = a.id ?? descriptor.id;
      return connectedKeys.includes(credKey);
    }).length;
    return { connected, total };
  }

  function handleToggle(widgetId: string) {
    const layout = widgetLayout as Record<string, string | null>;
    const currentCellId = widgetToCellId.get(widgetId);
    if (currentCellId) {
      updateWidgetLayout({
        ...layout,
        [currentCellId]: null,
      });
      return;
    }

    const descriptor = WIDGET_REGISTRY.get(widgetId);
    if (!descriptor) return;

    updateWidgetLayout(
      placeWidgetInVisibleCells(
        layout,
        widgetId,
        visibleCellIds,
        getPreferredCellId(visibleCellIds, descriptor.defaultSlot)
      )
    );
  }

  function handleConfigChange(widgetId: string, key: string, value: unknown) {
    const current = widgetConfigs[widgetId] ?? {};
    updateWidgetConfig(widgetId, { ...current, [key]: value });
  }

  const connectedCount = allWidgets.filter((w) => widgetToCellId.has(w.id)).length;
  const activeContextLabel = activeProjectSlug
    ? (projects.find((project) => project.slug === activeProjectSlug)?.name ?? activeProjectSlug)
    : "All Projects";

  function openInstaller(githubUrl = "") {
    setInstallerGithubUrl(githubUrl);
    setSettingsInstallerParam("widgets");
  }

  return (
    <>
      <SettingsPageLayout
        title="Widgets"
        description={`Toggle widgets for ${activeContextLabel} / ${activePage.name} / ${activeLayout.name}. Click to configure.`}
        statusText={`${connectedCount}/${allWidgets.length} enabled`}
        searchPlaceholder="Search widgets..."
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        headerSlot={
          <SettingsPageToolbar
            navigation={
              <SettingsCategoryTabs
                categories={categories}
                activeCategoryId={activeCategoryId}
                onChange={(categoryId) => setCategoryParam(categoryId)}
              />
            }
            actions={
              <Button
                type="button"
                variant="outline"
                onClick={() => openInstaller()}
                uppercase={false}
                className="h-auto shrink-0 px-3 py-2 font-mono text-foreground-secondary text-w-sm uppercase tracking-wider hover:text-foreground"
              >
                Install from GitHub
              </Button>
            }
          />
        }
      >
        {hasNoIntegrations ? (
          <div className="rounded-item border border-border/60 border-dashed px-5 py-4">
            <p className="font-mono text-dim text-w-sm">
              Connect integrations to unlock more widgets.{" "}
              {onNavigateToIntegrations ? (
                <Button
                  variant="link"
                  onClick={onNavigateToIntegrations}
                  className="inline h-auto p-0 font-mono text-accent text-w-sm"
                >
                  Go to Integrations
                </Button>
              ) : null}
            </p>
          </div>
        ) : null}

        {visibleCategorySections.length === 0 ? (
          <>
            <EmptyState message="No widgets match your current filters." />
            <CommunityExtensionDiscovery
              type="widget"
              searchQuery={searchQuery}
              onInstall={openInstaller}
            />
          </>
        ) : (
          <>
            {visibleCategorySections.map((category) => {
              const widgets = category.itemIds
                .map((id) => WIDGET_REGISTRY.get(id))
                .filter((w): w is WidgetDescriptor => w !== undefined);

              if (widgets.length === 0) return null;

              const enabledInCategory = widgets.filter((w) => widgetToCellId.has(w.id)).length;

              return (
                <SettingsCardSection
                  key={category.id}
                  title={category.label}
                  badge={
                    enabledInCategory > 0 ? (
                      <span className="rounded-item border border-border bg-card px-2 py-0.5 font-mono text-muted-foreground text-w-sm">
                        {enabledInCategory} enabled
                      </span>
                    ) : undefined
                  }
                >
                  <WidgetCatalogGrid
                    widgets={widgets}
                    widgetToCellId={widgetToCellId}
                    countServices={countServices}
                    onConfigure={setConfigWidgetId}
                    onToggle={handleToggle}
                  />
                </SettingsCardSection>
              );
            })}
            <CommunityExtensionDiscovery
              type="widget"
              searchQuery={searchQuery}
              onInstall={openInstaller}
            />
          </>
        )}
      </SettingsPageLayout>

      <InstallExtensionDialog
        open={installerOpen}
        initialGithubUrl={installerGithubUrl}
        onOpenChange={(open) => {
          if (!open) setInstallerGithubUrl("");
          setSettingsInstallerParam(open ? "widgets" : null);
        }}
      />

      {/* Widget detail dialog */}
      {configDescriptor ? (
        <WidgetDetailDialog
          descriptor={configDescriptor}
          open={configWidgetId !== null}
          title={displayTitle ?? undefined}
          onOpenChange={(open) => {
            if (!open) setConfigWidgetId(null);
          }}
          config={resolvedConfig ?? configDescriptor.defaultConfig}
          onConfigReplace={(nextConfig) => updateWidgetConfig(configDescriptor.id, nextConfig)}
          onConfigChange={(key, value) => handleConfigChange(configDescriptor.id, key, value)}
          connectedKeys={connectedKeys}
          onNavigateToIntegrations={onNavigateToIntegrations}
        />
      ) : null}
    </>
  );
}
