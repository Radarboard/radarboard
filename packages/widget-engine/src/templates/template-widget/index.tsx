"use client";

import { SkeletonShimmer } from "@radarboard/ui/skeleton-shimmer";
import { synchronizeTemplateConfig } from "@radarboard/widget-sdk/recipe-model";
import { applyMaxItemsOverride } from "@radarboard/widget-sdk/section-utils";
import type { WidgetTemplateConfig } from "@radarboard/widget-sdk/types";
import type { WidgetChromeStatus, WidgetRenderProps } from "@radarboard/widget-sdk/widget-types";
import { useEffect } from "react";
import { WidgetNotConfigured } from "../../widget-not-configured";
import {
  DataResolverProvider,
  useAllSourcesLoading,
  useAnySourceUnconfigured,
  useResolvedSourceData,
} from "../data-resolver";
import { TemplateDetailHost } from "../detail-host";
import { TemplateFilterStateProvider } from "../filter-state";
import { SectionRenderer } from "../section-renderer";

/**
 * Map data-source IDs to service display names and optional credential keys.
 * When serviceId is omitted, clicking "Connect" opens Settings > Integrations
 * without pre-selecting a specific service (for multi-provider widgets).
 */
const DATA_SOURCE_SERVICE_MAP: Record<string, { name: string; serviceId?: string }> = {
  analytics: { name: "Analytics", serviceId: "intent:analytics" },
  "app-store": { name: "App Store Connect", serviceId: "app-store-connect" },
  "github-activity": { name: "GitHub", serviceId: "github" },
  "github-stars": { name: "GitHub", serviceId: "github" },
  githubSponsors: { name: "GitHub Sponsors", serviceId: "github" },
  "google-search-console": { name: "Google Search Console", serviceId: "google-search-console" },
  health: { name: "Monitoring" },
  "npm-downloads": { name: "npm", serviceId: "npm" },
  openCollective: { name: "Open Collective", serviceId: "open-collective" },
  raindrop: { name: "Raindrop", serviceId: "raindrop" },
  revenue: { name: "RevenueCat", serviceId: "revenuecat" },
  roadmap: { name: "Linear", serviceId: "linear" },
  sentry: { name: "Sentry", serviceId: "sentry" },
  shipping: { name: "Shipping" },
  vercel: { name: "Vercel", serviceId: "vercel" },
};

function resolveMaxItems(config: WidgetTemplateConfig): number | undefined {
  const raw = (config as unknown as Record<string, unknown>).maxItems;
  return typeof raw === "number" && raw > 0 ? raw : undefined;
}

/** Inner wrapper that reads loading/configured state from DataResolverProvider context. */
function TemplateShimmerContent({
  sections,
  dataSources,
  onSelectedDetailIdChange,
  onConnectService,
  onChromeStateChange,
}: {
  sections: WidgetTemplateConfig["sections"];
  dataSources: WidgetTemplateConfig["dataSources"];
  onSelectedDetailIdChange?: (id: string | null) => void;
  onConnectService?: (serviceId: string) => void;
  onChromeStateChange?: (status: WidgetChromeStatus) => void;
}) {
  const loading = useAllSourcesLoading();
  const unconfigured = useAnySourceUnconfigured();
  const firstSourceId = dataSources[0]?.id;
  const firstSourceData = useResolvedSourceData(firstSourceId);

  useEffect(() => {
    onChromeStateChange?.(!loading && unconfigured ? "disconnected" : "default");
  }, [loading, onChromeStateChange, unconfigured]);

  if (!loading && unconfigured) {
    const service = firstSourceId ? DATA_SOURCE_SERVICE_MAP[firstSourceId] : undefined;
    const setupState =
      firstSourceData && typeof firstSourceData === "object"
        ? (firstSourceData as {
            ctaLabel?: string;
            ctaTarget?: string;
            setupMessage?: string;
          })
        : null;
    return (
      <WidgetNotConfigured
        serviceName={service?.name ?? "Service"}
        serviceId={setupState?.ctaTarget ?? service?.serviceId}
        message={setupState?.setupMessage}
        actionLabel={setupState?.ctaLabel}
        onConnect={onConnectService}
      />
    );
  }

  return (
    <SkeletonShimmer className="min-h-0 flex-1" loading={loading}>
      <div className="flex h-full min-h-0 flex-1 flex-col">
        <SectionRenderer sections={sections} onSelectedDetailIdChange={onSelectedDetailIdChange} />
      </div>
    </SkeletonShimmer>
  );
}

