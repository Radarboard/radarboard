/**
 * Shipping Log — Widget Descriptor
 */

import { API_ROUTES } from "@radarboard/types/api-routes";
import type { WidgetTemplateConfig } from "@radarboard/widget-engine/templates";
import type { WidgetDescriptor } from "@radarboard/widget-sdk/widget-types";

import {
  isTemplateConfig,
  SHIPPING_TEMPLATE_CONFIG,
  ShippingCompact,
} from "./components/shipping-compact";
import { ShippingExpanded } from "./components/shipping-expanded";
import { useShipping } from "./hooks/use-shipping";

export const shippingDescriptor: WidgetDescriptor<WidgetTemplateConfig> = {
  id: "shipping",
  name: "Release Activity",
  description: "Recent deploys, commits, and release work",
  catalogCategory: "product",
  capabilities: [
    {
      id: "shipping",
      role: "canonical",
      providers: [{ integration: "shipping", action: "data" }],
    },
  ],
  requiredIntegrations: [],
  defaultSlot: "slot2",
  component: ShippingCompact,
  expandedComponent: ShippingExpanded,
  defaultConfig: SHIPPING_TEMPLATE_CONFIG,
  polling: { sourceIds: ["shipping"] },
  chrome: {
    hooks: {
      shipping: useShipping,
    },
  },
  visualEditor: {
    kind: "template",
    getConfig: ({ config }) => (isTemplateConfig(config) ? config : SHIPPING_TEMPLATE_CONFIG),
    setConfig: ({ editorConfig }) => editorConfig as WidgetTemplateConfig,
  },
  auth: [
    {
      id: "vercel",
      name: "Vercel",
      type: "api_key",
      fields: [
        { key: "token", label: "Access Token", type: "password", placeholder: "" },
        {
          key: "teamId",
          label: "Team ID",
          type: "text",
          placeholder: "team_...",
          helpText: "Optional. Required for team-owned projects.",
        },
      ],
      testEndpoint: API_ROUTES.credentialsTest,
      docsUrl: "https://vercel.com/account/tokens",
    },
    {
      id: "linear",
      name: "Linear",
      type: "api_key",
      fields: [{ key: "apiKey", label: "API Key", type: "password", placeholder: "lin_api_..." }],
      testEndpoint: API_ROUTES.credentialsTest,
      docsUrl: "https://linear.app/settings/api",
    },
    {
      id: "github",
      name: "GitHub",
      type: "oauth",
      fields: [
        { key: "clientId", label: "Client ID", type: "text", placeholder: "" },
        { key: "clientSecret", label: "Client Secret", type: "password", placeholder: "" },
      ],
      docsUrl: "https://github.com/settings/developers",
      oauth: {
        provider: "github",
        scopes: ["repo"],
        setupInstructions:
          "Create an OAuth App at github.com/settings/developers. Set the callback URL to: {origin}/api/auth/github/callback",
      },
    },
  ],
};
export { useShipping };
