import { API_ROUTES } from "@radarboard/types/api-routes";
import type { WidgetTemplateConfig } from "@radarboard/widget-engine/templates";
import { createTemplateDescriptor } from "@radarboard/widget-engine/templates/create-template-descriptor";
import {
  createSummaryContentRecipe,
  createSummaryListRecipe,
} from "@radarboard/widget-engine/templates/recipes";
import { useAnalytics } from "./hooks/use-analytics";

const ANALYTICS_TEMPLATE_CONFIG: WidgetTemplateConfig = {
  dataSources: [{ id: "analytics" }],
  sections: createSummaryListRecipe({
    summary: [
      {
        type: "headline-stat",
        source: { sourceId: "analytics", field: "liveVisitors", format: "number" },
        label: "live visitors",
        indicatorColor: "#4ade80",
      },
      {
        type: "kpi-row",
        columns: 4,
        variant: "compact",
        metrics: [
          {
            label: "Visitors",
            source: { sourceId: "analytics", field: "metrics.uniqueVisitors", format: "number" },
          },
          {
            label: "Sessions",
            source: { sourceId: "analytics", field: "metrics.totalSessions", format: "number" },
          },
          {
            label: "Page Views",
            source: { sourceId: "analytics", field: "metrics.totalPageViews", format: "number" },
          },
          {
            label: "Avg Duration",
            source: {
              sourceId: "analytics",
              field: "metrics.avgSessionDuration",
              format: "duration-seconds",
            },
          },
        ],
      },
    ],
    list: {
      type: "list",
      source: { sourceId: "analytics", field: "topPages" },
      layout: "inline",
      inlineHeader: {
        title: "Page",
        subtitle: "Site",
        value: "Sessions",
        gridTemplateColumns: "minmax(0,1fr) 140px 72px",
      },
      maxItems: 10,
      emptyMessage: "No pages",
      selection: {
        selectionId: "page",
        keyField: "detailKey",
        detailRendererId: "analytics.top-page",
        dialog: { size: "sm" },
      },
      itemTemplate: {
        title: { sourceId: "analytics", field: "path" },
        subtitle: { sourceId: "analytics", field: "platformName" },
        value: { sourceId: "analytics", field: "sessions", format: "number" },
        status: { sourceId: "analytics", field: "projectColor" },
      },
    },
  }),
  expandedSections: createSummaryContentRecipe({
    summary: [
      {
        type: "alert",
        severity: "info",
        source: { sourceId: "analytics", field: "" },
        condition: {
          source: { sourceId: "analytics", field: "liveVisitors" },
          operator: "gt",
          value: 0,
        },
        message: "{{liveVisitors}} live visitors right now",
      },
      {
        type: "kpi-row",
        columns: 4,
        metrics: [
          {
            label: "Visitors",
            source: { sourceId: "analytics", field: "metrics.uniqueVisitors", format: "number" },
          },
          {
            label: "Sessions",
            source: { sourceId: "analytics", field: "metrics.totalSessions", format: "number" },
          },
          {
            label: "Page Views",
            source: { sourceId: "analytics", field: "metrics.totalPageViews", format: "number" },
          },
          {
            label: "Avg Duration",
            source: {
              sourceId: "analytics",
              field: "metrics.avgSessionDuration",
              format: "duration-seconds",
            },
          },
        ],
      },
    ],
    content: {
      type: "tabs",
      defaultTab: "pages",
      tabs: [
        {
          id: "pages",
          label: "Pages",
          sections: [
            {
              type: "table",
              source: { sourceId: "analytics", field: "topPages" },
              searchable: true,
              defaultSort: { key: "sessions", direction: "desc" },
              selection: {
                selectionId: "page",
                keyField: "detailKey",
                detailRendererId: "analytics.top-page",
                dialog: { size: "sm" },
              },
              columns: [
                { key: "path", header: "Page", sortable: true },
                { key: "sessions", header: "Sessions", sortable: true, format: "number" },
                { key: "bounceRate", header: "Bounce", sortable: true, format: "percent" },
                {
                  key: "avgDuration",
                  header: "Duration",
                  sortable: true,
                  format: "duration-seconds",
                },
              ],
            },
          ],
        },
        {
          id: "referrers",
          label: "Referrers",
          sections: [
            {
              type: "list",
              source: { sourceId: "analytics", field: "referrers" },
              emptyMessage: "No referrers",
              itemTemplate: {
                title: { sourceId: "analytics", field: "name" },
                subtitle: { sourceId: "analytics", field: "bounceRate", format: "percent" },
                value: { sourceId: "analytics", field: "sessions", format: "number" },
              },
            },
          ],
        },
        {
          id: "trend",
          label: "Trend",
          sections: [
            {
              type: "chart",
              variant: "line",
              source: { sourceId: "analytics", field: "visitorTrend" },
              xKey: "date",
              yKey: "value",
              height: 320,
              color: "#5b8af5",
            },
          ],
        },
      ],
    },
  }),
};

