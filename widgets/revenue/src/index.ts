/**
 * Revenue — Widget Descriptor
 */

import { API_ROUTES } from "@radarboard/types/api-routes";
import {
  createSummaryContentRecipe,
  TemplateWidget,
  TemplateWidgetExpanded,
} from "@radarboard/widget-engine/templates";
import type { WidgetDescriptor, WidgetRenderProps } from "@radarboard/widget-sdk/widget-types";
import { createElement } from "react";
import { REVENUE_CAPABILITIES } from "./capabilities";
import type { RevenueWidgetConfig } from "./types";

export const REVENUE_TEMPLATE_CONFIG: RevenueWidgetConfig = {
  dataSources: [{ id: "revenue" }],
  sections: [
    {
      type: "summary-quad",
      slots: [
        {
          kind: "metric",
          label: "Gross Revenue",
          source: { sourceId: "revenue", field: "grossRevenue.value", format: "currency" },
          changeSource: { sourceId: "revenue", field: "grossRevenueChange", format: "percent" },
          sparklineSource: { sourceId: "revenue", field: "grossRevenue.sparklineData" },
          breakdownSource: { sourceId: "revenue", field: "breakdown.grossRevenue" },
        },
        {
          kind: "metric",
          label: "MRR",
          source: { sourceId: "revenue", field: "mrr.value", format: "currency" },
          changeSource: { sourceId: "revenue", field: "mrrChange", format: "percent" },
          sparklineSource: { sourceId: "revenue", field: "mrr.sparklineData" },
          breakdownSource: { sourceId: "revenue", field: "breakdown.mrr" },
        },
        {
          kind: "metric",
          label: "Last Payment",
          source: {
            sourceId: "revenue",
            field: "overview.lastPayment.amount",
            format: "currency",
          },
          subtitle: { sourceId: "revenue", field: "overview.lastPayment.timeAgo" },
          footerStart: {
            sourceId: "revenue",
            field: "overview.lastPayment.projectName",
            normalize: "compact-project",
          },
          footerEnd: { sourceId: "revenue", field: "overview.lastPayment.country" },
          footerColor: { sourceId: "revenue", field: "overview.lastPayment.projectColor" },
        },
        {
          kind: "metric",
          label: "Net Revenue",
          source: { sourceId: "revenue", field: "netRevenue.value", format: "currency" },
          changeSource: { sourceId: "revenue", field: "netRevenueChange", format: "percent" },
          sparklineSource: { sourceId: "revenue", field: "netRevenue.sparklineData" },
          breakdownSource: { sourceId: "revenue", field: "breakdown.netRevenue" },
        },
      ],
    },
  ],
  expandedSections: createSummaryContentRecipe({
    summary: [
      {
        type: "summary-quad",
        slots: [
          {
            kind: "metric",
            label: "Gross Revenue",
            source: { sourceId: "revenue", field: "grossRevenue.value", format: "currency" },
            changeSource: {
              sourceId: "revenue",
              field: "grossRevenueChange",
              format: "percent",
            },
            sparklineSource: { sourceId: "revenue", field: "grossRevenue.sparklineData" },
            breakdownSource: { sourceId: "revenue", field: "breakdown.grossRevenue" },
          },
          {
            kind: "metric",
            label: "MRR",
            source: { sourceId: "revenue", field: "mrr.value", format: "currency" },
            changeSource: { sourceId: "revenue", field: "mrrChange", format: "percent" },
            sparklineSource: { sourceId: "revenue", field: "mrr.sparklineData" },
            breakdownSource: { sourceId: "revenue", field: "breakdown.mrr" },
          },
          {
            kind: "metric",
            label: "Last Payment",
            source: {
              sourceId: "revenue",
              field: "overview.lastPayment.amount",
              format: "currency",
            },
            subtitle: { sourceId: "revenue", field: "overview.lastPayment.timeAgo" },
            footerStart: {
              sourceId: "revenue",
              field: "overview.lastPayment.projectName",
              normalize: "compact-project",
            },
            footerEnd: { sourceId: "revenue", field: "overview.lastPayment.country" },
            footerColor: { sourceId: "revenue", field: "overview.lastPayment.projectColor" },
          },
          {
            kind: "metric",
            label: "Net Revenue",
            source: { sourceId: "revenue", field: "netRevenue.value", format: "currency" },
            changeSource: { sourceId: "revenue", field: "netRevenueChange", format: "percent" },
            sparklineSource: { sourceId: "revenue", field: "netRevenue.sparklineData" },
            breakdownSource: { sourceId: "revenue", field: "breakdown.netRevenue" },
          },
        ],
      },
      {
        type: "kpi-row",
        columns: 2,
        metrics: [
          {
            label: "New Customers",
            source: { sourceId: "revenue", field: "raw.newCustomers", format: "number" },
          },
          {
            label: "Active Users",
            source: { sourceId: "revenue", field: "raw.activeUsers", format: "number" },
          },
        ],
      },
    ],
    content: {
      type: "chart",
      variant: "line",
      source: { sourceId: "revenue", field: "trend" },
      xKey: "date",
      yKey: "value",
      height: 400,
      color: "#4ade80",
    },
  }),
};

