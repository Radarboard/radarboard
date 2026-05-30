/**
 * ASO Keywords — Widget Descriptor
 */

import {
  createSummaryContentRecipe,
  TemplateWidget,
  TemplateWidgetExpanded,
  type WidgetTemplateConfig,
} from "@radarboard/widget-engine/templates";
import type { WidgetDescriptor, WidgetRenderProps } from "@radarboard/widget-sdk/widget-types";
import { createElement } from "react";

export const ASO_KEYWORDS_TEMPLATE_CONFIG: WidgetTemplateConfig = {
  dataSources: [{ id: "aso" }],
  sections: createSummaryContentRecipe({
    summary: [
      {
        type: "kpi-row",
        columns: 4,
        variant: "compact",
        metrics: [
          { label: "#1", source: { sourceId: "aso", field: "summary.top1", format: "number" } },
          { label: "#2", source: { sourceId: "aso", field: "summary.top2", format: "number" } },
          { label: "#3", source: { sourceId: "aso", field: "summary.top3", format: "number" } },
          {
            label: "Top 10",
            source: { sourceId: "aso", field: "summary.top10", format: "number" },
          },
        ],
      },
    ],
    content: {
      type: "dense-ranked-table",
      source: { sourceId: "aso", field: "compactKeywords" },
      variant: "compact",
      stateKey: "aso-keywords:keywords",
      filterStateId: "aso-expanded",
      filterPersistKey: "radarboard:widget:aso-keywords:expanded",
      filterRules: [
        { controlId: "store", field: "store", kind: "select" },
        { controlId: "popularity", field: "popularity", kind: "range" },
        { controlId: "difficulty", field: "difficulty", kind: "range" },
        { controlId: "rank", field: "currentRanking", kind: "range" },
        {
          controlId: "onlyChanged",
          field: "rankingChange",
          kind: "toggle",
          operator: "neq",
          value: 0,
        },
      ],
      maxItems: 25,
      selection: {
        selectionId: "aso.keyword",
        keyField: "key",
        detailRendererId: "aso.keyword",
      },
      gridTemplateColumns: "32px minmax(0,1fr) 84px 84px 40px 40px 44px",
      columns: [
        { key: "rank", header: "Rank", variant: "rank", field: "currentRanking", align: "right" },
        { key: "keyword", header: "Keyword", variant: "text", field: "keyword" },
        {
          key: "popularity",
          header: "Pop.",
          variant: "bar",
          field: "popularity",
          color: "#5b8af5",
        },
        {
          key: "difficulty",
          header: "Diff.",
          variant: "bar",
          field: "difficulty",
          color: "#f97316",
        },
        {
          key: "opportunity",
          header: "Opp.",
          variant: "number",
          field: "opportunity",
          align: "right",
        },
        { key: "store", header: "Store", variant: "flag", field: "countryFlag", align: "center" },
        {
          key: "change",
          header: "△",
          variant: "delta",
          field: "rankingChange",
          align: "right",
        },
      ],
      emptyMessage: "No keywords tracked",
    },
  }),
  expandedSections: createSummaryContentRecipe({
    summary: [
      {
        type: "alert",
        severity: "warning",
        source: { sourceId: "aso", field: "staleMessage" },
        message: "{{value}}",
        condition: {
          source: { sourceId: "aso", field: "isStale" },
          operator: "eq",
          value: true,
        },
      },
      {
        type: "kpi-row",
        columns: 6,
        metrics: [
          { label: "#1", source: { sourceId: "aso", field: "summary.top1", format: "number" } },
          { label: "#2", source: { sourceId: "aso", field: "summary.top2", format: "number" } },
          { label: "#3", source: { sourceId: "aso", field: "summary.top3", format: "number" } },
          {
            label: "Top 10",
            source: { sourceId: "aso", field: "summary.top10", format: "number" },
          },
          {
            label: "Improving",
            source: { sourceId: "aso", field: "summary.improving", format: "number" },
          },
          {
            label: "Declining",
            source: { sourceId: "aso", field: "summary.declining", format: "number" },
          },
        ],
      },
      {
        type: "filter-bar",
        stateId: "aso-expanded",
        persistKey: "radarboard:widget:aso-keywords:expanded",
        controls: [
          {
            type: "select",
            id: "store",
            label: "Store",
            allLabel: "All",
            optionsSource: { sourceId: "aso", field: "stores" },
          },
          {
            type: "range",
            id: "popularity",
            label: "Popularity",
            min: 0,
            max: 100,
            step: 5,
            accentColor: "#5b8af5",
            format: "number",
          },
          {
            type: "range",
            id: "difficulty",
            label: "Difficulty",
            min: 0,
            max: 100,
            step: 5,
            accentColor: "#f97316",
            format: "number",
          },
          {
            type: "range",
            id: "rank",
            label: "Rank",
            min: 1,
            max: 1000,
            step: 1,
            accentColor: "#10b981",
            format: "rank",
          },
          {
            type: "toggle",
            id: "onlyChanged",
            label: "Only changed",
            accentColor: "#f5c542",
          },
        ],
      },
    ],
    content: {
      type: "dense-ranked-table",
      source: { sourceId: "aso", field: "keywords" },
      variant: "expanded",
      stateKey: "aso-keywords:keywords",
      filterStateId: "aso-expanded",
      filterPersistKey: "radarboard:widget:aso-keywords:expanded",
      filterRules: [
        { controlId: "store", field: "store", kind: "select" },
        { controlId: "popularity", field: "popularity", kind: "range" },
        { controlId: "difficulty", field: "difficulty", kind: "range" },
        { controlId: "rank", field: "currentRanking", kind: "range" },
        {
          controlId: "onlyChanged",
          field: "rankingChange",
          kind: "toggle",
          operator: "neq",
          value: 0,
        },
      ],
      selection: {
        selectionId: "aso.keyword",
        keyField: "key",
        detailRendererId: "aso.keyword",
      },
      defaultSort: { key: "currentRanking", direction: "asc" },
      filterPlaceholder: "Filter keywords or country…",
      emptyMessage: "No keywords match the current filters",
      columns: [
        {
          key: "currentRanking",
          header: "Rank",
          variant: "rank",
          field: "currentRanking",
          align: "right",
          sortable: true,
        },
        { key: "keyword", header: "Keyword", variant: "text", field: "keyword", sortable: true },
        {
          key: "store",
          header: "Country",
          variant: "flag",
          field: "countryFlag",
          align: "center",
          sortable: true,
        },
        {
          key: "rankingChange",
          header: "△",
          variant: "delta",
          field: "rankingChange",
          align: "right",
          sortable: true,
        },
        {
          key: "difficulty",
          header: "Diff.",
          variant: "bar",
          field: "difficulty",
          color: "#f97316",
          sortable: true,
        },
        {
          key: "popularity",
          header: "Pop.",
          variant: "bar",
          field: "popularity",
          color: "#5b8af5",
          sortable: true,
        },
        {
          key: "opportunity",
          header: "Opp.",
          variant: "number",
          field: "opportunity",
          align: "right",
          sortable: true,
        },
        {
          key: "appsCount",
          header: "Apps",
          variant: "number",
          field: "appsCount",
          align: "right",
          sortable: true,
        },
      ],
    },
  }),
};

