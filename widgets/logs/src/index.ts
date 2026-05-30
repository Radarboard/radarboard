/**
 * Logs — Widget Descriptor
 */

import {
  TemplateWidget,
  TemplateWidgetExpanded,
  type WidgetTemplateConfig,
} from "@radarboard/widget-engine/templates";
import type { WidgetDescriptor, WidgetRenderProps } from "@radarboard/widget-sdk/widget-types";
import { createElement } from "react";

export const LOGS_TEMPLATE_CONFIG: WidgetTemplateConfig = {
  dataSources: [],
  sections: [
    {
      type: "stream-list",
      variant: "compact",
      defaultLevel: "debug",
      maxItems: 50,
      autoScroll: true,
      defaultLive: false,
      showSearch: false,
      showLiveToggle: false,
      emptyMessage: "No logs yet. Logs appear as API routes are called.",
    },
  ],
  expandedSections: [
    {
      type: "stream-list",
      variant: "expanded",
      defaultLevel: "all",
      maxItems: 500,
      autoScroll: true,
      defaultLive: false,
      showSearch: true,
      showLiveToggle: true,
      emptyMessage: "No logs match the current filters.",
    },
  ],
};

function isTemplateConfig(config: unknown): config is WidgetTemplateConfig {
  return (
    config !== null &&
    typeof config === "object" &&
    Array.isArray((config as WidgetTemplateConfig).dataSources) &&
    Array.isArray((config as WidgetTemplateConfig).sections)
  );
}

function LogsModule(props: WidgetRenderProps<WidgetTemplateConfig>) {
  return createElement(TemplateWidget, {
    ...props,
    config: isTemplateConfig(props.config) ? props.config : LOGS_TEMPLATE_CONFIG,
  });
}

function LogsExpandedModule(props: WidgetRenderProps<WidgetTemplateConfig>) {
  return createElement(TemplateWidgetExpanded, {
    ...props,
    config: isTemplateConfig(props.config) ? props.config : LOGS_TEMPLATE_CONFIG,
  });
}

export const logsDescriptor: WidgetDescriptor<WidgetTemplateConfig> = {
  id: "logs",
  name: "Logs",
  description: "Structured application logs with real-time streaming",
  catalogCategory: "development",
  requiredIntegrations: [],
  defaultSlot: "slot7",
  defaultPollInterval: 5_000,
  polling: { sourceIds: ["logs"] },
  component: LogsModule,
  expandedComponent: LogsExpandedModule,
  defaultConfig: LOGS_TEMPLATE_CONFIG,
  visualEditor: {
    kind: "template",
    getConfig: ({ config }) => (isTemplateConfig(config) ? config : LOGS_TEMPLATE_CONFIG),
    setConfig: ({ editorConfig }) => editorConfig as WidgetTemplateConfig,
  },
};
