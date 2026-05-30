"use client";

/**
 * SEO Performance — Compact grid view
 */

import { useWidgetCallbacks } from "@radarboard/widget-engine/hooks/use-widget-callbacks";
import {
  createSummaryListRecipe,
  type SectionConfig,
  synchronizeTemplateConfig,
  TemplateWidget,
  type WidgetTemplateConfig,
} from "@radarboard/widget-engine/templates";
import { WidgetNotConfigured } from "@radarboard/widget-engine/widget-not-configured";
import type { WidgetRenderProps } from "@radarboard/widget-sdk/widget-types";
import { domAnimation, LazyMotion, m } from "motion/react";
import { useSeo } from "../../hooks/use-seo";

const SEO_TEMPLATE_CONFIG: WidgetTemplateConfig = {
  dataSources: [{ id: "google-search-console" }],
  sections: createSummaryListRecipe({
    summary: [
      {
        type: "kpi-row",
        columns: 4,
        variant: "compact",
        metrics: [
          {
            label: "Clicks",
            source: { sourceId: "google-search-console", field: "totalClicks", format: "number" },
            changeSource: {
              sourceId: "google-search-console",
              field: "clicksChange",
              format: "percent",
              precision: 1,
            },
            sparklineSource: { sourceId: "google-search-console", field: "clicksTrend" },
          },
          {
            label: "Impressions",
            source: {
              sourceId: "google-search-console",
              field: "totalImpressions",
              format: "number",
              compact: true,
            },
            changeSource: {
              sourceId: "google-search-console",
              field: "impressionsChange",
              format: "percent",
              precision: 1,
            },
            sparklineSource: { sourceId: "google-search-console", field: "impressionsTrend" },
          },
          {
            label: "CTR",
            source: {
              sourceId: "google-search-console",
              field: "avgCtr",
              format: "percent",
              precision: 1,
            },
            changeSource: {
              sourceId: "google-search-console",
              field: "ctrChange",
              format: "percent",
              precision: 1,
            },
            sparklineSource: { sourceId: "google-search-console", field: "ctrTrend" },
          },
          {
            label: "Position",
            source: {
              sourceId: "google-search-console",
              field: "avgPosition",
              format: "number",
              precision: 1,
            },
            changeSource: {
              sourceId: "google-search-console",
              field: "positionChange",
              format: "percent",
              precision: 1,
            },
            sparklineSource: { sourceId: "google-search-console", field: "positionTrend" },
          },
        ],
      },
    ],
    list: {
      type: "list",
      source: { sourceId: "google-search-console", field: "queries" },
      layout: "inline",
      inlineHeader: {
        gridTemplateColumns: "minmax(0,1fr) 70px 70px 60px",
        columns: [
          { slot: "title", label: "Query" },
          { slot: "subtitle", label: "Clicks", align: "right" },
          { slot: "value", label: "Impr", align: "right" },
          { slot: "timestamp", label: "Pos", align: "right" },
        ],
      },
      emptyMessage: "No queries",
      selection: {
        selectionId: "seo-query",
        keyField: "detailKey",
        detailRendererId: "seo.query",
      },
      itemTemplate: {
        title: { sourceId: "google-search-console", field: "query" },
        subtitle: { sourceId: "google-search-console", field: "clicks", format: "number" },
        value: { sourceId: "google-search-console", field: "impressions", format: "number" },
        timestamp: {
          sourceId: "google-search-console",
          field: "position",
          format: "number",
          precision: 1,
        },
        status: { sourceId: "google-search-console", field: "projectColor" },
      },
    },
  }),
};

export { SEO_TEMPLATE_CONFIG };

function checkSources(sources: ({ sourceId?: string } | undefined)[], sourceId: string): boolean {
  return sources.filter(Boolean).every((s) => s?.sourceId === sourceId);
}

function checkSummarySlot(
  slot: { kind: string; source?: { sourceId?: string } } & Record<string, unknown>,
  sid: string
): boolean {
  if (slot.kind === "empty") return true;
  return checkSources(
    [
      slot.source,
      slot.kind === "metric" ? (slot.subtitle as { sourceId?: string }) : undefined,
      slot.kind === "metric" ? (slot.footerStart as { sourceId?: string }) : undefined,
      slot.kind === "metric" ? (slot.footerEnd as { sourceId?: string }) : undefined,
      slot.kind === "metric" ? (slot.footerColor as { sourceId?: string }) : undefined,
      slot.kind === "metric" ? (slot.changeSource as { sourceId?: string }) : undefined,
      slot.kind === "metric" ? (slot.sparklineSource as { sourceId?: string }) : undefined,
      slot.kind === "metric" ? (slot.breakdownSource as { sourceId?: string }) : undefined,
    ],
    sid
  );
}

function checkSummaryQuad(
  section: { slots: { kind: string; source?: { sourceId?: string } }[] },
  sid: string
): boolean {
  // biome-ignore lint/suspicious/noExplicitAny: complex union of slot types
  return section.slots.every((slot) => checkSummarySlot(slot as any, sid));
}

