/**
 * Domains — Widget Descriptor
 */

import type { WidgetTemplateConfig } from "@radarboard/widget-engine/templates";
import type { WidgetDescriptor } from "@radarboard/widget-sdk/widget-types";

import {
  isTemplateConfig,
  VERCEL_DOMAINS_TEMPLATE_CONFIG,
  VercelDomainsCompact,
} from "./components/domains-compact";
import { VercelDomainsExpanded } from "./components/domains-expanded";

export const domainsDescriptor: WidgetDescriptor<WidgetTemplateConfig> = {
  id: "vercel-domains",
  name: "Vercel Domains",
  description: "Domain verification and configuration status across Vercel projects",
  catalogCategory: "infrastructure",
  capabilities: [
    {
      id: "domains",
      role: "canonical",
      providers: [{ integration: "vercel", action: "domains" }],
    },
  ],
  requiredIntegrations: ["vercel"],
  defaultSlot: "slot9",
  defaultPollInterval: 600_000,
  polling: { sourceIds: ["vercel-domains"] },
  component: VercelDomainsCompact,
  expandedComponent: VercelDomainsExpanded,
  defaultConfig: VERCEL_DOMAINS_TEMPLATE_CONFIG,
  visualEditor: {
    kind: "template",
    getConfig: ({ config }) => (isTemplateConfig(config) ? config : VERCEL_DOMAINS_TEMPLATE_CONFIG),
    setConfig: ({ editorConfig }) => editorConfig as WidgetTemplateConfig,
  },
  auth: {
    id: "vercel",
    name: "Vercel",
    type: "api_key",
    fields: [
      { key: "token", label: "Access Token", type: "password" },
      {
        key: "teamId",
        label: "Team ID",
        type: "text",
        helpText: "Optional. Found in team settings.",
      },
    ],
    testEndpoint: "/api/credentials/test",
    docsUrl: "https://vercel.com/account/tokens",
  },
};

export const vercelDomainsDescriptor = domainsDescriptor;
