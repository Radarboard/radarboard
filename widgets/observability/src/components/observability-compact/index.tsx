"use client";

import { useDashboard } from "@radarboard/hooks/use-dashboard";
import type { TemplateRecipeModel } from "@radarboard/widget-engine/templates";
import {
  buildTemplateRecipe,
  createRailListRecipe,
  TemplateWidget,
  type WidgetTemplateConfig,
} from "@radarboard/widget-engine/templates";
import type { WidgetRenderProps } from "@radarboard/widget-sdk/widget-types";
import { domAnimation, LazyMotion, m } from "motion/react";
import { type ObservabilityMode as DetailMode, resolveObservabilityMode } from "../../capabilities";

// --- Sentry template config ---

export const SENTRY_DETAIL_TEMPLATE_CONFIG: WidgetTemplateConfig = {
  dataSources: [{ id: "sentry" }],
  recipe: {
    kind: "rail_list",
    summary: [],
    railWidth: 192,
    rail: [
      {
        type: "headline-stat",
        source: { sourceId: "sentry", field: "unresolvedCount", format: "number" },
        label: "issues",
        indicatorColor: "#e05555",
      },
      {
        type: "chart",
        variant: "line",
        source: { sourceId: "sentry", field: "errorTrend" },
        xKey: "date",
        yKey: "value",
        height: 120,
        color: "#e05555",
      },
    ],
    content: [
      {
        type: "row-list",
        source: { sourceId: "sentry", field: "issues" },
        emptyMessage: "No unresolved issues",
        hrefSource: { sourceId: "sentry", field: "permalink" },
        hrefTarget: "_blank",
        itemTemplate: {
          status: {
            source: { sourceId: "sentry", field: "level" },
            display: "severity-icon",
          },
          title: { sourceId: "sentry", field: "title" },
          badge: {
            label: { sourceId: "sentry", field: "projectSlug" },
            color: { sourceId: "sentry", field: "projectColor" },
          },
          subtitle: { sourceId: "sentry", field: "culprit" },
          value: { sourceId: "sentry", field: "count", format: "number" },
          timestamp: { sourceId: "sentry", field: "lastSeen", format: "relative-time" },
        },
      },
    ],
  },
  sections: createRailListRecipe({
    railWidth: 192,
    rail: [
      {
        type: "headline-stat",
        source: { sourceId: "sentry", field: "unresolvedCount", format: "number" },
        label: "issues",
        indicatorColor: "#e05555",
      },
      {
        type: "chart",
        variant: "line",
        source: { sourceId: "sentry", field: "errorTrend" },
        xKey: "date",
        yKey: "value",
        height: 120,
        color: "#e05555",
      },
    ],
    list: {
      type: "row-list",
      source: { sourceId: "sentry", field: "issues" },
      emptyMessage: "No unresolved issues",
      hrefSource: { sourceId: "sentry", field: "permalink" },
      hrefTarget: "_blank",
      itemTemplate: {
        status: {
          source: { sourceId: "sentry", field: "level" },
          display: "severity-icon",
        },
        title: { sourceId: "sentry", field: "title" },
        badge: {
          label: { sourceId: "sentry", field: "projectSlug" },
          color: { sourceId: "sentry", field: "projectColor" },
        },
        subtitle: { sourceId: "sentry", field: "culprit" },
        value: { sourceId: "sentry", field: "count", format: "number" },
        timestamp: { sourceId: "sentry", field: "lastSeen", format: "relative-time" },
      },
    },
  }),
};

const HEALTH_COMPACT_RECIPE: TemplateRecipeModel = {
  kind: "summary_list",
  summary: [
    {
      type: "headline-stat",
      source: { sourceId: "health", field: "upCount", format: "number" },
      label: "monitors up",
      indicatorColor: "#4ade80",
    },
    {
      type: "kpi-row",
      columns: 2,
      variant: "compact",
      metrics: [
        {
          label: "Incidents",
          source: { sourceId: "health", field: "incidentsCount", format: "number" },
        },
        {
          label: "Avg ms",
          source: { sourceId: "health", field: "avgResponseMs", format: "number" },
        },
      ],
    },
  ],
  rail: [],
  content: [
    {
      type: "row-list",
      source: { sourceId: "health", field: "healthChecks" },
      emptyMessage: "No monitors configured",
      itemTemplate: {
        status: {
          source: { sourceId: "health", field: "statusTone" },
        },
        title: { sourceId: "health", field: "titleText" },
        subtitle: { sourceId: "health", field: "subtitleText" },
        value: { sourceId: "health", field: "valueText" },
        timestamp: { sourceId: "health", field: "timestampLabel" },
      },
    },
  ],
};

