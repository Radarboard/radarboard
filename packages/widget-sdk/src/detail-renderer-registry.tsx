"use client";

import type { ComponentType } from "react";

/** Props passed to a detail renderer component when displaying an item's detail view. */
export interface TemplateDetailRendererProps<TItem = unknown, TSourceData = unknown> {
  item: TItem;
  sourceData: TSourceData;
  projectSlug: string | null;
  close: () => void;
}

/** React component type for rendering a widget item's detail view. */
export type TemplateDetailRenderer = ComponentType<TemplateDetailRendererProps<unknown, unknown>>;

/** Global registry mapping widget IDs to their detail renderer components. */
export const DETAIL_RENDERER_REGISTRY = new Map<string, TemplateDetailRenderer>();

/** Registers a detail renderer component for a given widget ID. */
export function registerTemplateDetailRenderer<TItem = unknown, TSourceData = unknown>(
  id: string,
  renderer: ComponentType<TemplateDetailRendererProps<TItem, TSourceData>>
) {
  DETAIL_RENDERER_REGISTRY.set(id, renderer as unknown as TemplateDetailRenderer);
}