function sectionUsesOnlySeoSource(section: SectionConfig): boolean {
  const sid = "google-search-console";
  switch (section.type) {
    case "alert":
      return (
        (!section.source || section.source.sourceId === sid) &&
        (!section.condition || section.condition.source.sourceId === sid)
      );
    case "headline-stat":
      return section.source.sourceId === sid;
    case "overview-panel":
      return checkSources(
        [
          section.titleSource,
          section.metricSource,
          section.metricToneSource,
          section.badgeSource,
          section.badgeToneSource,
          section.descriptionSource,
          section.footerStart,
          section.footerEnd,
          ...(section.rows?.flatMap((row) => [row.source, row.toneSource]) ?? []),
        ],
        sid
      );
    case "kpi-row":
      return section.metrics.every((m) =>
        checkSources(
          [m.source, m.changeSource, m.sparklineSource, m.breakdownSource, m.valueColorSource],
          sid
        )
      );
    case "summary-quad":
      return checkSummaryQuad(section, sid);
    case "list":
      return checkSources(
        [
          section.source,
          section.hrefSource,
          section.selection?.source,
          section.itemTemplate.title,
          section.itemTemplate.subtitle,
          section.itemTemplate.value,
          section.itemTemplate.valueColor,
          section.itemTemplate.timestamp,
          section.itemTemplate.timestampColor,
          section.itemTemplate.status,
          section.itemTemplate.badge?.label,
          section.itemTemplate.badge?.color,
        ],
        sid
      );
    case "row-list":
      return checkSources(
        [
          section.source,
          section.hrefSource,
          section.selection?.source,
          section.itemTemplate.title,
          section.itemTemplate.subtitle,
          section.itemTemplate.value,
          section.itemTemplate.timestamp,
          section.itemTemplate.timestampColor,
          section.itemTemplate.badge?.label,
          section.itemTemplate.badge?.color,
          section.itemTemplate.status?.source,
        ],
        sid
      );
    case "table":
    case "activity-chart":
    case "chart":
      return section.source.sourceId === sid;
    case "card-list":
      return checkSources(
        [
          section.source,
          section.titleSource,
          section.subtitleSource,
          section.descriptionSource,
          section.imageSource,
          section.badgeSource,
          section.selection?.source,
          section.hrefSource,
          ...(section.meta?.map((item) => item.source) ?? []),
        ],
        sid
      );
    case "dense-ranked-table":
      return checkSources([section.source, section.selection?.source], sid);
    case "grid":
    case "stack":
      return section.sections.every(sectionUsesOnlySeoSource);
    case "split":
      return [...(section.left ?? []), ...section.right].every(sectionUsesOnlySeoSource);
    case "tabs":
      return section.tabs.every((tab) => tab.sections.every(sectionUsesOnlySeoSource));
    default:
      return false;
  }
}

function isSeoTemplateConfig(config: unknown): config is WidgetTemplateConfig {
  if (!config || typeof config !== "object") return false;
  const candidate = config as Partial<WidgetTemplateConfig>;
  if (!Array.isArray(candidate.dataSources) || !Array.isArray(candidate.sections)) return false;
  if (!candidate.dataSources.every((source) => source?.id === "google-search-console"))
    return false;

  const normalized = synchronizeTemplateConfig(candidate as WidgetTemplateConfig);
  return normalized.sections.every(sectionUsesOnlySeoSource);
}

export { isSeoTemplateConfig };

export function SeoCompact({
  widgetId,
  projectSlug,
  timeRange = "30d",
  config,
  selectedDetailId,
  onSelectedDetailIdChange,
  onFetchedAt,
  onRefetch,
  onChromeStateChange,
  activeVariantId,
  onConnectService,
}: WidgetRenderProps<WidgetTemplateConfig>) {
  const {
    data: seoData,
    configured,
    loading,
    fetchedAt,
    refetch,
    error,
  } = useSeo(projectSlug, null, timeRange);

  useWidgetCallbacks({
    widgetId,
    projectSlug,
    timeRange,
    sourceIds: ["google-search-console"],
    fetchedAt: configured ? fetchedAt : null,
    loading,
    error,
    refetch,
    chromeStatus: !loading && !configured ? "disconnected" : "default",
    onFetchedAt,
    onRefetch,
    onChromeStateChange,
  });

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center font-mono text-dim text-w-base">
        Loading...
      </div>
    );
  }

  if (!seoData || !configured) {
    const setupState =
      seoData && typeof seoData === "object"
        ? (seoData as {
            ctaLabel?: string;
            ctaTarget?: string;
            setupMessage?: string;
          })
        : null;
    return (
      <WidgetNotConfigured
        serviceName="Google Search Console"
        serviceId={setupState?.ctaTarget ?? "google-search-console"}
        message={setupState?.setupMessage}
        actionLabel={setupState?.ctaLabel}
        onConnect={onConnectService}
      />
    );
  }

  const isAllProjects = projectSlug === null;
  const forceQueriesLayout = isAllProjects && activeVariantId === "overview";

  let templateConfig = SEO_TEMPLATE_CONFIG;
  if (!forceQueriesLayout && isSeoTemplateConfig(config)) {
    templateConfig = synchronizeTemplateConfig(config);
  }

  return (
    <LazyMotion features={domAnimation}>
      <m.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="flex h-full min-h-0 w-full min-w-0 flex-col"
      >
        <TemplateWidget
          widgetId={widgetId}
          projectSlug={projectSlug}
          timeRange={timeRange}
          config={templateConfig}
          selectedDetailId={selectedDetailId}
          onSelectedDetailIdChange={onSelectedDetailIdChange}
          onFetchedAt={onFetchedAt}
          onRefetch={onRefetch}
          onChromeStateChange={onChromeStateChange}
        />
      </m.div>
    </LazyMotion>
  );
}
