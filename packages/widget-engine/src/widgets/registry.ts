import {
  isTemplateConfig,
  isTemplateRecipeModelValid,
  synchronizeTemplateConfig,
} from "@radarboard/widget-sdk/recipe-model";
import type { GridSlot, WidgetDescriptor } from "@radarboard/widget-sdk/widget-types";

type AnyWidgetDescriptor = WidgetDescriptor<unknown>;

export const WIDGET_REGISTRY = new Map<string, WidgetDescriptor<Record<string, unknown>>>();

const MAX_DESCRIPTION_LENGTH = 120;

function validateWidgetDescriptor(descriptor: AnyWidgetDescriptor): void {
  if (descriptor.description.length > MAX_DESCRIPTION_LENGTH) {
    throw new Error(
      `Widget "${descriptor.id}" description exceeds ${MAX_DESCRIPTION_LENGTH} characters (${descriptor.description.length}). Keep it concise for the settings UI.`
    );
  }
  if (descriptor.visualEditor?.kind !== "template") {
    throw new Error(`Widget "${descriptor.id}" must use the shared template visual editor.`);
  }

  const editorConfig = descriptor.visualEditor.getConfig({
    projectSlug: null,
    projects: [],
    config: descriptor.defaultConfig,
  });

  if (!isTemplateConfig(editorConfig)) {
    throw new Error(`Widget "${descriptor.id}" must resolve to a template-backed config.`);
  }

  const normalized = synchronizeTemplateConfig(editorConfig);

  if (!normalized.recipe) {
    throw new Error(`Widget "${descriptor.id}" is missing compact recipe metadata.`);
  }

  if (!isTemplateRecipeModelValid(normalized.recipe)) {
    throw new Error(`Widget "${descriptor.id}" has an invalid compact recipe structure.`);
  }

  if (normalized.expandedRecipe && !isTemplateRecipeModelValid(normalized.expandedRecipe)) {
    throw new Error(`Widget "${descriptor.id}" has an invalid expanded recipe structure.`);
  }
}

export function registerWidget<TConfig>(descriptor: WidgetDescriptor<TConfig>): void {
  if (WIDGET_REGISTRY.has(descriptor.id)) {
    // Idempotent — allow re-registration during HMR / React strict mode
    return;
  }
  validateWidgetDescriptor(descriptor as AnyWidgetDescriptor);
  WIDGET_REGISTRY.set(descriptor.id, descriptor as WidgetDescriptor<Record<string, unknown>>);
}

export function getWidget(id: string): WidgetDescriptor<Record<string, unknown>> | undefined {
  return WIDGET_REGISTRY.get(id) as WidgetDescriptor<Record<string, unknown>> | undefined;
}

export function getAllWidgets(): WidgetDescriptor<Record<string, unknown>>[] {
  return Array.from(WIDGET_REGISTRY.values()) as WidgetDescriptor<Record<string, unknown>>[];
}

export const GRID_SLOTS: GridSlot[] = [
  "slot1",
  "slot2",
  "slot3",
  "slot4",
  "slot5",
  "slot6",
  "slot7",
  "slot8",
  "slot9",
];

export const DEFAULT_LAYOUT: Record<GridSlot, string | null> = {
  slot1: null,
  slot2: null,
  slot3: null,
  slot4: null,
  slot5: null,
  slot6: null,
  slot7: null,
  slot8: null,
  slot9: null,
};

export type {
  GridSlot,
  WidgetAuth,
  WidgetAuthField,
  WidgetDescriptor,
  WidgetExpandAction,
  WidgetModalSize,
  WidgetRenderProps,
} from "@radarboard/widget-sdk/widget-types";