const HEALTH_EXPANDED_RECIPE: TemplateRecipeModel = {
  kind: "summary_content",
  summary: HEALTH_COMPACT_RECIPE.summary,
  rail: [],
  content: [
    {
      type: "tabs",
      defaultTab: "checks",
      variant: "expanded",
      tabs: [
        {
          id: "checks",
          label: "Checks",
          sections: [
            {
              type: "table",
              source: { sourceId: "health", field: "healthChecks" },
              searchable: true,
              defaultSort: { key: "responseTimeMs", direction: "asc" },
              columns: [
                { key: "name", header: "Check", sortable: true },
                { key: "status", header: "Status", sortable: true },
                { key: "responseTimeMs", header: "Response", sortable: true, format: "number" },
                { key: "lastCheckedAt", header: "Checked", sortable: true },
              ],
            },
          ],
        },
        {
          id: "incidents",
          label: "Incidents",
          sections: [
            {
              type: "row-list",
              source: { sourceId: "health", field: "incidents" },
              emptyMessage: "No incidents",
              itemTemplate: {
                status: {
                  source: { sourceId: "health", field: "statusTone" },
                },
                title: { sourceId: "health", field: "titleText" },
                subtitle: { sourceId: "health", field: "subtitleText" },
                timestamp: { sourceId: "health", field: "timestampLabel" },
              },
            },
          ],
        },
      ],
    },
  ],
};

export const HEALTH_DETAIL_TEMPLATE_CONFIG: WidgetTemplateConfig = {
  dataSources: [{ id: "health" }],
  recipe: HEALTH_COMPACT_RECIPE,
  sections: buildTemplateRecipe(HEALTH_COMPACT_RECIPE),
  expandedRecipe: HEALTH_EXPANDED_RECIPE,
  expandedSections: buildTemplateRecipe(HEALTH_EXPANDED_RECIPE),
};

const APP_STORE_RECIPE: WidgetTemplateConfig["recipe"] = {
  kind: "rail_content",
  summary: [],
  railWidth: 208,
  rail: [
    {
      type: "overview-panel",
      eyebrow: "Review Pulse",
      titleSource: { sourceId: "app-store", field: "appName" },
      metricLabel: "Rating",
      metricSource: { sourceId: "app-store", field: "averageRating", format: "number" },
      metricToneSource: { sourceId: "app-store", field: "averageRatingTone" },
      badgeSource: { sourceId: "app-store", field: "reviewPressureLabel" },
      badgeToneSource: { sourceId: "app-store", field: "reviewPressureTone" },
      descriptionSource: { sourceId: "app-store", field: "reviewSummaryText" },
      rows: [
        { label: "Reviews", source: { sourceId: "app-store", field: "totalReviewsLabel" } },
        {
          label: "Low",
          source: { sourceId: "app-store", field: "recentNegativeReviews", format: "number" },
        },
        {
          label: "Positive",
          source: { sourceId: "app-store", field: "recentPositiveReviews", format: "number" },
        },
      ],
      footerStart: { sourceId: "app-store", field: "latestVersion" },
      footerEnd: { sourceId: "app-store", field: "latestVersionMeta" },
    },
  ],
  content: [
    {
      type: "row-list",
      source: { sourceId: "app-store", field: "reviews" },
      emptyMessage: "App Store Connect not configured or no reviews yet",
      itemTemplate: {
        title: { sourceId: "app-store", field: "titleText" },
        subtitle: { sourceId: "app-store", field: "subtitleText" },
        value: { sourceId: "app-store", field: "ratingLabel" },
        timestamp: { sourceId: "app-store", field: "timestampLabel" },
        badge: {
          label: { sourceId: "app-store", field: "ratingLabel" },
          color: { sourceId: "app-store", field: "ratingColor" },
        },
      },
    },
  ],
};

