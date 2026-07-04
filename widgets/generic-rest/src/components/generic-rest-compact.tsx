/**
 * Generic Rest — Compact grid view
 *
 * Template-backed by default. Replace the starter recipe in index.ts when
 * implementing the widget.
 */

import { TemplateWidget, type WidgetTemplateConfig } from "@radarboard/widget-engine/templates";
import type { WidgetRenderProps } from "@radarboard/widget-sdk/widget-types";

export function GenericRestCompact({
  widgetId,
  projectSlug,
  timeRange,
  config,
  onFetchedAt,
  onRefetch,
}: WidgetRenderProps<WidgetTemplateConfig>) {
  return (
    <TemplateWidget
      widgetId={widgetId}
      projectSlug={projectSlug}
      timeRange={timeRange}
      config={config}
      onFetchedAt={onFetchedAt}
      onRefetch={onRefetch}
    />
  );
}