const ANALYTICS_KPI_CONFIG: WidgetTemplateConfig = {
  dataSources: [{ id: "analytics" }],
  sections: [
    {
      type: "headline-stat",
      source: { sourceId: "analytics", field: "liveVisitors", format: "number" },
      label: "live visitors",
      indicatorColor: "#4ade80",
    },
    {
      type: "kpi-row",
      columns: 4,
      metrics: [
        {
          label: "Visitors",
          source: { sourceId: "analytics", field: "metrics.uniqueVisitors", format: "number" },
        },
        {
          label: "Sessions",
          source: { sourceId: "analytics", field: "metrics.totalSessions", format: "number" },
        },
        {
          label: "Page Views",
          source: { sourceId: "analytics", field: "metrics.totalPageViews", format: "number" },
        },
        {
          label: "Avg Duration",
          source: {
            sourceId: "analytics",
            field: "metrics.avgSessionDuration",
            format: "duration-seconds",
          },
        },
      ],
    },
  ],
};

export const analyticsDescriptor = createTemplateDescriptor(
  "analytics",
  "Analytics",
  "Visitor metrics, top pages, referrers, and traffic trends",
  ANALYTICS_TEMPLATE_CONFIG,
  {
    catalogCategory: "analytics",
    capabilities: [
      {
        id: "analytics",
        role: "canonical",
        providers: [{ integration: "openpanel", action: "data" }],
      },
    ],
    defaultSlot: "slot4",
    requiredIntegrations: [],
    defaultPollInterval: 60_000,
    pollingSourceIds: ["analytics"],
    chrome: {
      hooks: {
        analytics: useAnalytics,
      },
    },
    variants: [
      { id: "pages", name: "Pages", config: ANALYTICS_TEMPLATE_CONFIG, isDefault: true },
      { id: "kpi", name: "KPI Overview", config: ANALYTICS_KPI_CONFIG },
    ],
    auth: [
      {
        id: "openpanel",
        name: "OpenPanel",
        type: "api_key",
        fields: [
          { key: "clientId", label: "Client ID", type: "text", placeholder: "" },
          { key: "clientSecret", label: "Client Secret", type: "password", placeholder: "" },
        ],
        testEndpoint: API_ROUTES.credentialsTest,
        docsUrl: "https://docs.openpanel.dev/docs/api",
      },
      {
        id: "umami",
        name: "Umami",
        description:
          "Web analytics: pageviews, visitors, top pages, and audience breakdown from Umami.",
        type: "api_key",
        fields: [
          { key: "apiKey", label: "API Key", type: "password", placeholder: "" },
          {
            key: "baseUrl",
            label: "Base URL",
            type: "text",
            placeholder: "https://analytics.example.com",
          },
          { key: "websiteId", label: "Website ID", type: "text", placeholder: "" },
        ],
        testEndpoint: API_ROUTES.credentialsTest,
        docsUrl: "https://umami.is/docs/api",
      },
    ],
  }
);
export { useAnalytics };
