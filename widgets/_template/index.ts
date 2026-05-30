/**
 * __WIDGET_NAME__ — Widget Descriptor
 *
 * To use this template:
 *   1. Run: pnpm create-widget <name>
 *   2. Replace the starter sections with your actual composition
 *   3. Register a template data source for "__WIDGET_KEBAB__"
 *   4. The scaffold script will add registration to init.ts
 *
 * Section helpers (kpiRow, list, chart, etc.) provide a shorthand for building
 * sections without manually constructing DataSource objects. Import them from
 * "@radarboard/widget-sdk/section-helpers".
 */

import {
  buildTemplateRecipe,
  type TemplateRecipeModel,
  type WidgetTemplateConfig,
} from "@radarboard/widget-engine/templates";
import type { WidgetDescriptor } from "@radarboard/widget-sdk/widget-types";
import { kpiRow, list } from "@radarboard/widget-sdk/section-helpers";
import { __WIDGET_PASCAL__Compact } from "./components/__WIDGET_KEBAB__-compact";
import { __WIDGET_PASCAL__Expanded } from "./components/__WIDGET_KEBAB__-expanded";

// Use section helpers for concise section definitions.
// See all helpers: kpiRow, list, rowList, chart, headlineStat, summaryQuad, cardList, alert, tabs
const SRC = "__WIDGET_KEBAB__";

const __widgetPascalRecipe: TemplateRecipeModel = {
  kind: "summary_list",
  summary: [
    kpiRow(SRC, [
      { label: "Total", field: "totalCount" },
      { label: "Active", field: "activeCount" },
    ]),
  ],
  rail: [],
  content: [
    list(SRC, "items", {
      title: "title",
      subtitle: "subtitle",
      emptyMessage: "No items yet",
    }),
  ],
};

export const __WIDGET_PASCAL___TEMPLATE_CONFIG: WidgetTemplateConfig = {
  dataSources: [{ id: SRC }],
  recipe: __widgetPascalRecipe,
  sections: buildTemplateRecipe(__widgetPascalRecipe),
  expandedRecipe: __widgetPascalRecipe,
  expandedSections: buildTemplateRecipe(__widgetPascalRecipe),
};

export const __WIDGET_CAMEL__Descriptor: WidgetDescriptor<WidgetTemplateConfig> = {
  id: "__WIDGET_KEBAB__",
  name: "__WIDGET_NAME__",
  description: "TODO: Add a description",
  requiredIntegrations: [],
  defaultSlot: "slot8",
  component: __WIDGET_PASCAL__Compact,
  expandedComponent: __WIDGET_PASCAL__Expanded,
  defaultConfig: __WIDGET_PASCAL___TEMPLATE_CONFIG,
  screenshots: [],
  tier: "community",
  requiredCapabilities: ["network"],
  visualEditor: {
    kind: "template",
    getConfig: ({ config }) => config,
    setConfig: ({ editorConfig }) => editorConfig as WidgetTemplateConfig,
  },
};
