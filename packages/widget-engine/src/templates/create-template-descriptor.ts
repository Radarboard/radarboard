import type { PlatformIntegrations } from "@radarboard/types/project";
import { synchronizeTemplateConfig } from "@radarboard/widget-sdk/recipe-model";
import type {
  CreateTemplateDescriptorOptions,
  WidgetTemplateConfig,
} from "@radarboard/widget-sdk/types";
import type { WidgetDescriptor } from "@radarboard/widget-sdk/widget-types";
import { TemplateWidget, TemplateWidgetExpanded } from "./template-widget";

export function createTemplateDescriptor(
  id: string,
  name: string,
  description: string,
  templateConfig: WidgetTemplateConfig,
  options?: CreateTemplateDescriptorOptions
): WidgetDescriptor<WidgetTemplateConfig> {
  const normalizedConfig = synchronizeTemplateConfig(templateConfig);

  return {
    id,
    name,
    description,
    catalogCategory: options?.catalogCategory,
    capabilities: options?.capabilities,
    requiredIntegrations:
      (options?.requiredIntegrations as Array<keyof PlatformIntegrations> | undefined) ?? [],
    defaultSlot: options?.defaultSlot ?? "slot1",
    component: TemplateWidget,
    expandedComponent: TemplateWidgetExpanded,
    defaultConfig: normalizedConfig,
    visualEditor: {
      kind: "template",
      getConfig: ({ config }) => synchronizeTemplateConfig(config as WidgetTemplateConfig),
      setConfig: ({ editorConfig }) => editorConfig as WidgetTemplateConfig,
    },
    auth: options?.auth,
    expandedSize: options?.expandedSize,
    defaultPollInterval: options?.defaultPollInterval,
    polling: options?.pollingSourceIds ? { sourceIds: options.pollingSourceIds } : undefined,
    variants: options?.variants?.map((v) => ({
      ...v,
      config: synchronizeTemplateConfig(v.config),
    })),
  };
}