function isTemplateConfig(config: unknown): config is WidgetTemplateConfig {
  return (
    config !== null &&
    typeof config === "object" &&
    Array.isArray((config as WidgetTemplateConfig).dataSources) &&
    Array.isArray((config as WidgetTemplateConfig).sections)
  );
}

function AsoKeywordsModule(props: WidgetRenderProps<WidgetTemplateConfig>) {
  return createElement(TemplateWidget, {
    ...props,
    config: isTemplateConfig(props.config) ? props.config : ASO_KEYWORDS_TEMPLATE_CONFIG,
  });
}

function AsoKeywordsExpandedModule(props: WidgetRenderProps<WidgetTemplateConfig>) {
  return createElement(TemplateWidgetExpanded, {
    ...props,
    config: isTemplateConfig(props.config) ? props.config : ASO_KEYWORDS_TEMPLATE_CONFIG,
  });
}

export const asoKeywordsDescriptor: WidgetDescriptor<WidgetTemplateConfig> = {
  id: "aso-keywords",
  name: "ASO Keywords",
  description: "App Store keyword rankings, difficulty, and popularity from Astro",
  catalogCategory: "product",
  requiredIntegrations: [],
  defaultSlot: "slot8",
  defaultPollInterval: 900_000,
  polling: { sourceIds: ["aso-keywords"] },
  component: AsoKeywordsModule,
  expandedComponent: AsoKeywordsExpandedModule,
  defaultConfig: ASO_KEYWORDS_TEMPLATE_CONFIG,
  visualEditor: {
    kind: "template",
    getConfig: ({ config }) => (isTemplateConfig(config) ? config : ASO_KEYWORDS_TEMPLATE_CONFIG),
    setConfig: ({ editorConfig }) => editorConfig as WidgetTemplateConfig,
  },
};
