/**
 * Sponsorship — Widget Descriptor
 */

import { API_ROUTES } from "@radarboard/types/api-routes";
import {
  createSummaryContentRecipe,
  TemplateWidget,
  TemplateWidgetExpanded,
  type WidgetTemplateConfig,
} from "@radarboard/widget-engine/templates";
import type { WidgetDescriptor, WidgetRenderProps } from "@radarboard/widget-sdk/widget-types";
import { createElement } from "react";

export const SPONSORSHIP_TEMPLATE_CONFIG: WidgetTemplateConfig = {
  dataSources: [{ id: "sponsorship" }],
  sections: [
    {
      type: "summary-quad",
      slots: [
        {
          kind: "metric",
          label: "Monthly Income",
          source: { sourceId: "sponsorship", field: "monthlyIncome", format: "currency" },
          tooltip:
            "GitHub Sponsors monthly income plus Open Collective yearly budget normalized to a monthly view.",
        },
        {
          kind: "metric",
          label: "Total Sponsors",
          source: { sourceId: "sponsorship", field: "totalSponsors", format: "number" },
          subtitle: { sourceId: "sponsorship", field: "sourceLabel" },
        },
        {
          kind: "metric",
          label: "OC Balance",
          source: { sourceId: "sponsorship", field: "balance", format: "currency" },
        },
        {
          kind: "sparkline",
          label: "Donations",
          source: { sourceId: "sponsorship", field: "sparklineData" },
          emptyMessage: "No trend data",
          positive: true,
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
            label: "Monthly Income",
            source: { sourceId: "sponsorship", field: "monthlyIncome", format: "currency" },
            tooltip:
              "GitHub Sponsors monthly income plus Open Collective yearly budget normalized to a monthly view.",
          },
          {
            kind: "metric",
            label: "Total Sponsors",
            source: { sourceId: "sponsorship", field: "totalSponsors", format: "number" },
            subtitle: { sourceId: "sponsorship", field: "sourceLabel" },
          },
          {
            kind: "metric",
            label: "OC Balance",
            source: { sourceId: "sponsorship", field: "balance", format: "currency" },
          },
          {
            kind: "sparkline",
            label: "Donations",
            source: { sourceId: "sponsorship", field: "sparklineData" },
            emptyMessage: "No trend data",
            positive: true,
          },
        ],
      },
    ],
    content: {
      type: "tabs",
      variant: "expanded",
      defaultTab: "sponsors",
      tabs: [
        {
          id: "sponsors",
          label: "Sponsors",
          countSource: { sourceId: "sponsorship", field: "sponsorsCount", format: "number" },
          sections: [
            {
              type: "row-list",
              source: { sourceId: "sponsorship", field: "sponsors" },
              emptyMessage: "No sponsors yet",
              selection: {
                selectionId: "sponsorship.sponsor",
                keyField: "id",
                detailRendererId: "sponsorship.sponsor",
              },
              itemTemplate: {
                title: { sourceId: "sponsorship", field: "displayName" },
                subtitle: { sourceId: "sponsorship", field: "displayTier" },
                value: { sourceId: "sponsorship", field: "monthlyValue", format: "currency" },
              },
            },
          ],
        },
        {
          id: "backers",
          label: "Backers",
          countSource: { sourceId: "sponsorship", field: "topMembersCount", format: "number" },
          sections: [
            {
              type: "row-list",
              source: { sourceId: "sponsorship", field: "topMembers" },
              emptyMessage: "No backers yet",
              selection: {
                selectionId: "sponsorship.member",
                keyField: "id",
                detailRendererId: "sponsorship.member",
              },
              itemTemplate: {
                title: { sourceId: "sponsorship", field: "name" },
                subtitle: { sourceId: "sponsorship", field: "displayTier" },
                value: { sourceId: "sponsorship", field: "donatedValue", format: "currency" },
              },
            },
          ],
        },
        {
          id: "transactions",
          label: "Transactions",
          countSource: {
            sourceId: "sponsorship",
            field: "recentTransactionsCount",
            format: "number",
          },
          sections: [
            {
              type: "row-list",
              source: { sourceId: "sponsorship", field: "recentTransactions" },
              emptyMessage: "No transactions yet",
              selection: {
                selectionId: "sponsorship.transaction",
                keyField: "id",
                detailRendererId: "sponsorship.transaction",
              },
              itemTemplate: {
                status: { source: { sourceId: "sponsorship", field: "status" } },
                title: { sourceId: "sponsorship", field: "accountName" },
                subtitle: { sourceId: "sponsorship", field: "descriptionText" },
                value: { sourceId: "sponsorship", field: "displayAmount", format: "currency" },
              },
            },
          ],
        },
        {
          id: "tiers",
          label: "Tiers",
          countSource: { sourceId: "sponsorship", field: "tiersCount", format: "number" },
          sections: [
            {
              type: "row-list",
              source: { sourceId: "sponsorship", field: "tiers" },
              emptyMessage: "No tiers yet",
              itemTemplate: {
                title: { sourceId: "sponsorship", field: "name" },
                subtitle: { sourceId: "sponsorship", field: "sponsorCount", format: "number" },
                value: { sourceId: "sponsorship", field: "monthlyValue", format: "currency" },
              },
            },
          ],
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

function SponsorshipModule(props: WidgetRenderProps<WidgetTemplateConfig>) {
  return createElement(TemplateWidget, {
    ...props,
    config: isTemplateConfig(props.config) ? props.config : SPONSORSHIP_TEMPLATE_CONFIG,
  });
}

function SponsorshipExpandedModule(props: WidgetRenderProps<WidgetTemplateConfig>) {
  return createElement(TemplateWidgetExpanded, {
    ...props,
    config: isTemplateConfig(props.config) ? props.config : SPONSORSHIP_TEMPLATE_CONFIG,
  });
}

export const sponsorshipDescriptor: WidgetDescriptor<WidgetTemplateConfig> = {
  id: "sponsorship",
  name: "Sponsorship",
  description:
    "Unified sponsorship view — sponsors, backers, and donation metrics from Open Collective and GitHub Sponsors",
  catalogCategory: "revenue",
  capabilities: [
    {
      id: "sponsorship",
      role: "canonical",
      providers: [
        { integration: "github-sponsors", action: "data" },
        { integration: "open-collective", action: "data" },
      ],
    },
  ],
  requiredIntegrations: [],
  defaultSlot: "slot7",
  component: SponsorshipModule,
  expandedComponent: SponsorshipExpandedModule,
  defaultConfig: SPONSORSHIP_TEMPLATE_CONFIG,
  polling: { sourceIds: ["sponsorship"] },
  visualEditor: {
    kind: "template",
    getConfig: ({ config }) => (isTemplateConfig(config) ? config : SPONSORSHIP_TEMPLATE_CONFIG),
    setConfig: ({ editorConfig }) => editorConfig as WidgetTemplateConfig,
  },
  auth: [
    {
      id: "opencollective",
      name: "Open Collective",
      type: "api_key",
      fields: [{ key: "apiToken", label: "Personal Token", type: "password", placeholder: "" }],
      testEndpoint: API_ROUTES.credentialsTest,
      docsUrl: "https://docs.opencollective.com/help/contributing/development/api#authentication",
    },
    {
      id: "github",
      name: "GitHub Sponsors",
      type: "oauth",
      fields: [
        { key: "clientId", label: "Client ID", type: "text", placeholder: "" },
        { key: "clientSecret", label: "Client Secret", type: "password", placeholder: "" },
      ],
      docsUrl: "https://github.com/settings/developers",
      oauth: {
        provider: "github",
        scopes: ["read:user"],
        setupInstructions:
          "Create an OAuth App at github.com/settings/developers. Set the callback URL to: {origin}/api/auth/github/callback",
      },
    },
  ],
};