const APP_STORE_EXPANDED_RECIPE: WidgetTemplateConfig["recipe"] = {
  ...APP_STORE_RECIPE,
  railWidth: 224,
};

export const APP_STORE_DETAIL_TEMPLATE_CONFIG: WidgetTemplateConfig = {
  dataSources: [{ id: "app-store" }],
  recipe: APP_STORE_RECIPE,
  sections: buildTemplateRecipe(APP_STORE_RECIPE),
  expandedRecipe: APP_STORE_EXPANDED_RECIPE,
  expandedSections: buildTemplateRecipe(APP_STORE_EXPANDED_RECIPE),
};

export function getResolvedSentryTemplateConfig(
  config: Record<string, unknown>
): WidgetTemplateConfig {
  const stored = config.sentryTemplateConfig;
  if (
    stored &&
    typeof stored === "object" &&
    Array.isArray((stored as WidgetTemplateConfig).dataSources) &&
    Array.isArray((stored as WidgetTemplateConfig).sections)
  ) {
    return stored as WidgetTemplateConfig;
  }

  return SENTRY_DETAIL_TEMPLATE_CONFIG;
}

export function getResolvedHealthTemplateConfig(
  config: Record<string, unknown>
): WidgetTemplateConfig {
  const stored = config.healthTemplateConfig;
  if (
    stored &&
    typeof stored === "object" &&
    Array.isArray((stored as WidgetTemplateConfig).dataSources) &&
    Array.isArray((stored as WidgetTemplateConfig).sections)
  ) {
    return stored as WidgetTemplateConfig;
  }

  return HEALTH_DETAIL_TEMPLATE_CONFIG;
}

export function getResolvedAppStoreTemplateConfig(
  config: Record<string, unknown>
): WidgetTemplateConfig {
  const stored = config.appStoreTemplateConfig;
  if (
    stored &&
    typeof stored === "object" &&
    Array.isArray((stored as WidgetTemplateConfig).dataSources) &&
    Array.isArray((stored as WidgetTemplateConfig).sections)
  ) {
    return stored as WidgetTemplateConfig;
  }

  return APP_STORE_DETAIL_TEMPLATE_CONFIG;
}

// --- Title resolution ---

const TITLES: Record<DetailMode, string> = {
  sentry: "Errors",
  appstore: "App Store",
  health: "Health Monitors",
};

const DESCRIPTIONS: Record<DetailMode, string> = {
  sentry: "Sentry error tracking, unresolved issues, and error trends",
  appstore: "App Store reviews, rating trends, and recent customer feedback",
  health: "Uptime checks, incidents, and service response times",
};

/** Resolves the display name for the detail panel based on available integrations. */
export function getDetailTitle(
  projects: import("@radarboard/types/project").Project[],
  projectSlug: string | null
): string {
  return TITLES[resolveObservabilityMode(projects, projectSlug)];
}

export function getDetailDescription(
  projects: import("@radarboard/types/project").Project[],
  projectSlug: string | null
): string {
  return DESCRIPTIONS[resolveObservabilityMode(projects, projectSlug)];
}

export { resolveObservabilityMode as resolveMode };

// --- Summary-only variant configs (no lists, just KPIs) ---

export const SENTRY_SUMMARY_CONFIG: WidgetTemplateConfig = {
  dataSources: [{ id: "sentry" }],
  sections: [
    {
      type: "headline-stat",
      source: { sourceId: "sentry", field: "unresolvedCount", format: "number" },
      label: "unresolved issues",
      indicatorColor: "#e05555",
    },
    {
      type: "chart",
      variant: "line",
      source: { sourceId: "sentry", field: "errorTrend" },
      xKey: "date",
      yKey: "value",
      height: 160,
      color: "#e05555",
    },
  ],
};

