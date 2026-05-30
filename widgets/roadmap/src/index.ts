/**
 * Roadmap — Widget Descriptor
 *
 * Shows active Linear projects (releases) with progress,
 * and in-progress issues across teams.
 */

import { API_ROUTES } from "@radarboard/types/api-routes";
import type { WidgetTemplateConfig } from "@radarboard/widget-engine/templates";
import type { WidgetDescriptor } from "@radarboard/widget-sdk/widget-types";

import {
  isTemplateConfig,
  ROADMAP_TEMPLATE_CONFIG,
  RoadmapCompact,
} from "./components/roadmap-compact";
import { RoadmapExpanded } from "./components/roadmap-expanded";

export const roadmapDescriptor: WidgetDescriptor<WidgetTemplateConfig> = {
  id: "roadmap",
  name: "Roadmap",
  description: "Active releases, project progress, and in-progress work from Linear",
  catalogCategory: "product",
  requiredIntegrations: [],
  defaultSlot: "slot3",
  component: RoadmapCompact,
  expandedComponent: RoadmapExpanded,
  defaultConfig: ROADMAP_TEMPLATE_CONFIG,
  polling: { sourceIds: ["roadmap"] },
  visualEditor: {
    kind: "template",
    getConfig: ({ config }) => (isTemplateConfig(config) ? config : ROADMAP_TEMPLATE_CONFIG),
    setConfig: ({ editorConfig }) => editorConfig as WidgetTemplateConfig,
  },
  auth: {
    id: "linear",
    name: "Linear",
    type: "api_key",
    fields: [{ key: "apiKey", label: "API Key", type: "password", placeholder: "lin_api_..." }],
    testEndpoint: API_ROUTES.credentialsTest,
    docsUrl: "https://linear.app/settings/api",
  },
};
