"use client";

/**
 * GitHub Stars — Compact grid view
 */

import {
  createSummaryListRecipe,
  TemplateWidget,
  type WidgetTemplateConfig,
} from "@radarboard/widget-engine/templates";
import type { WidgetRenderProps } from "@radarboard/widget-sdk/widget-types";
import { domAnimation, LazyMotion, m } from "motion/react";
import type { GitHubStarsConfig } from "../../types";

const GITHUB_STARS_TEMPLATE_CONFIG: GitHubStarsConfig = {
  dataSources: [{ id: "github-stars" }],
  sections: createSummaryListRecipe({
    summary: [
      {
        type: "headline-stat",
        source: { sourceId: "github-stars", field: "totalStarsDeltaLabel" },
        label: "stars added",
        indicatorColor: "#4ade80",
      },
      {
        type: "kpi-row",
        columns: 4,
        variant: "compact",
        metrics: [
          {
            label: "Stars",
            source: { sourceId: "github-stars", field: "totalStars", format: "number" },
          },
          {
            label: "Forks",
            source: { sourceId: "github-stars", field: "totalForks", format: "number" },
          },
          {
            label: "Repos",
            source: { sourceId: "github-stars", field: "repoCount", format: "number" },
          },
          {
            label: "Watchers",
            source: { sourceId: "github-stars", field: "totalWatchers", format: "number" },
          },
        ],
      },
    ],
    list: {
      type: "list",
      source: { sourceId: "github-stars", field: "repos" },
      layout: "inline",
      inlineHeader: {
        title: "Repo",
        value: "+Stars",
        timestamp: "Stars",
        gridTemplateColumns: "minmax(0,1.85fr) 64px 72px",
      },
      emptyMessage: "No repositories",
      selection: {
        selectionId: "github-stars.repo",
        keyField: "repoKey",
        detailRendererId: "github.stars-repo",
        dialog: { size: "lg", resizable: true },
      },
      itemTemplate: {
        title: { sourceId: "github-stars", field: "fullName" },
        value: { sourceId: "github-stars", field: "starsDeltaLabel" },
        valueColor: { sourceId: "github-stars", field: "starsDeltaColor" },
        timestamp: { sourceId: "github-stars", field: "stars", format: "number" },
      },
    },
  }),
  expandedSections: [
    {
      type: "headline-stat",
      source: { sourceId: "github-stars", field: "totalStarsDeltaLabel" },
      label: "stars added",
      indicatorColor: "#4ade80",
    },
    {
      type: "kpi-row",
      columns: 4,
      metrics: [
        {
          label: "Stars",
          source: { sourceId: "github-stars", field: "totalStars", format: "number" },
        },
        {
          label: "Forks",
          source: { sourceId: "github-stars", field: "totalForks", format: "number" },
        },
        {
          label: "Repos",
          source: { sourceId: "github-stars", field: "repoCount", format: "number" },
        },
        {
          label: "Watchers",
          source: { sourceId: "github-stars", field: "totalWatchers", format: "number" },
        },
      ],
    },
    {
      type: "chart",
      variant: "line",
      source: { sourceId: "github-stars", field: "aggregateDaily" },
      xKey: "date",
      yKey: "totalStars",
      color: "#f5c542",
      height: 180,
    },
    {
      type: "chart",
      variant: "bar",
      source: { sourceId: "github-stars", field: "aggregateAddedDaily" },
      xKey: "date",
      yKey: "count",
      color: "#5b8af5",
      height: 180,
    },
    {
      type: "table",
      source: { sourceId: "github-stars", field: "repos" },
      columns: [
        { key: "fullName", header: "Repository", sortable: true },
        { key: "openIssues", header: "Issues", sortable: true, format: "number" },
        { key: "stars", header: "Stars", sortable: true, format: "number" },
        { key: "starsDeltaLabel", header: "+Stars", sortable: true },
      ],
      searchable: true,
      defaultSort: { key: "stars", direction: "desc" },
      emptyMessage: "No repositories",
      selection: {
        selectionId: "github-stars.repo",
        keyField: "repoKey",
        detailRendererId: "github.stars-repo",
        dialog: { size: "lg", resizable: true },
      },
    },
  ],
};

export { GITHUB_STARS_TEMPLATE_CONFIG };

function isTemplateConfig(config: unknown): config is WidgetTemplateConfig {
  if (!config || typeof config !== "object") return false;
  const candidate = config as Partial<WidgetTemplateConfig>;
  return Array.isArray(candidate.dataSources) && Array.isArray(candidate.sections);
}

export { isTemplateConfig };

export function GitHubStarsCompact({
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
}: WidgetRenderProps<GitHubStarsConfig>) {
  const templateConfig = isTemplateConfig(config) ? config : GITHUB_STARS_TEMPLATE_CONFIG;

  return (
    <LazyMotion features={domAnimation}>
      <m.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="flex h-full flex-col"
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
          onConnectService={onConnectService}
        />
      </m.div>
    </LazyMotion>
  );
}
