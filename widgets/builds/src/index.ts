/**
 * Builds — Widget Descriptor
 */

import type { WidgetTemplateConfig } from "@radarboard/widget-engine/templates";
import type { WidgetDescriptor } from "@radarboard/widget-sdk/widget-types";

import {
  isTemplateConfig,
  VERCEL_BUILD_PERF_TEMPLATE_CONFIG,
  VercelBuildPerfCompact,
} from "./components/builds-compact";
import { VercelBuildPerfExpanded } from "./components/builds-expanded";

export const buildsDescriptor: WidgetDescriptor<WidgetTemplateConfig> = {
  id: "builds",
  name: "Builds",
  description: "Build time trends and performance across Vercel deployments",
  catalogCategory: "infrastructure",
  requiredIntegrations: ["vercel"],
  defaultSlot: "slot8",
  defaultPollInterval: 120_000,
  polling: { sourceIds: ["vercel-deployments"] },
  component: VercelBuildPerfCompact,
  expandedComponent: VercelBuildPerfExpanded,
  defaultConfig: VERCEL_BUILD_PERF_TEMPLATE_CONFIG,
  visualEditor: {
    kind: "template",
    getConfig: ({ config }) =>
      isTemplateConfig(config) ? config : VERCEL_BUILD_PERF_TEMPLATE_CONFIG,
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
