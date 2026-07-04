/**
 * Assistant action: set/merge a widget's per-widget config overrides.
 * Configs are global (keyed by widget ID) in WidgetLayoutConfig.configs.
 */
import type { WidgetLayoutConfig } from "@radarboard/types/database";
import { WIDGET_REGISTRY } from "@radarboard/widget-engine/widgets/registry";

export interface ConfigureWidgetParams {
  widgetId: string;
  /** Config keys to set. */
  config: Record<string, unknown>;
  /** Merge into the existing config (default) or replace it entirely. */
  mode?: "merge" | "replace";
}

/** PURE: compute the config with the widget's overrides updated. */
export function setWidgetConfig(
  config: WidgetLayoutConfig,
  params: ConfigureWidgetParams
): WidgetLayoutConfig {
  const configs = config.configs ?? {};
  const existing = configs[params.widgetId] ?? {};
  const next = params.mode === "replace" ? { ...params.config } : { ...existing, ...params.config };
  return { ...config, configs: { ...configs, [params.widgetId]: next } };
}

export interface ConfigureWidgetResult {
  configured: boolean;
  widgetId: string;
  keys?: string[];
  error?: string;
}

export async function executeConfigureWidget(
  params: ConfigureWidgetParams
): Promise<ConfigureWidgetResult> {
  if (!WIDGET_REGISTRY.has(params.widgetId)) {
    return {
      configured: false,
      widgetId: params.widgetId,
      error: `Unknown widget "${params.widgetId}". Call list_widgets to see valid widget IDs.`,
    };
  }
  if (!params.config || Object.keys(params.config).length === 0) {
    return { configured: false, widgetId: params.widgetId, error: "No config keys provided." };
  }

  const { getSettingsRepo } = await import("@/data/core/repository");
  const repo = getSettingsRepo();
  const config = (await repo.getWidgetLayout()) ?? { configs: {} };
  await repo.setWidgetLayout(setWidgetConfig(config, params));
  return { configured: true, widgetId: params.widgetId, keys: Object.keys(params.config) };
}
