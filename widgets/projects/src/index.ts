/**
 * Projects — Widget Descriptor
 */

import type { WidgetTemplateConfig } from "@radarboard/widget-engine/templates";
import type { WidgetDescriptor } from "@radarboard/widget-sdk/widget-types";

import {
  isTemplateConfig,
  VERCEL_PROJECTS_TEMPLATE_CONFIG,
  VercelProjectsCompact,
} from "./components/projects-compact";
import { VercelProjectsExpanded } from "./components/projects-expanded";

export const projectsDescriptor: WidgetDescriptor<WidgetTemplateConfig> = {
  id: "projects",
  name: "Projects",
  description: "Live deployment status across all Vercel projects",
  catalogCategory: "infrastructure",
  requiredIntegrations: ["vercel"],
  defaultSlot: "slot9",
  defaultPollInterval: 120_000,
  polling: { sourceIds: ["vercel-deployments"] },
  component: VercelProjectsCompact,
  expandedComponent: VercelProjectsExpanded,
  defaultConfig: VERCEL_PROJECTS_TEMPLATE_CONFIG,
  visualEditor: {
    kind: "template",
    getConfig: ({ config }) =>
      isTemplateConfig(config) ? config : VERCEL_PROJECTS_TEMPLATE_CONFIG,
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