export function TemplateWidget({
  widgetId,
  projectSlug,
  timeRange,
  config,
  selectedDetailId,
  onSelectedDetailIdChange,
  onFetchedAt,
  onRefetch,
  onChromeStateChange,
  onConnectService,
}: WidgetRenderProps<WidgetTemplateConfig>) {
  const normalizedConfig = synchronizeTemplateConfig(config);
  const widgetMaxItems = resolveMaxItems(config);
  const sections = widgetMaxItems
    ? applyMaxItemsOverride(normalizedConfig.sections, widgetMaxItems)
    : normalizedConfig.sections;

  return (
    <DataResolverProvider
      widgetId={widgetId ?? null}
      dataSources={normalizedConfig.dataSources}
      projectSlug={projectSlug}
      timeRange={timeRange}
      config={normalizedConfig}
      onFetchedAt={onFetchedAt}
      onRefetch={onRefetch}
    >
      <TemplateFilterStateProvider>
        <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col">
          <TemplateShimmerContent
            sections={sections}
            dataSources={normalizedConfig.dataSources}
            onSelectedDetailIdChange={onSelectedDetailIdChange}
            onConnectService={onConnectService}
            onChromeStateChange={onChromeStateChange}
          />
          <TemplateDetailHost
            widgetId={widgetId ?? null}
            sections={sections}
            selectedDetailId={selectedDetailId}
            onSelectedDetailIdChange={onSelectedDetailIdChange}
            projectSlug={projectSlug}
          />
        </div>
      </TemplateFilterStateProvider>
    </DataResolverProvider>
  );
}

export function TemplateWidgetExpanded({
  widgetId,
  projectSlug,
  timeRange,
  config,
  selectedDetailId,
  onSelectedDetailIdChange,
  onFetchedAt,
  onRefetch,
  onChromeStateChange,
  onConnectService,
}: WidgetRenderProps<WidgetTemplateConfig>) {
  const normalizedConfig = synchronizeTemplateConfig(config);
  const widgetMaxItems = resolveMaxItems(config);
  const baseSections = normalizedConfig.expandedSections ?? normalizedConfig.sections;
  const sections = widgetMaxItems
    ? applyMaxItemsOverride(baseSections, widgetMaxItems)
    : baseSections;

  return (
    <DataResolverProvider
      widgetId={widgetId ?? null}
      dataSources={normalizedConfig.dataSources}
      projectSlug={projectSlug}
      timeRange={timeRange}
      config={normalizedConfig}
      onFetchedAt={onFetchedAt}
      onRefetch={onRefetch}
    >
      <TemplateFilterStateProvider>
        <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col">
          <TemplateShimmerContent
            sections={sections}
            dataSources={normalizedConfig.dataSources}
            onSelectedDetailIdChange={onSelectedDetailIdChange}
            onConnectService={onConnectService}
            onChromeStateChange={onChromeStateChange}
          />
          <TemplateDetailHost
            widgetId={widgetId ?? null}
            sections={sections}
            selectedDetailId={selectedDetailId}
            onSelectedDetailIdChange={onSelectedDetailIdChange}
            projectSlug={projectSlug}
          />
        </div>
      </TemplateFilterStateProvider>
    </DataResolverProvider>
  );
}
