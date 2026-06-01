// @generated — do not edit manually. Run `pnpm generate:extensions` to regenerate.

/**
 * Registers all first-party widgets.
 */

// ─── Widget descriptors ──────────────────────────────────────────────────────
import { analyticsDescriptor } from "@radarboard/widget-analytics";
import { bookmarksDescriptor } from "@radarboard/widget-bookmarks";
import { registerWidget } from "@radarboard/widget-engine/widgets/registry";
import { logsDescriptor } from "@radarboard/widget-logs";
import { observabilityDescriptor } from "@radarboard/widget-observability";
import { revenueDescriptor } from "@radarboard/widget-revenue";
import { roadmapDescriptor } from "@radarboard/widget-roadmap";
import { registerTemplateDataSourceId } from "@radarboard/widget-sdk/data-source-registry";
import type { WidgetDescriptor } from "@radarboard/widget-sdk/widget-types";
import { seoDescriptor } from "@radarboard/widget-seo";
import { shippingDescriptor } from "@radarboard/widget-shipping";
import { sponsorshipDescriptor } from "@radarboard/widget-sponsorship";

function templateDataSourceIds(configValue: unknown): string[] {
  if (configValue === null || typeof configValue !== "object") return [];
  const dataSources = (configValue as { dataSources?: unknown }).dataSources;
  if (!Array.isArray(dataSources)) return [];

  return dataSources
    .map((dataSource) =>
      dataSource !== null && typeof dataSource === "object"
        ? (dataSource as { id?: unknown }).id
        : null
    )
    .filter((id): id is string => typeof id === "string" && id.length > 0);
}

function registerWidgetTemplateDataSources<TConfig>(
  descriptor: Pick<WidgetDescriptor<TConfig>, "defaultConfig" | "variants" | "visualEditor">
) {
  const configs: unknown[] = [
    descriptor.defaultConfig,
    ...(descriptor.variants ?? []).map((variant) => variant.config),
  ];

  try {
    configs.push(
      descriptor.visualEditor?.getConfig?.({
        projectSlug: null,
        projects: [],
        config: descriptor.defaultConfig,
      })
    );
  } catch (error) {
    if (
      !(
        error instanceof Error &&
        error.message.includes("from the server") &&
        error.message.includes("client")
      )
    ) {
      throw error;
    }
  }

  for (const sourceId of new Set(configs.flatMap(templateDataSourceIds))) {
    registerTemplateDataSourceId(sourceId);
  }
}

export function initializeWidgetDescriptors() {
  // Register Descriptors
  registerWidget(analyticsDescriptor);
  registerWidgetTemplateDataSources(analyticsDescriptor);
  registerWidget(logsDescriptor);
  registerWidgetTemplateDataSources(logsDescriptor);
  registerWidget(observabilityDescriptor);
  registerWidgetTemplateDataSources(observabilityDescriptor);
  registerWidget(bookmarksDescriptor);
  registerWidgetTemplateDataSources(bookmarksDescriptor);
  registerWidget(revenueDescriptor);
  registerWidgetTemplateDataSources(revenueDescriptor);
  registerWidget(roadmapDescriptor);
  registerWidgetTemplateDataSources(roadmapDescriptor);
  registerWidget(seoDescriptor);
  registerWidgetTemplateDataSources(seoDescriptor);
  registerWidget(shippingDescriptor);
  registerWidgetTemplateDataSources(shippingDescriptor);
  registerWidget(sponsorshipDescriptor);
  registerWidgetTemplateDataSources(sponsorshipDescriptor);
}

export function initializeWidgets(): Promise<void> {
  initializeWidgetDescriptors();

  return Promise.all([
    import("@radarboard/widget-analytics/data-resolver"),
    import("@radarboard/widget-observability/data-resolver"),
    import("@radarboard/widget-bookmarks/data-resolver"),
    import("@radarboard/widget-revenue/data-resolver"),
    import("@radarboard/widget-roadmap/data-resolver"),
    import("@radarboard/widget-seo/data-resolver"),
    import("@radarboard/widget-shipping/data-resolver"),
    import("@radarboard/widget-sponsorship/data-resolver"),
    import("@radarboard/widget-analytics/init").then((mod) => mod.initializeAnalyticsWidget()),
    import("@radarboard/widget-bookmarks/init").then((mod) => mod.initializeBookmarksWidget()),
    import("@radarboard/widget-seo/init").then((mod) => mod.initializeSeoWidget()),
    import("@radarboard/widget-shipping/init").then((mod) => mod.initializeShippingWidget()),
    import("@radarboard/widget-sponsorship/init").then((mod) => mod.initializeSponsorshipWidget()),
  ]).then(() => undefined);
}
