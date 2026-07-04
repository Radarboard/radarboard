/**
 * Generic Rest — Expanded fullscreen view
 *
 * Template-backed by default. Add expandedRecipe in index.ts if the expanded
 * layout should differ from compact.
 */

import {
  TemplateWidgetExpanded,
  type WidgetTemplateConfig,
} from "@radarboard/widget-engine/templates";
import type { WidgetRenderProps } from "@radarboard/widget-sdk/widget-types";

export function GenericRestExpanded({
  widgetId,
  projectSlug,
  timeRange,
  config,
  onFetchedAt,
  onRefetch,
}: WidgetRenderProps<WidgetTemplateConfig>) {
  return (
    <TemplateWidgetExpanded
      widgetId={widgetId}
      projectSlug={projectSlug}
      timeRange={timeRange}
      config={config}
      onFetchedAt={onFetchedAt}
      onRefetch={onRefetch}
    />
  );
}
