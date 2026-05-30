/**
 * Deployments — Widget Descriptor
 */

import type { WidgetTemplateConfig } from "@radarboard/widget-engine/templates";
import type { WidgetDescriptor } from "@radarboard/widget-sdk/widget-types";

import {
  isTemplateConfig,
  VERCEL_DEPLOYMENTS_TEMPLATE_CONFIG,
  VercelDeploymentsCompact,
} from "./components/deployments-compact";
import { VercelDeploymentsExpanded } from "./components/deployments-expanded";

export const VercelDeploymentsModule = VercelDeploymentsCompact;
export const VercelDeploymentsModuleExpanded = VercelDeploymentsExpanded;

export const deploymentsDescriptor: WidgetDescriptor<WidgetTemplateConfig> = {
  id: "deployments",
  name: "Deployments",
  description: "Deploy frequency, success rate, and recent deployments from Vercel",
  catalogCategory: "infrastructure",
  requiredIntegrations: ["vercel"],
  defaultSlot: "slot8",
  defaultPollInterval: 120_000,
  polling: { sourceIds: ["vercel-deployments"] },
  component: VercelDeploymentsCompact,
  expandedComponent: VercelDeploymentsExpanded,
  defaultConfig: VERCEL_DEPLOYMENTS_TEMPLATE_CONFIG,
  visualEditor: {
    kind: "template",
    getConfig: ({ config }) =>
      isTemplateConfig(config) ? config : VERCEL_DEPLOYMENTS_TEMPLATE_CONFIG,
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
