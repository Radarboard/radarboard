/**
 * Downloads — Widget Descriptor
 */

import type { WidgetTemplateConfig } from "@radarboard/widget-engine/templates";
import type { WidgetDescriptor } from "@radarboard/widget-sdk/widget-types";

import {
  isTemplateConfig,
  NPM_DOWNLOADS_TEMPLATE_CONFIG,
  NpmDownloadsCompact,
} from "./components/downloads-compact";
import { NpmDownloadsExpanded } from "./components/downloads-expanded";
import type { NpmDownloadsConfig } from "./types";

export const downloadsDescriptor: WidgetDescriptor<NpmDownloadsConfig> = {
  id: "npm-downloads",
  name: "NPM Downloads",
  description: "Weekly and monthly download counts for your npm packages",
  catalogCategory: "analytics",
  capabilities: [
    {
      id: "downloads",
      role: "canonical",
      providers: [{ integration: "npm", action: "data" }],
    },
  ],
  requiredIntegrations: ["npm"],
  defaultSlot: "slot8",
  component: NpmDownloadsCompact,
  expandedComponent: NpmDownloadsExpanded,
  defaultConfig: NPM_DOWNLOADS_TEMPLATE_CONFIG,
  polling: { sourceIds: ["npm-downloads"] },
  visualEditor: {
    kind: "template",
    getConfig: ({ config }) => (isTemplateConfig(config) ? config : NPM_DOWNLOADS_TEMPLATE_CONFIG),
    setConfig: ({ config, editorConfig }) => ({
      ...(editorConfig as WidgetTemplateConfig),
      includePackages: Array.isArray((config as NpmDownloadsConfig).includePackages)
        ? (config as NpmDownloadsConfig).includePackages
        : undefined,
      excludePackages: Array.isArray((config as NpmDownloadsConfig).excludePackages)
        ? (config as NpmDownloadsConfig).excludePackages
        : undefined,
    }),
  },
};

export const npmDownloadsDescriptor = downloadsDescriptor;
