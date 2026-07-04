/**
 * Generic REST — Widget Descriptor
 *
 * A configurable, template-driven widget that renders data from ANY connected
 * REST integration. Its config carries `integrationId` + `dataSourceAction`
 * (what to fetch) and `sections` (how to map the response's fields onto KPIs and
 * lists). The assistant fills these in after creating/connecting an integration;
 * until configured, it shows a hint.
 *
 * Section helpers (kpiRow, list, chart, alert, …) build sections without
 * hand-constructing DataSource objects.
 */

import type { WidgetTemplateConfig } from "@radarboard/widget-engine/templates";
import { alert } from "@radarboard/widget-sdk/section-helpers";
import type { WidgetDescriptor } from "@radarboard/widget-sdk/widget-types";
import { GenericRestCompact } from "./components/generic-rest-compact";
import { GenericRestExpanded } from "./components/generic-rest-expanded";

const SRC = "generic-rest";

const UNCONFIGURED_HINT = alert(
  "info",
  "Configure this widget: choose an integration and action, then map its response fields."
);

export const GENERIC_REST_TEMPLATE_CONFIG: WidgetTemplateConfig = {
  dataSources: [{ id: SRC }],
  sections: [UNCONFIGURED_HINT],
  expandedSections: [UNCONFIGURED_HINT],
};

export const genericRestDescriptor: WidgetDescriptor<WidgetTemplateConfig> = {
  id: "generic-rest",
  name: "REST Data",
  description: "Render data from any connected REST integration by mapping its response fields.",
  requiredIntegrations: [],
  defaultSlot: "slot8",
  component: GenericRestCompact,
  expandedComponent: GenericRestExpanded,
  defaultConfig: GENERIC_REST_TEMPLATE_CONFIG,
  screenshots: [],
  tier: "community",
  requiredCapabilities: ["network"],
  visualEditor: {
    kind: "template",
    getConfig: ({ config }) => config,
    setConfig: ({ editorConfig }) => editorConfig as WidgetTemplateConfig,
  },
};

/** Widget id for a given integration's dedicated REST Data widget. */
export function restWidgetId(integrationId: string): string {
  return `rest-${integrationId}`;
}

/**
 * Build a dedicated REST Data widget bound to one integration. Each integration
 * gets its own widget id, so its config (the field mappings) is independent —
 * this is what lets multiple no-code integrations render side by side. The
 * `integrationId` is baked into the default config so the widget fetches even
 * before its sections are mapped.
 */
export function createRestWidgetDescriptor(
  integrationId: string,
  name?: string
): WidgetDescriptor<WidgetTemplateConfig> {
  const label = name?.trim() || integrationId;
  const config = {
    dataSources: [{ id: SRC }],
    integrationId,
    sections: [UNCONFIGURED_HINT],
    expandedSections: [UNCONFIGURED_HINT],
  } as WidgetTemplateConfig;

  return {
    id: restWidgetId(integrationId),
    name: label,
    description: `Data from the ${label} integration.`.slice(0, 120),
    requiredIntegrations: [],
    defaultSlot: "slot8",
    component: GenericRestCompact,
    expandedComponent: GenericRestExpanded,
    defaultConfig: config,
    screenshots: [],
    tier: "community",
    requiredCapabilities: ["network"],
    visualEditor: {
      kind: "template",
      getConfig: ({ config }) => config,
      setConfig: ({ editorConfig }) => editorConfig as WidgetTemplateConfig,
    },
  };
}
