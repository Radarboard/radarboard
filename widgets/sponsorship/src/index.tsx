import { API_ROUTES } from "@radarboard/types/api-routes";
import {
  createTemplateConfig,
  createTemplateDescriptor,
} from "@radarboard/widget-engine/templates";
import { createSummaryContentRecipe } from "@radarboard/widget-engine/templates/recipes";

export * from "./components/github-sponsors";
export * from "./components/open-collective";

export const SPONSORSHIP_TEMPLATE_CONFIG = createTemplateConfig({
  dataSources: [{ id: "githubSponsors" }, { id: "openCollective" }],
  sections: createSummaryContentRecipe({
    summary: [
      {
        type: "headline-stat",
        source: {
          sourceId: "githubSponsors",
          field: "metrics.monthlyRevenueInCents",
          format: "currency-cents",
        },
        label: "GitHub Revenue",
      },
      {
        type: "headline-stat",
        source: {
          sourceId: "openCollective",
          field: "metrics.totalRevenueInCents",
          format: "currency-cents",
        },
        label: "OC Revenue",
      },
    ],
    content: {
      type: "tabs",
      defaultTab: "github",
      tabs: [
        {
          id: "github",
          label: "GitHub",
          sections: [
            {
              type: "custom",
              component: "GitHubSponsorsList",
              source: { sourceId: "githubSponsors", field: "sponsors" },
            },
          ],
        },
        {
          id: "opencollective",
          label: "Open Collective",
          sections: [
            {
              type: "custom",
              component: "OpenCollectiveMembers",
              source: { sourceId: "openCollective", field: "members" },
            },
          ],
        },
      ],
    },
  }),
});

const sponsorshipDescriptorBase = createTemplateDescriptor(
  "sponsorship",
  "Sponsorship",
  "Track sponsorship revenue and members from GitHub and Open Collective",
  SPONSORSHIP_TEMPLATE_CONFIG,
  {
    catalogCategory: "finance",
    defaultSlot: "slot8",
    requiredIntegrations: [],
    defaultPollInterval: 300_000,
    pollingSourceIds: ["sponsorship"],
    auth: [
      {
        id: "github",
        name: "GitHub",
        type: "oauth",
        oauth: { provider: "github", scopes: ["read:org", "read:user"] },
        testEndpoint: API_ROUTES.credentialsTest,
      },
      {
        id: "opencollective",
        name: "Open Collective",
        type: "api_key",
        fields: [{ key: "apiKey", label: "Personal Token", type: "password" }],
        testEndpoint: API_ROUTES.credentialsTest,
      },
    ],
  }
);

export const sponsorshipDescriptor = {
  ...sponsorshipDescriptorBase,
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
};