export const HEALTH_SUMMARY_CONFIG: WidgetTemplateConfig = {
  dataSources: [{ id: "health" }],
  sections: [
    {
      type: "headline-stat",
      source: { sourceId: "health", field: "upCount", format: "number" },
      label: "monitors up",
      indicatorColor: "#4ade80",
    },
    {
      type: "kpi-row",
      columns: 2,
      metrics: [
        {
          label: "Incidents",
          source: { sourceId: "health", field: "incidentsCount", format: "number" },
        },
        {
          label: "Avg Response",
          source: { sourceId: "health", field: "avgResponseMs", format: "number" },
        },
      ],
    },
  ],
};

export const APP_STORE_SUMMARY_CONFIG: WidgetTemplateConfig = {
  dataSources: [{ id: "app-store" }],
  sections: [
    {
      type: "overview-panel",
      eyebrow: "Review Pulse",
      titleSource: { sourceId: "app-store", field: "appName" },
      metricLabel: "Rating",
      metricSource: { sourceId: "app-store", field: "averageRating", format: "number" },
      metricToneSource: { sourceId: "app-store", field: "averageRatingTone" },
      badgeSource: { sourceId: "app-store", field: "reviewPressureLabel" },
      badgeToneSource: { sourceId: "app-store", field: "reviewPressureTone" },
      descriptionSource: { sourceId: "app-store", field: "reviewSummaryText" },
      rows: [
        { label: "Reviews", source: { sourceId: "app-store", field: "totalReviewsLabel" } },
        {
          label: "Low",
          source: { sourceId: "app-store", field: "recentNegativeReviews", format: "number" },
        },
        {
          label: "Positive",
          source: { sourceId: "app-store", field: "recentPositiveReviews", format: "number" },
        },
      ],
      footerStart: { sourceId: "app-store", field: "latestVersion" },
      footerEnd: { sourceId: "app-store", field: "latestVersionMeta" },
    },
  ],
};

/** Resolve the summary-only config for a given mode. */
function _getResolvedSummarySentryConfig(config: Record<string, unknown>): WidgetTemplateConfig {
  const stored = config.sentrySummaryConfig;
  if (
    stored &&
    typeof stored === "object" &&
    Array.isArray((stored as WidgetTemplateConfig).dataSources)
  ) {
    return stored as WidgetTemplateConfig;
  }
  return SENTRY_SUMMARY_CONFIG;
}

function _getResolvedSummaryHealthConfig(config: Record<string, unknown>): WidgetTemplateConfig {
  const stored = config.healthSummaryConfig;
  if (
    stored &&
    typeof stored === "object" &&
    Array.isArray((stored as WidgetTemplateConfig).dataSources)
  ) {
    return stored as WidgetTemplateConfig;
  }
  return HEALTH_SUMMARY_CONFIG;
}

function _getResolvedSummaryAppStoreConfig(config: Record<string, unknown>): WidgetTemplateConfig {
  const stored = config.appStoreSummaryConfig;
  if (
    stored &&
    typeof stored === "object" &&
    Array.isArray((stored as WidgetTemplateConfig).dataSources)
  ) {
    return stored as WidgetTemplateConfig;
  }
  return APP_STORE_SUMMARY_CONFIG;
}

// --- Compact View ---

export function DetailCompact({
  widgetId,
  projectSlug,
  config,
  onFetchedAt,
  onRefetch,
  onChromeStateChange,
  onConnectService,
}: WidgetRenderProps) {
  const { projects } = useDashboard();
  const mode = resolveObservabilityMode(projects, projectSlug);
  const getTemplateConfig = () => {
    if (mode === "sentry")
      return getResolvedSentryTemplateConfig(config as Record<string, unknown>);
    if (mode === "appstore")
      return getResolvedAppStoreTemplateConfig(config as Record<string, unknown>);
    return getResolvedHealthTemplateConfig(config as Record<string, unknown>);
  };
  const templateConfig = getTemplateConfig();

  return (
    <LazyMotion features={domAnimation}>
      <m.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="h-full"
      >
        <TemplateWidget
          widgetId={widgetId}
          projectSlug={projectSlug}
          config={templateConfig}
          onFetchedAt={onFetchedAt}
          onRefetch={onRefetch}
          onChromeStateChange={onChromeStateChange}
          onConnectService={onConnectService}
        />
      </m.div>
    </LazyMotion>
  );
}