function isTemplateConfig(config: unknown): config is RevenueWidgetConfig {
  return (
    config !== null &&
    typeof config === "object" &&
    Array.isArray((config as RevenueWidgetConfig).dataSources) &&
    Array.isArray((config as RevenueWidgetConfig).sections)
  );
}

function RevenueModule(props: WidgetRenderProps<RevenueWidgetConfig>) {
  return createElement(TemplateWidget, {
    ...props,
    config: isTemplateConfig(props.config) ? props.config : REVENUE_TEMPLATE_CONFIG,
  });
}

function RevenueExpandedModule(props: WidgetRenderProps<RevenueWidgetConfig>) {
  return createElement(TemplateWidgetExpanded, {
    ...props,
    config: isTemplateConfig(props.config) ? props.config : REVENUE_TEMPLATE_CONFIG,
  });
}

const REVENUE_KPI_CONFIG: RevenueWidgetConfig = {
  dataSources: [{ id: "revenue" }],
  sections: [
    {
      type: "kpi-row",
      columns: 4,
      metrics: [
        {
          label: "Gross Revenue",
          source: { sourceId: "revenue", field: "grossRevenue.value", format: "currency" },
          changeSource: { sourceId: "revenue", field: "grossRevenueChange", format: "percent" },
          sparklineSource: { sourceId: "revenue", field: "grossRevenue.sparklineData" },
        },
        {
          label: "MRR",
          source: { sourceId: "revenue", field: "mrr.value", format: "currency" },
          changeSource: { sourceId: "revenue", field: "mrrChange", format: "percent" },
          sparklineSource: { sourceId: "revenue", field: "mrr.sparklineData" },
        },
        {
          label: "Net Revenue",
          source: { sourceId: "revenue", field: "netRevenue.value", format: "currency" },
          changeSource: { sourceId: "revenue", field: "netRevenueChange", format: "percent" },
          sparklineSource: { sourceId: "revenue", field: "netRevenue.sparklineData" },
        },
        {
          label: "New Customers",
          source: { sourceId: "revenue", field: "raw.newCustomers", format: "number" },
        },
      ],
    },
  ],
};

export const revenueDescriptor: WidgetDescriptor<RevenueWidgetConfig> = {
  id: "revenue",
  name: "Revenue",
  description: "Subscription revenue, MRR, and payment metrics",
  catalogCategory: "revenue",
  capabilities: REVENUE_CAPABILITIES,
  requiredIntegrations: [],
  defaultSlot: "slot1",
  component: RevenueModule,
  expandedComponent: RevenueExpandedModule,
  defaultConfig: REVENUE_TEMPLATE_CONFIG,
  variants: [
    { id: "detailed", name: "Detailed", config: REVENUE_TEMPLATE_CONFIG, isDefault: true },
    { id: "kpi", name: "KPI", config: REVENUE_KPI_CONFIG },
  ],
  polling: { sourceIds: ["revenue"] },
  visualEditor: {
    kind: "template",
    getConfig: ({ config }) => (isTemplateConfig(config) ? config : REVENUE_TEMPLATE_CONFIG),
    setConfig: ({ config, editorConfig }) => ({
      ...(editorConfig as RevenueWidgetConfig),
      providerIntegrationId:
        typeof (config as RevenueWidgetConfig).providerIntegrationId === "string"
          ? (config as RevenueWidgetConfig).providerIntegrationId
          : undefined,
    }),
  },
  auth: [
    {
      id: "revenuecat",
      name: "RevenueCat",
      type: "api_key",
      fields: [
        {
          key: "apiKey",
          label: "API Secret Key",
          type: "password",
          placeholder: "sk_...",
          helpText:
            "Create a RevenueCat V2 secret key with Charts metrics Overview and Charts read access.",
        },
        {
          key: "projectId",
          label: "Project ID",
          type: "text",
          placeholder: "proj1ab2c3d4",
          helpText: "Use the RevenueCat Project ID from Project Settings, not an app ID.",
        },
      ],
      testEndpoint: API_ROUTES.credentialsTest,
      docsUrl: "https://www.revenuecat.com/docs/authentication",
    },
    {
      id: "stripe",
      name: "Stripe",
      homepage: "https://stripe.com",
      type: "api_key",
      fields: [{ key: "secretKey", label: "Secret Key", type: "password", placeholder: "sk_..." }],
      testEndpoint: API_ROUTES.credentialsTest,
      docsUrl: "https://docs.stripe.com/keys",
    },
  ],
};
